import { NextRequest, NextResponse } from 'next/server';
import { getAutoRechargeEligibility } from '@/lib/user/billing/billing';
import { getWorkspaceBillingContext } from '../../_utils/auth';

/**
 * Returns auto-recharge eligibility for the active workspace's billing account.
 *
 * Resolves the current workspace (personal or organization) from the session
 * cookie and checks spending eligibility accordingly.
 */
export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();

  if (!ctx) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const eligibility =
      ctx.type === 'organization'
        ? await getAutoRechargeEligibility(undefined, ctx.organizationId)
        : await getAutoRechargeEligibility(ctx.userId);

    return NextResponse.json(eligibility);
  } catch (error) {
    console.error('Error fetching auto-recharge eligibility:', error);
    return NextResponse.json(
      { error: 'Error fetching auto-recharge eligibility' },
      { status: 500 }
    );
  }
}
