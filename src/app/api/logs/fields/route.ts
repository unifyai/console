import { NextRequest, NextResponse } from 'next/server';
import { withCacheHeaders } from '../../_utils/cacheResponse';
import { transformQueryParams, transformBody } from '../../_utils/casingTransform';
import { getCurrentUser } from '@/lib/user/user';

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
  const ttl = setTimeout(() => controller.abort(), 60000); // 60s timeout - fields can be slow for large projects
  const startedAt = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const res = await fetch(`${baseUrl}/logs/fields${snakeQuery}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
        'x-correlation-id': correlationId,
      },
      signal: controller.signal,
    });
    clearTimeout(ttl);
    if (!res.ok) {
      if (DEBUG_API) {
        console.warn(
          JSON.stringify({
            route: '/api/logs/fields',
            method: 'GET',
            upstream: `${baseUrl}/logs/fields${snakeQuery}`,
            status: res.status,
            latencyMs: Date.now() - startedAt,
            correlationId,
          })
        );
      }
    }
    // Cache fields for 5 minutes - metadata changes infrequently
    return withCacheHeaders(res, 'LONG');
  } catch (e: any) {
    clearTimeout(ttl);
    const msg = e?.message || 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    console.error(
      JSON.stringify({
        route: '/api/logs/fields',
        method: 'GET',
        upstream: `${baseUrl}/logs/fields${snakeQuery}`,
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

export async function DELETE(request: NextRequest) {
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
    const res = await fetch(`${baseUrl}/logs/fields?deleteEmptyLogs=True`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(snakeBody),
      signal: controller.signal,
    });
    clearTimeout(ttl);
    if (!res.ok) {
      if (DEBUG_API) {
        console.warn(
          JSON.stringify({
            route: '/api/logs/fields',
            method: 'DELETE',
            upstream: `${baseUrl}/logs/fields?deleteEmptyLogs=True`,
            status: res.status,
            latencyMs: Date.now() - startedAt,
            correlationId,
          })
        );
      }
    }
    return res;
  } catch (e: any) {
    clearTimeout(ttl);
    const msg = e?.message || 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    console.error(
      JSON.stringify({
        route: '/api/logs/fields',
        method: 'DELETE',
        upstream: `${baseUrl}/logs/fields?deleteEmptyLogs=True`,
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

export async function PATCH(request: NextRequest) {
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
    const res = await fetch(`${baseUrl}/logs/rename_field`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(snakeBody),
      signal: controller.signal,
    });
    clearTimeout(ttl);
    if (!res.ok) {
      if (DEBUG_API) {
        console.warn(
          JSON.stringify({
            route: '/api/logs/fields',
            method: 'PATCH',
            upstream: `${baseUrl}/logs/rename_field`,
            status: res.status,
            latencyMs: Date.now() - startedAt,
            correlationId,
          })
        );
      }
    }
    return res;
  } catch (e: any) {
    clearTimeout(ttl);
    const msg = e?.message || 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    console.error(
      JSON.stringify({
        route: '/api/logs/fields',
        method: 'PATCH',
        upstream: `${baseUrl}/logs/rename_field`,
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
