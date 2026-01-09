import { NextRequest, NextResponse } from 'next/server';
import { transformBody } from '../../_utils/casingTransform';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

const baseUrl = `${process.env.ORCHESTRA_URL}/v0`;
const DEBUG_API = process.env.NEXT_PUBLIC_DEBUG_API_ROUTES === 'true';

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

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 60000);
  const startedAt = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const res = await fetch(`${baseUrl}/logs/derived`, {
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
          route: '/api/logs/derived',
          method: 'POST',
          upstream: `${baseUrl}/logs/derived`,
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
        route: '/api/logs/derived',
        method: 'POST',
        upstream: `${baseUrl}/logs/derived`,
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

export async function PUT(request: NextRequest) {
  const body = await request.json();

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  // Transform body to snake_case for Orchestra
  const snakeBody = transformBody(body);

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 60000);
  const startedAt = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const res = await fetch(`${baseUrl}/logs/derived`, {
      method: 'PUT',
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
          route: '/api/logs/derived',
          method: 'PUT',
          upstream: `${baseUrl}/logs/derived`,
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
        route: '/api/logs/derived',
        method: 'PUT',
        upstream: `${baseUrl}/logs/derived`,
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
