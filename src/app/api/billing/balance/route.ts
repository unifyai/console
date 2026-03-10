import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * Returns the billing status for the active workspace's billing account.
 *
 * Delegates to the backend GET /billing/account-info endpoint, which
 * resolves workspace context (personal vs org) from the API key.
 *
 * Response shape:
 *   - balance: formatted string (e.g. "25.00")
 *   - fullBalance: raw number
 *   - lastRechargeAt: ISO-8601 timestamp of last paid recharge, or null
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.apiKey) {
    // No authenticated session — return zero balance rather than a 404 error.
    return NextResponse.json({ balance: '0.00', fullBalance: 0, lastRechargeAt: null });
  }

  try {
    const client = await getOrchestraUserClient(user.apiKey);
    const response = await client.get('/billing/account-info');
    const data = response.data;

    const credits = typeof data.credits === 'number' ? data.credits : 0;
    const balance = credits.toFixed(2);

    return NextResponse.json({
      balance,
      fullBalance: credits,
      lastRechargeAt: data.lastRechargeAt ?? null,
    });
  } catch (error: any) {
    console.error('Error fetching billing balance:', error?.response?.data || error);
    return NextResponse.json({ error: 'Error fetching billing details' }, { status: 500 });
  }
}
