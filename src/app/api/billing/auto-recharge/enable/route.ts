import { NextRequest, NextResponse } from 'next/server';
import { enableAutoRecharge } from '@/lib/user/billing/billing';
import { getWorkspaceBillingContext } from '../../../_utils/auth';

export async function POST(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();

  if (!ctx) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const entityParams =
      ctx.type === 'organization'
        ? { organizationId: ctx.organizationId }
        : { userId: ctx.userId };

    await enableAutoRecharge(enabled, entityParams);

    return NextResponse.json({ message: 'Auto-recharge status updated successfully' });
  } catch (error) {
    console.error('Error updating auto-recharge status:', error);
    return NextResponse.json({ error: 'Error updating auto-recharge status' }, { status: 500 });
  }
}
