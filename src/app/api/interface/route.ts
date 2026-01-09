import { NextRequest, NextResponse } from 'next/server';
import { buildCacheControl } from '../_utils/cacheResponse';
import { getApiKeyFromRequest, unauthorized } from '../_utils/auth';
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

  // Check if we're getting interface by ID, by path components, or listing interfaces
  const interfaceId = searchParams.get('interfaceId');
  const projectName = searchParams.get('projectName');
  const name = searchParams.get('name');

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    // Determine which endpoint to call based on parameters
    if (projectName && !name && !interfaceId) {
      // List interfaces for a project
      const { data, error, response } = await client.GET('/v0/interfaces/list', {
        params: {
          query: { project_name: projectName },
        },
      });

      if (DEBUG_API && !response.ok) {
        console.warn(
          JSON.stringify({
            route: '/api/interface',
            method: 'GET',
            endpoint: '/v0/interfaces/list',
            status: response.status,
            latencyMs: Date.now() - startedAt,
            correlationId,
          })
        );
      }

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      const cacheControl = buildCacheControl('MEDIUM');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (cacheControl) headers['Cache-Control'] = cacheControl;

      return NextResponse.json(data, { status: 200, headers });
    } else {
      // Get specific interface by ID or by project name + name
      const { data, error, response } = await client.GET('/v0/interfaces/', {
        params: {
          query: {
            interface_id: interfaceId || undefined,
            project_name: projectName || undefined,
            name: name || undefined,
          },
        },
      });

      if (DEBUG_API && !response.ok) {
        console.warn(
          JSON.stringify({
            route: '/api/interface',
            method: 'GET',
            endpoint: '/v0/interfaces/',
            status: response.status,
            latencyMs: Date.now() - startedAt,
            correlationId,
          })
        );
      }

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      const cacheControl = buildCacheControl('MEDIUM');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (cacheControl) headers['Cache-Control'] = cacheControl;

      return NextResponse.json(data, { status: 200, headers });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  const interfaceId = searchParams.get('interfaceId');
  const projectName = searchParams.get('projectName');
  const name = searchParams.get('name');

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    const { data, error, response } = await client.PUT('/v0/interfaces/', {
      params: {
        query: {
          interface_id: interfaceId || undefined,
          project_name: projectName || undefined,
          name: name || undefined,
        },
      },
      body: body,
    });

    if (DEBUG_API && !response.ok) {
      console.warn(
        JSON.stringify({
          route: '/api/interface',
          method: 'PUT',
          endpoint: '/v0/interfaces/',
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
    const status = /AbortError|aborted/i.test(msg) ? 504 : 502;
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

  // Check if this is a template operation
  const isExportTemplate = searchParams.has('export_template');
  const isImportTemplate = searchParams.has('import_template');

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    if (isExportTemplate) {
      const { data, error, response } = await client.POST('/v0/interfaces/export_template', {
        body: body,
      });

      if (DEBUG_API && !response.ok) {
        console.warn(
          JSON.stringify({
            route: '/api/interface',
            method: 'POST',
            endpoint: '/v0/interfaces/export_template',
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
    } else if (isImportTemplate) {
      const { data, error, response } = await client.POST('/v0/interfaces/import_template', {
        body: body,
      });

      if (DEBUG_API && !response.ok) {
        console.warn(
          JSON.stringify({
            route: '/api/interface',
            method: 'POST',
            endpoint: '/v0/interfaces/import_template',
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
    } else {
      // Regular interface creation
      const { data, error, response } = await client.POST('/v0/interfaces/', {
        body: body,
      });

      if (DEBUG_API && !response.ok) {
        console.warn(
          JSON.stringify({
            route: '/api/interface',
            method: 'POST',
            endpoint: '/v0/interfaces/',
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
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  const interfaceId = searchParams.get('interfaceId');
  const projectName = searchParams.get('projectName');
  const name = searchParams.get('name');

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    const { data, error, response } = await client.DELETE('/v0/interfaces/', {
      params: {
        query: {
          interface_id: interfaceId || undefined,
          project_name: projectName || undefined,
          name: name || undefined,
        },
      },
    });

    if (DEBUG_API && !response.ok) {
      console.warn(
        JSON.stringify({
          route: '/api/interface',
          method: 'DELETE',
          endpoint: '/v0/interfaces/',
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
    const status = /AbortError|aborted/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}
