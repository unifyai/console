import { sendPhoneVerification } from '@/lib/user/user';
import { getCurrentUser } from '@/lib/user/user';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ detail: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { phoneNumber, phoneType } = body;

    if (!phoneNumber) {
      return NextResponse.json({ detail: 'phoneNumber is required.' }, { status: 400 });
    }

    const result = await sendPhoneVerification(sessionUser.id, phoneNumber, phoneType || 'phone');
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ detail: 'Internal server error.' }, { status: 500 });
  }
}
