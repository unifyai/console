import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getBalance } from '@/lib/billing/billing';
import { isBillingError } from '@/types/billing';

/**
 * Returns the billing status for the active workspace's billing account.
 *
 * Delegates to the shared `getBalance` server action factory so the
 * transform logic (credits → formatted balance) lives in one place.
 *
 * Response shape:
 *   - balance: formatted string (e.g. "25.00")
 *   - fullBalance: raw number
 *   - lastRechargeAt: ISO-8601 timestamp of last paid recharge, or null
 *   - accountStatus: ACTIVE, PAST_DUE, SUSPENDED, or CLOSED
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user || !user.apiKey) {
    // No authenticated session — return zero balance rather than a 404 error.
    return NextResponse.json({ balance: '0.00', fullBalance: 0, lastRechargeAt: null });
  }

  try {
    const fetchBalance = await getBalance(user.apiKey);
    const result = await fetchBalance();

    if (isBillingError(result)) {
      return NextResponse.json({ error: result.detail }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching billing balance:', error?.message || error);
    return NextResponse.json({ error: 'Error fetching billing details' }, { status: 500 });
  }
}
