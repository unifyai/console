import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

const DEBUG_API = process.env.NEXT_PUBLIC_DEBUG_API_ROUTES === 'true';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  const tileId = searchParams.get('tileId');
  const tabId = searchParams.get('tabId');
  const name = searchParams.get('name');

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    const { data, error, response } = await client.GET('/v0/tile/checkpoint', {
      params: {
        query: {
          tile_id: tileId || undefined,
          tab_id: tabId || undefined,
          name: name || undefined,
        },
      },
    });

    if (DEBUG_API && !response.ok) {
      console.warn(
        JSON.stringify({
          route: '/api/tile/checkpoint',
          method: 'GET',
          endpoint: '/v0/tile/checkpoint',
          status: response.status,
          latencyMs: Date.now() - startedAt,
          correlationId,
        })
      );
    }

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const body = await request.json();

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  const tileId = searchParams.get('tileId');
  const tabId = searchParams.get('tabId');
  const name = searchParams.get('name');

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    const { data, error, response } = await client.POST('/v0/tile/checkpoint', {
      params: {
        query: {
          tile_id: tileId || undefined,
          tab_id: tabId || undefined,
          name: name || undefined,
        },
      },
      body: body,
    });

    if (DEBUG_API && !response.ok) {
      console.warn(
        JSON.stringify({
          route: '/api/tile/checkpoint',
          method: 'POST',
          endpoint: '/v0/tile/checkpoint',
          status: response.status,
          latencyMs: Date.now() - startedAt,
          correlationId,
        })
      );
    }

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
