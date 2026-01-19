import { NextRequest, NextResponse } from 'next/server';
import { buildCacheControl } from '../_utils/cacheResponse';
import { getApiKeyFromRequest, unauthorized } from '../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    // Note: The /v0/projects endpoint returns unknown in schema, but it's actually string[]
    const result = (await client.GET('/v0/projects', {})) as {
      data?: string[];
      error?: unknown;
      response: Response;
    };

    if (result.error) {
      return NextResponse.json(result.error, { status: result.response.status });
    }

    // Cache projects list for 5 minutes - rarely changes
    const cacheControl = buildCacheControl('LONG');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (cacheControl) headers['Cache-Control'] = cacheControl;

    return NextResponse.json(result.data, { status: 200, headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const { data, error, response } = await client.POST('/v0/project', {
      body: body,
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status: 502 });
  }
}
