import { NextRequest, NextResponse } from 'next/server';
import { createCustomerPortalSession } from '@/lib/user/billing/stripe/stripe';
import { getBillingAccountInfo } from '@/lib/user/billing/billing';
import { getWorkspaceBillingContext } from '../../_utils/auth';

/**
 * Retrieves the Stripe customer portal session URL for the active workspace.
 *
 * Resolves the current workspace (personal or organization) from the session
 * cookie, fetches the Stripe customer ID from the billing account, and creates
 * a Stripe billing portal session.
 *
 * @param request - The NextRequest object.
 * @returns A JSON response containing the customer portal session URL or an error message.
 */
export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();

  if (!ctx) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    // Fetch the billing account info for the active workspace
    const billingInfo = await getBillingAccountInfo(
      ctx.type === 'organization'
        ? { organizationId: ctx.organizationId }
        : { userId: ctx.userId }
    );

    const customerID = billingInfo.stripeCustomerId;

    if (!customerID) {
      return NextResponse.json(
        { error: 'No Stripe customer ID found. Please purchase credits first to set up billing.' },
        { status: 404 }
      );
    }

    const portalSession = await createCustomerPortalSession(customerID);
    return NextResponse.json({ url: portalSession });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json({ error: 'Error creating portal session' }, { status: 500 });
  }
}
