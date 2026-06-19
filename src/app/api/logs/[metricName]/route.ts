import { NextRequest, NextResponse } from 'next/server';
import { transformQueryParams } from '../../_utils/casingTransform';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const DEBUG_API = process.env.NEXT_PUBLIC_DEBUG_API_ROUTES === 'true';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ metricName: string }> }
) {
  const { metricName } = await params;
  const url = new URL(request.url);

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 60000);
  const startedAt = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  // Transform query params from camelCase to snake_case
  const snakeQuery = transformQueryParams(url);

  try {
    const res = await fetch(`${baseUrl}/logs/metric/${metricName}${snakeQuery}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
        'x-correlation-id': correlationId,
      },
      signal: controller.signal,
    });
    clearTimeout(ttl);
    if (!res.ok && DEBUG_API) {
      console.warn(
        JSON.stringify({
          route: '/api/logs/[metricName]',
          method: 'GET',
          upstream: `${baseUrl}/logs/metric/${metricName}${snakeQuery}`,
          status: res.status,
          latencyMs: Date.now() - startedAt,
          correlationId,
        })
      );
    }

    // Parse and transform response from snake_case to camelCase
    const responseData = await res.json();
    const camelCaseData = snakeToCamelObject(responseData);

    return NextResponse.json(camelCaseData, { status: res.status });
  } catch (e: any) {
    clearTimeout(ttl);
    const msg = e?.message || 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    console.error(
      JSON.stringify({
        route: '/api/logs/[metricName]',
        method: 'GET',
        upstream: `${baseUrl}/logs/metric/${metricName}${snakeQuery}`,
        error: msg,
        latencyMs: Date.now() - startedAt,
        correlationId,
      })
    );
    return NextResponse.json(
      { detail: `Upstream ${status === 504 ? 'timeout' : 'error'}: ${msg}` },
      { status }
    );
  }
}
