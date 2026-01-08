import { NextRequest, NextResponse } from 'next/server';
import { withCacheHeaders } from '../_utils/cacheResponse';
import { transformBody } from '../_utils/casingTransform';
import { getCurrentUser } from '@/lib/user/user';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;

export async function GET(request: NextRequest) {
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const upstreamResponse = await fetch(`${baseUrl}/projects`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
    },
  });

  // Cache projects list for 5 minutes - rarely changes
  return withCacheHeaders(upstreamResponse, 'LONG');
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Transform body to snake_case for Orchestra
  const snakeBody = transformBody(body);

  return await fetch(`${baseUrl}/project`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snakeBody),
  });
}
