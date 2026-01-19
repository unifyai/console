import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getUserBillingDetails } from '@/lib/user/billing/billing';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const details = await getUserBillingDetails(user.id);

    if (details[0].stripeCustomerId) {
      return NextResponse.json({ hasCustomerId: true });
    } else {
      return NextResponse.json({ hasCustomerId: false });
    }
  } catch (error) {
    console.error('Error checking if user has Stripe customer ID:', error);
    return NextResponse.json(
      { error: 'Error checking if user has Stripe customer ID' },
      { status: 500 }
    );
  }
}
