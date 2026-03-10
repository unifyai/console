import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST: Toggle auto-recharge on/off for the active workspace's billing account.
 *
 * Delegates to backend PUT /billing/auto-recharge with only the enabled flag.
 * Threshold and qty are left unchanged.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !user.apiKey) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const client = await getOrchestraUserClient(user.apiKey);
    await client.put('/billing/auto-recharge', { enabled });

    return NextResponse.json({ message: 'Auto-recharge status updated successfully' });
  } catch (error: any) {
    console.error('Error updating auto-recharge status:', error?.response?.data || error);
    const status = error?.response?.status || 500;
    const detail =
      error?.response?.data?.detail || 'Error updating auto-recharge status';
    return NextResponse.json({ error: detail }, { status });
  }
}
