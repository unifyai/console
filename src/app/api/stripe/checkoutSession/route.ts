import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/user/billing/stripe/stripe';
import { getBillingAccountInfo } from '@/lib/user/billing/billing';
import { stripe } from '@/lib/user/billing/stripe/stripe-instance';
import { getWorkspaceBillingContext } from '../../_utils/auth';

/**
 * Returns a Stripe checkout session URL for the active workspace's billing account.
 *
 * Resolves the current workspace (personal or organization) from the session
 * cookie, fetches the Stripe customer ID (may be null for first-time buyers),
 * and creates a checkout session.
 *
 * If no Stripe customer exists yet, the session is created with
 * `customer_creation: 'always'` so Stripe handles customer creation inline.
 */
export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();

  if (!ctx) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not initialized. Check your environment variables.' },
      { status: 400 }
    );
  }

  try {
    const billingInfo = await getBillingAccountInfo(
      ctx.type === 'organization'
        ? { organizationId: ctx.organizationId }
        : { userId: ctx.userId }
    );

    const customerID = billingInfo.stripeCustomerId;

    const checkoutCtx = {
      userId: ctx.userId,
      ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}),
    };

    const { url, sessionId } = await createCheckoutSession(checkoutCtx, customerID);
    return NextResponse.json({ url, sessionId });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Error creating checkout session' }, { status: 500 });
  }
}
