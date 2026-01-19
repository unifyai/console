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

  const project = searchParams.get('project');

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    const { data, error, response } = await client.GET('/v0/logs/latest_timestamp', {
      params: {
        query: {
          project_name: project || '',
        },
      },
    });

    if (DEBUG_API && !response.ok) {
      console.warn(
        JSON.stringify({
          route: '/api/logs/latest_timestamp',
          method: 'GET',
          endpoint: '/v0/logs/latest_timestamp',
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
