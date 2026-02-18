import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, resolveTestCustomer } from '@/lib/user/billing/stripe/stripe';
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
 *
 * In staging, production customer IDs are swapped for test-mode customers
 * via `resolveTestCustomer` so that test-mode Stripe keys work correctly.
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

    // In staging, resolve a test-mode customer; in prod, use the DB value directly.
    const testCustomerId = await resolveTestCustomer(
      billingInfo.billingAccountId,
      billingInfo.stripeCustomerId ? undefined : ctx.email,
    );
    const customerID = testCustomerId ?? billingInfo.stripeCustomerId;

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
