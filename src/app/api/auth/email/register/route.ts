import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/email/register
 *
 * Proxies email registration to Orchestra's admin auth endpoint.
 * Keeps the admin API key server-side — the browser never sees it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await OrchestraAdminClient.post('/auth/register', body);
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ?? rawData ?? { error: 'registration_failed', message: 'Registration failed' };
    return NextResponse.json(data, { status });
  }
}

