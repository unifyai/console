import { NextRequest, NextResponse } from 'next/server';
import { getFreeRecharges } from '@/lib/user/billing/free-credits';

export async function GET(request: NextRequest) {
  const userID = request.nextUrl.searchParams.get('userID');

  if (!userID) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const freeRecharges = await getFreeRecharges(userID);
    return NextResponse.json({ freeRecharges });
  } catch (error) {
    console.error('Error retrieving free recharges:', error);
    return NextResponse.json({ error: 'Error retrieving free recharges' }, { status: 500 });
  }
}