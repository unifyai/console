import { NextRequest, NextResponse } from 'next/server';
import { buildCacheControl } from '../_utils/cacheResponse';
import { transformQueryParams } from '../_utils/casingTransform';
import { getCurrentUser } from '@/lib/user/user';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

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

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 60000);
  const startedAt = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  // Transform query params from camelCase to snake_case
  const snakeQuery = transformQueryParams(url);

  try {
    const res = await fetch(`${baseUrl}/logs${snakeQuery}`, {
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
            route: '/api/logs',
            method: 'GET',
            upstream: `${baseUrl}/logs${snakeQuery}`,
            status: res.status,
            latencyMs: Date.now() - startedAt,
            correlationId,
          })
        );
      }
    }

    // Parse and transform response from snake_case to camelCase
    const responseData = await res.json();
    const camelCaseData = snakeToCamelObject(responseData);

    if (!res.ok) {
      return NextResponse.json(camelCaseData, { status: res.status });
    }

    // Cache logs for 30 seconds - data changes frequently
    const cacheControl = buildCacheControl('SHORT');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (cacheControl) {
      headers['Cache-Control'] = cacheControl;
    }

    return NextResponse.json(camelCaseData, { status: 200, headers });
  } catch (e: any) {
    clearTimeout(ttl);
    const msg = e?.message || 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    console.error(
      JSON.stringify({
        route: '/api/logs',
        method: 'GET',
        upstream: `${baseUrl}/logs${snakeQuery}`,
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

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 60000);
  const startedAt = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody = camelToSnakeObject(body);

  try {
    const res = await fetch(`${baseUrl}/logs?deleteEmptyLogs=True`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(snakeCaseBody),
      signal: controller.signal,
    });
    clearTimeout(ttl);
    if (!res.ok) {
      if (DEBUG_API) {
        console.warn(
          JSON.stringify({
            route: '/api/logs',
            method: 'DELETE',
            upstream: `${baseUrl}/logs?deleteEmptyLogs=True`,
            status: res.status,
            latencyMs: Date.now() - startedAt,
            correlationId,
          })
        );
      }
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
        route: '/api/logs',
        method: 'DELETE',
        upstream: `${baseUrl}/logs?deleteEmptyLogs=True`,
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
  const body = await request.json();

  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 60000);
  const startedAt = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody = camelToSnakeObject(body);

  try {
    const res = await fetch(`${baseUrl}/logs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(snakeCaseBody),
      signal: controller.signal,
    });
    clearTimeout(ttl);
    if (!res.ok) {
      if (DEBUG_API) {
        console.warn(
          JSON.stringify({
            route: '/api/logs',
            method: 'POST',
            upstream: `${baseUrl}/logs`,
            status: res.status,
            latencyMs: Date.now() - startedAt,
            correlationId,
          })
        );
      }
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
        route: '/api/logs',
        method: 'POST',
        upstream: `${baseUrl}/logs`,
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
  // Get API key from session (fallback to header for backwards compatibility)
  const user = await getCurrentUser();
  const apiKey = user?.apiKey || request.headers.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ detail: 'Unauthorized - no API key' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    console.error('Failed to parse JSON body in PUT /api/logs:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const controller = new AbortController();
  const ttl = setTimeout(() => controller.abort(), 60000);
  const startedAt = Date.now();
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  // Transform camelCase keys to snake_case for Orchestra API
  const snakeCaseBody = camelToSnakeObject(body);

  try {
    const res = await fetch(`${baseUrl}/logs`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(snakeCaseBody),
      signal: controller.signal,
    });
    clearTimeout(ttl);
    if (!res.ok) {
      if (DEBUG_API) {
        console.warn(
          JSON.stringify({
            route: '/api/logs',
            method: 'PUT',
            upstream: `${baseUrl}/logs`,
            status: res.status,
            latencyMs: Date.now() - startedAt,
            correlationId,
          })
        );
      }
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
        route: '/api/logs',
        method: 'PUT',
        upstream: `${baseUrl}/logs`,
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
