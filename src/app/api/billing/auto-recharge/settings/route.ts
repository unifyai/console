import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * GET: Returns auto-recharge settings AND eligibility for the active
 * workspace's billing account in a single call.
 *
 * Delegates to backend GET /billing/auto-recharge, which resolves context
 * from the API key and returns combined settings + eligibility.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);

  if (!apiKey) {
    return unauthorized();
  }

  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.get('/billing/auto-recharge');
    const data = response.data;

    return NextResponse.json({
      // Settings
      autoRechargeEnabled: data.enabled,
      autoRechargeThreshold: data.threshold,
      autoRechargeQty: data.qty,
      minRechargeAmount: data.minRechargeAmount,
      // Eligibility
      totalSpending: data.totalSpending,
      canEnableAutoRecharge: data.eligible,
      minimumSpendRequired: data.minimumSpendRequired,
      remainingSpendNeeded: data.remainingSpendNeeded,
      // Payment method
      hasPaymentMethod: data.hasPaymentMethod ?? false,
      // Blocking reason (null if auto-recharge can be enabled)
      blockedReason: data.blockedReason ?? null,
    });
  } catch (error: any) {
    console.error('Error fetching auto-recharge data:', error?.response?.data || error);
    return NextResponse.json(
      { error: 'Error fetching auto-recharge data' },
      { status: error?.response?.status || 500 }
    );
  }
}

/**
 * POST: Updates auto-recharge settings for the active workspace's billing account.
 *
 * Delegates to backend PUT /billing/auto-recharge as a single atomic update
 * instead of making three separate admin calls.
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);

  if (!apiKey) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { autoRechargeEnabled, autoRechargeThreshold, autoRechargeQty } = body;

    if (typeof autoRechargeEnabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    if (typeof autoRechargeThreshold !== 'number' || autoRechargeThreshold <= 0) {
      return NextResponse.json({ error: 'Invalid threshold value' }, { status: 400 });
    }

    if (typeof autoRechargeQty !== 'number' || autoRechargeQty <= 0) {
      return NextResponse.json({ error: 'Invalid quantity value' }, { status: 400 });
    }

    const client = await getOrchestraUserClient(apiKey);
    const response = await client.put('/billing/auto-recharge', {
      enabled: autoRechargeEnabled,
      threshold: autoRechargeThreshold,
      qty: autoRechargeQty,
    });

    return NextResponse.json({ message: 'Auto-recharge settings updated successfully' });
  } catch (error: any) {
    console.error('Error updating auto-recharge settings:', error?.response?.data || error);
    const status = error?.response?.status || 500;
    const detail =
      error?.response?.data?.detail || 'Error updating auto-recharge settings';
    return NextResponse.json({ error: detail }, { status });
  }
}
