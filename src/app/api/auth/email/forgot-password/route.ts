import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/email/forgot-password
 *
 * Initiates the password reset flow. Always returns 200 to prevent
 * email enumeration — Orchestra handles the same behavior server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await OrchestraAdminClient.post('/auth/forgot-password', body);
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    // Always return 200 to prevent email enumeration
    return NextResponse.json(
      { message: 'If an account exists with that email, a reset code has been sent.' },
      { status: 200 }
    );
  }
}

