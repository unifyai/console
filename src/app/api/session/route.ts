import { getSession } from '@/lib/user/user';
import { NextRequest, NextResponse } from 'next/server';

function allowedOrigin(origin: string | null): string {
  const configured = (process.env.LANDING_AUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = new Set(
    [
      'https://unify.ai',
      'https://www.unify.ai',
      'https://staging.unify.ai',
      'https://internal.example.com',
      process.env.NEXT_PUBLIC_SITE_URL,
      ...configured,
    ].filter(Boolean) as string[]
  );

  return origin && allowed.has(origin) ? origin : 'https://unify.ai';
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const origin = allowedOrigin(req.headers.get('origin'));
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (session) {
    // User is authenticated
    return NextResponse.json({ session }, { status: 200, headers: headers });
  } else {
    // User is not authenticated
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: headers });
  }
}
