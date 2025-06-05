import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getUserBillingEligibility } from '@/lib/user/billing/billing';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const eligibility = await getUserBillingEligibility(user.id as string);
    return NextResponse.json(eligibility);
  } catch (error) {
    console.error('Error fetching billing eligibility:', error);
    return NextResponse.json({ error: 'Error fetching billing eligibility' }, { status: 500 });
  }
} 