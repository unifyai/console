import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/email/authenticate
 *
 * Pre-validates email + password credentials via Orchestra before
 * the frontend calls NextAuth's signIn("credentials").
 *
 * This gives the frontend specific error codes (wrong password,
 * no email account, provider hints) that NextAuth's CredentialsProvider
 * cannot propagate through authorize().
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await OrchestraAdminClient.post('/auth/authenticate', body);
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ?? rawData ?? { error: 'auth_failed', message: 'Authentication failed' };
    return NextResponse.json(data, { status });
  }
}

