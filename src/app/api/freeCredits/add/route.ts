import { NextRequest, NextResponse } from 'next/server';
import { addFreeCredits } from '@/lib/user/billing/free-credits';

export async function POST(request: NextRequest) {
  const userID = request.nextUrl.searchParams.get('userID');

  if (!userID) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { amount } = body;

    const amountValue = Number(amount);

    if (isNaN(amountValue) || amountValue <= 0) {
      return NextResponse.json({ error: 'Invalid amount value' }, { status: 400 });
    }

    await addFreeCredits(userID, amountValue);

    return NextResponse.json({ message: 'Free credits added successfully' });
  } catch (error) {
    console.error('Error adding free credits:', error);
    return NextResponse.json({ error: 'Error adding free credits' }, { status: 500 });
  }
}
