import { NextRequest, NextResponse } from 'next/server';
import { getBillingAccountInfo } from '@/lib/user/billing/billing';
import { getWorkspaceBillingContext } from '../../_utils/auth';

/**
 * Checks whether the active workspace's billing account has a Stripe customer ID.
 *
 * Resolves the current workspace (personal or organization) from the session
 * cookie and returns whether a Stripe customer exists.
 */
export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();

  if (!ctx) {
    // No authenticated session — return false rather than a 404 error.
    return NextResponse.json({ hasCustomerId: false });
  }

  try {
    const billingInfo = await getBillingAccountInfo(
      ctx.type === 'organization'
        ? { organizationId: ctx.organizationId }
        : { userId: ctx.userId }
    );

    return NextResponse.json({
      hasCustomerId: !!billingInfo.stripeCustomerId,
    });
  } catch (error) {
    console.error('Error checking if workspace has Stripe customer ID:', error);
    return NextResponse.json(
      { error: 'Error checking if workspace has Stripe customer ID' },
      { status: 500 }
    );
  }
}
