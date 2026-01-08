import { setAutoRechargeQty } from '@/lib/user/billing/billing';
import { getCurrentUser } from '@/lib/user/user';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { amount } = body;

    const amountValue = Number(amount);

    if (isNaN(amountValue) || amountValue <= 0) {
      return NextResponse.json({ error: 'Invalid amount value' }, { status: 400 });
    }

    await setAutoRechargeQty(user.id, amountValue);

    return NextResponse.json({ message: 'Auto-recharge amount updated successfully' });
  } catch (error) {
    console.error('Error updating auto-recharge amount:', error);
    return NextResponse.json({ error: 'Error updating auto-recharge amount' }, { status: 500 });
  }
}
