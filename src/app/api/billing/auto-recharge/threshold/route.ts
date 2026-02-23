import { NextRequest, NextResponse } from 'next/server';
import { setAutoRechargeThreshold } from '@/lib/user/billing/billing';
import { getWorkspaceBillingContext } from '../../../_utils/auth';

export async function POST(request: NextRequest) {
  const ctx = await getWorkspaceBillingContext();

  if (!ctx) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { threshold } = body;

    const thresholdValue = Number(threshold);

    if (isNaN(thresholdValue) || thresholdValue <= 0) {
      return NextResponse.json({ error: 'Invalid threshold value' }, { status: 400 });
    }

    const entityParams =
      ctx.type === 'organization'
        ? { organizationId: ctx.organizationId }
        : { userId: ctx.userId };

    await setAutoRechargeThreshold(thresholdValue, entityParams);

    return NextResponse.json({ message: 'Auto-recharge threshold updated successfully' });
  } catch (error) {
    console.error('Error updating auto-recharge threshold:', error);
    return NextResponse.json({ error: 'Error updating auto-recharge threshold' }, { status: 500 });
  }
}
