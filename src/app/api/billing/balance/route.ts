import { NextRequest, NextResponse } from 'next/server';
import { getBillingAccountInfo } from '@/lib/user/billing/billing';
import { getWorkspaceBillingContext } from '../../_utils/auth';

/**
 * Returns the credit balance for the active workspace's billing account.
 *
 * Resolves the current workspace (personal or organization) from the session
 * cookie and returns the balance from the appropriate billing account.
 */
export async function GET(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();

  if (!ctx) {
    // No authenticated session — return zero balance rather than a 404 error.
    return NextResponse.json({ balance: '0.00', fullBalance: 0 });
  }

  try {
    const billingInfo = await getBillingAccountInfo(
      ctx.type === 'organization'
        ? { organizationId: ctx.organizationId }
        : { userId: ctx.userId }
    );

    const balance = billingInfo.credits.toFixed(2);
    const fullBalance = billingInfo.credits;

    return NextResponse.json({ balance, fullBalance });
  } catch (error) {
    console.error('Error fetching billing balance:', error);
    return NextResponse.json({ error: 'Error fetching billing details' }, { status: 500 });
  }
}
