import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

function allowedOrigins(): Set<string> {
  const configured = (process.env.LANDING_AUTH_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(
    [
      'https://usedroids.ai',
      'https://www.usedroids.ai',
      'https://unify.ai',
      'https://www.unify.ai',
      'https://staging.unify.ai',
      'https://internal.example.com',
      'http://localhost:3007',
      process.env.NEXT_PUBLIC_SITE_URL,
      ...configured,
    ].filter(Boolean) as string[]
  );
}

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    Vary: 'Origin',
  };

  if (origin && allowedOrigins().has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }

  return headers;
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.JWT_SECRET });
  const restrictedSignOut = (token as { restrictedSignOut?: boolean } | null)?.restrictedSignOut;

  return NextResponse.json(
    {
      authenticated: Boolean(token && !restrictedSignOut),
      redirectUrl: '/',
    },
    {
      headers: corsHeaders(request),
    }
  );
}
