import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';
import { buildCacheControl } from '../../_utils/cacheResponse';

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, response } = await client.GET('/v0/projects/tree');

    if (!response.ok) {
      return NextResponse.json(
        { detail: 'Failed to fetch project tree' },
        { status: response.status }
      );
    }

    // Build response with caching headers (5 minutes - tree rarely changes)
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const cacheControl = buildCacheControl('LONG');
    if (cacheControl) {
      headers['Cache-Control'] = cacheControl;
    }

    return NextResponse.json(data, { status: response.status, headers });
  } catch {
    return NextResponse.json({ detail: 'Failed to fetch project tree' }, { status: 500 });
  }
}
