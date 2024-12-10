import { NextRequest, NextResponse } from 'next/server';
import { setAutoRechargeThreshold } from '@/lib/user/billing/billing';
import { getCurrentUser } from '@/lib/user/user';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { threshold } = body;

    const thresholdValue = Number(threshold);

    if (isNaN(thresholdValue) || thresholdValue <= 0) {
      return NextResponse.json({ error: 'Invalid threshold value' }, { status: 400 });
    }

    await setAutoRechargeThreshold(user.id, thresholdValue);

    return NextResponse.json({ message: 'Auto-recharge threshold updated successfully' });
  } catch (error) {
    console.error('Error updating auto-recharge threshold:', error);
    return NextResponse.json({ error: 'Error updating auto-recharge threshold' }, { status: 500 });
  }
}
