import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/user/billing/stripe/stripe-instance';
import { getBillingAccountInfo } from '@/lib/user/billing/billing';
import { getWorkspaceBillingContext } from '../../_utils/auth';

/**
 * Returns the status of a Stripe Checkout session.
 *
 * Context-aware: resolves the billing account for the active workspace
 * (personal or organization) and verifies the session belongs to that
 * billing account's Stripe customer.
 */
export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();
  if (!ctx) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not initialized' }, { status: 500 });
  }
  const stripeClient = stripe as NonNullable<typeof stripe>;

  try {
    const billingInfo = await getBillingAccountInfo(
      ctx.type === 'organization'
        ? { organizationId: ctx.organizationId }
        : { userId: ctx.userId }
    );
    const customerID = billingInfo.stripeCustomerId;

    const session = await stripeClient.checkout.sessions.retrieve(sessionId);

    // Security check: verify the session belongs to the active workspace.
    // For first-time buyers the billing account may not yet have a customer ID
    // (the webhook hasn't fired yet), so we fall back to checking client_reference_id.
    if (customerID && session.customer !== customerID) {
      // Also check if the session was created for this user via client_reference_id
      if (session.client_reference_id !== ctx.userId) {
        return NextResponse.json(
          { error: 'Checkout session does not belong to the authenticated workspace' },
          { status: 403 }
        );
      }
    } else if (!customerID && session.client_reference_id !== ctx.userId) {
      return NextResponse.json(
        { error: 'Checkout session does not belong to the authenticated workspace' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: session.status,
      paymentStatus: session.payment_status,
    });
  } catch (error: any) {
    console.error(`Error retrieving checkout session ${sessionId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
