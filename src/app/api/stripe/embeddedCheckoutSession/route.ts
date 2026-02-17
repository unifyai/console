import { NextRequest, NextResponse } from 'next/server';
import { createEmbeddedCheckoutSession } from '@/lib/user/billing/stripe/stripe';
import { getBillingAccountInfo } from '@/lib/user/billing/billing';
import { stripe } from '@/lib/user/billing/stripe/stripe-instance';
import { getWorkspaceBillingContext } from '../../_utils/auth';

/**
 * Returns a Stripe Embedded Checkout client_secret for the active workspace.
 *
 * Used by the StripeSidePanel to render the Stripe Checkout inline via
 * <EmbeddedCheckoutProvider> + <EmbeddedCheckout>.
 *
 * If the workspace doesn't have a Stripe customer ID yet, the session is
 * created with `customer_creation: 'always'` — Stripe will create the
 * customer during checkout and the webhook persists the ID afterward.
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

    // customerID may be null for first-time buyers — that's fine,
    // createEmbeddedCheckoutSession handles it via customer_creation: 'always'
    const customerID = billingInfo.stripeCustomerId;

    const checkoutCtx = {
      userId: ctx.userId,
      ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}),
    };

    const clientSecret = await createEmbeddedCheckoutSession(checkoutCtx, customerID);
    return NextResponse.json({ clientSecret });
  } catch (error) {
    console.error('Error creating embedded checkout session:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    );
  }
}
