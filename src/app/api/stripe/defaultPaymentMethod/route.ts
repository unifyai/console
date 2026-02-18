import { getCustomerDefaultPaymentMethod, resolveTestCustomer } from '@/lib/user/billing/stripe/stripe';
import { getBillingAccountInfo } from '@/lib/user/billing/billing';
import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceBillingContext } from '../../_utils/auth';

/**
 * Returns the default payment method for the active workspace's billing account.
 *
 * Resolves the current workspace (personal or organization) from the session
 * cookie, fetches the Stripe customer ID, and retrieves the default payment method.
 *
 * In staging, uses `resolveTestCustomer` so the payment method is fetched for
 * the correct test-mode customer.
 *
 * @param request - The request object
 * @returns A JSON response containing the default payment method ID
 */
export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();

  if (!ctx) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const billingInfo = await getBillingAccountInfo(
      ctx.type === 'organization'
        ? { organizationId: ctx.organizationId }
        : { userId: ctx.userId }
    );

    // In staging, resolve a test-mode customer; in prod, use the DB value directly.
    const testCustomerId = await resolveTestCustomer(billingInfo.billingAccountId);
    const customerID = testCustomerId ?? billingInfo.stripeCustomerId;

    if (!customerID) {
      return NextResponse.json({ error: 'No customer ID found' }, { status: 404 });
    }

    const defaultPaymentMethod = await getCustomerDefaultPaymentMethod(customerID);
    return NextResponse.json({ defaultPaymentMethod });
  } catch (error) {
    console.error('Error fetching default payment method:', error);
    return NextResponse.json({ error: 'Error fetching default payment method' }, { status: 500 });
  }
}
