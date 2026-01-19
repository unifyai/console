import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getRecharges } from '@/lib/user/billing/billing';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const freeRecharges = await getRecharges(user.id, undefined, undefined, undefined, 'free');

    const hasFreeCredits = freeRecharges.length > 0;

    return NextResponse.json({ hasFreeCredits });
  } catch (error) {
    console.error('Error checking for free credits:', error);
    return NextResponse.json({ error: 'Error checking for free credits' }, { status: 500 });
  }
}
