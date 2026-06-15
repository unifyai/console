import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * GET: Returns the auto-increment opt-in state for the active
 * workspace's billing account.
 *
 * Delegates to backend GET /v0/billing/auto-increment. Auto-increment
 * replaces the legacy auto-recharge toggle for self-serve accounts:
 * when enabled, depleting the cycle's credits auto-upgrades the
 * subscription to the next tier (capped at the top tier).
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);

  if (!apiKey) {
    return unauthorized();
  }

  try {
    const client = await getOrchestraUserClient(apiKey);
    const response = await client.get('/billing/auto-increment');
    const data = response.data;

    return NextResponse.json({
      enabled: !!data.enabled,
      isSubscribed: !!data.isSubscribed,
      atTopTier: !!data.atTopTier,
    });
  } catch (error: any) {
    console.error('Error fetching auto-increment settings:', error?.response?.data || error);
    return NextResponse.json(
      { error: 'Error fetching auto-increment settings' },
      { status: error?.response?.status || 500 }
    );
  }
}

/**
 * PUT: Updates the auto-increment opt-in for the active workspace's
 * billing account. Delegates to backend PUT /v0/billing/auto-increment.
 */
export async function PUT(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);

  if (!apiKey) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const client = await getOrchestraUserClient(apiKey);
    const response = await client.put('/billing/auto-increment', { enabled });
    const data = response.data;

    return NextResponse.json({
      enabled: !!data.enabled,
      isSubscribed: !!data.isSubscribed,
      atTopTier: !!data.atTopTier,
    });
  } catch (error: any) {
    console.error('Error updating auto-increment settings:', error?.response?.data || error);
    const status = error?.response?.status || 500;
    const detail = error?.response?.data?.detail || 'Error updating auto-increment settings';
    return NextResponse.json({ error: detail }, { status });
  }
}
