import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getUserBillingDetails } from '@/lib/user/billing/billing';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const billingDetails = await getUserBillingDetails(user.id as string);

    const balance = billingDetails[0].credits.toFixed(2);
    const fullBalance = billingDetails[0].credits;

    return NextResponse.json({ balance, fullBalance });
  } catch (error) {
    console.error('Error fetching billing details:', error);
    return NextResponse.json({ error: 'Error fetching billing details' }, { status: 500 });
  }
}
