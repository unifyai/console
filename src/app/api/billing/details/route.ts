import { NextRequest, NextResponse } from 'next/server';
import { getUserBillingDetails } from '@/lib/user/billing/billing';
import { getCurrentUser } from '@/lib/user/user';
import { Dict } from 'styled-components/dist/types';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {

    const billingDetails = await getUserBillingDetails(user.id as string)

    return NextResponse.json({ billingDetails, userCreatedAt: user.createdAt })
  } catch (error) {
    console.error('Error fetching billing details:', error);
    return NextResponse.json({ error: 'Error fetching billing details' }, { status: 500 });
  }
}