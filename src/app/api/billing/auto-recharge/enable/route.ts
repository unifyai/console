import { NextRequest, NextResponse } from 'next/server';
import { enableAutoRecharge } from '@/lib/user/billing/billing';
import { getCurrentUser } from '@/lib/user/user';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    await enableAutoRecharge(user.id, enabled);

    return NextResponse.json({ message: 'Auto-recharge status updated successfully' });
  } catch (error) {
    console.error('Error updating auto-recharge status:', error);
    return NextResponse.json({ error: 'Error updating auto-recharge status' }, { status: 500 });
  }
}
