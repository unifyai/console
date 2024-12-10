import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/app/api/auth/[...nextauth]/options';
import { getStoredCards } from '@/lib/user/billing/free-credits';

export async function GET(request: NextRequest) {
  const userID = request.nextUrl.searchParams.get('userID');

  if (!userID) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const storedCards = await getStoredCards(userID);

    return NextResponse.json({ storedCards });
  } catch (error) {
    console.error('Error retrieving stored cards:', error);
    return NextResponse.json({ error: 'Error retrieving stored cards' }, { status: 500 });
  }
}