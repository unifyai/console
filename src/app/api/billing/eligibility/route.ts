import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * Returns auto-recharge eligibility for the active workspace's billing account.
 *
 * Delegates to the backend GET /billing/auto-recharge endpoint, which
 * resolves the workspace context from the API key and returns combined
 * settings + eligibility.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.apiKey) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const client = await getOrchestraUserClient(user.apiKey);
    const response = await client.get('/billing/auto-recharge');
    const data = response.data;

    // Map to the shape the frontend components expect
    return NextResponse.json({
      totalSpending: data.totalSpending,
      canEnableAutoRecharge: data.eligible,
      minimumSpendRequired: data.minimumSpendRequired,
      remainingSpendNeeded: data.remainingSpendNeeded,
    });
  } catch (error: any) {
    console.error('Error fetching auto-recharge eligibility:', error?.response?.data || error);
    return NextResponse.json(
      { error: 'Error fetching auto-recharge eligibility' },
      { status: error?.response?.status || 500 }
    );
  }
}
