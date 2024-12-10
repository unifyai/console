import { NextRequest, NextResponse } from 'next/server';
import { isDuplicateCard } from '@/lib/user/billing/free-credits';

export async function POST(request: NextRequest) {
  const userID = request.nextUrl.searchParams.get('userID');

  if (!userID) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {

    const body = await request.json();
    const { fingerprint } = body;

    if (!fingerprint || typeof fingerprint !== 'string') {
      return NextResponse.json({ error: 'Invalid fingerprint' }, { status: 400 });
    }

    const isDuplicate = await isDuplicateCard(userID, fingerprint);

    return NextResponse.json({ isDuplicate });
  } catch (error) {
    console.error('Error checking duplicate card:', error);
    return NextResponse.json({ error: 'Error checking duplicate card' }, { status: 500 });
  }
}
