import { confirmPhoneVerification } from '@/lib/user/user';
import { getCurrentUser } from '@/lib/user/user';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ detail: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { phoneNumber, phoneType, code } = body;

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { detail: 'phoneNumber and code are required.' },
        { status: 400 }
      );
    }

    const result = await confirmPhoneVerification(
      sessionUser.id, phoneNumber, code, phoneType || 'phone'
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ detail: 'Internal server error.' }, { status: 500 });
  }
}
