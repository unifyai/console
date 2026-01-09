import { NextRequest, NextResponse } from 'next/server';
import { transformQueryParams, transformBody } from '../../_utils/casingTransform';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const DEBUG_API = process.env.NEXT_PUBLIC_DEBUG_API_ROUTES === 'true';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Transform query params to snake_case for Orchestra
  const snakeQuery = transformQueryParams(url);

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 60000);
  const startedAt = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const res = await fetch(`${baseUrl}/tile/checkpoint${snakeQuery}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
        'x-correlation-id': correlationId,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(ttl);
    if (!res.ok && DEBUG_API) {
      console.warn(
        JSON.stringify({
          route: '/api/tile/checkpoint',
          method: 'GET',
          upstream: `${baseUrl}/tile/checkpoint${snakeQuery}`,
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
        route: '/api/tile/checkpoint',
        method: 'GET',
        upstream: `${baseUrl}/tile/checkpoint${snakeQuery}`,
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

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const body = await request.json();

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Transform to snake_case for Orchestra
  const snakeQuery = transformQueryParams(url);
  const snakeBody = transformBody(body);

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 60000);
  const startedAt = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const res = await fetch(`${baseUrl}/tile/checkpoint${snakeQuery}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(snakeBody),
      signal: controller.signal,
    });
    clearTimeout(ttl);
    if (!res.ok && DEBUG_API) {
      console.warn(
        JSON.stringify({
          route: '/api/tile/checkpoint',
          method: 'POST',
          upstream: `${baseUrl}/tile/checkpoint${snakeQuery}`,
          status: res.status,
          latencyMs: Date.now() - startedAt,
          correlationId,
        })
      );
    }

    // Parse and transform response from snake_case to camelCase
    const text = await res.text();
    if (!text) {
      return NextResponse.json({ success: true }, { status: res.status });
    }
    const responseData = JSON.parse(text);
    const camelCaseData = snakeToCamelObject(responseData);

    return NextResponse.json(camelCaseData, { status: res.status });
  } catch (e: any) {
    clearTimeout(ttl);
    const msg = e?.message || 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    console.error(
      JSON.stringify({
        route: '/api/tile/checkpoint',
        method: 'POST',
        upstream: `${baseUrl}/tile/checkpoint${snakeQuery}`,
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
