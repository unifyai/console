import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/email/change-password
 *
 * Changes the password for the currently authenticated user.
 * Requires a valid session (user API key).
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const client = await getOrchestraUserClient(apiKey);
    const res = await client.post('/auth/change-password', body);
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ?? rawData ?? { error: 'change_failed', message: 'Password change failed' };
    return NextResponse.json(data, { status });
  }
}

