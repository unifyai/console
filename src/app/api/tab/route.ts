import { NextRequest, NextResponse } from 'next/server';
import { buildCacheControl } from '../_utils/cacheResponse';
import { getApiKeyFromRequest, unauthorized } from '../_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  const tabId = searchParams.get('tabId');
  const interfaceId = searchParams.get('interfaceId');
  const name = searchParams.get('name');

  try {
    // Determine which endpoint to call based on parameters
    if (interfaceId && !tabId && !name) {
      // List tabs for an interface
      const { data, error, response } = await client.GET('/v0/tab/list', {
        params: {
          query: { interface_id: interfaceId },
        },
      });

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      const cacheControl = buildCacheControl('MEDIUM');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (cacheControl) headers['Cache-Control'] = cacheControl;

      return NextResponse.json(data, { status: 200, headers });
    } else {
      // Get specific tab by ID or by interface + name
      const { data, error, response } = await client.GET('/v0/tab/', {
        params: {
          query: {
            tab_id: tabId || undefined,
            interface_id: interfaceId || undefined,
            name: name || undefined,
          },
        },
      });

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
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status: 502 });
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
    if (isExportTemplate) {
      const { data, error, response } = await client.POST('/v0/tab/export_template', {
        body: body,
      });

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data, { status: response.status });
    } else if (isImportTemplate) {
      const { data, error, response } = await client.POST('/v0/tab/import_template', {
        body: body,
      });

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data, { status: response.status });
    } else {
      // Regular tab creation
      const { data, error, response } = await client.POST('/v0/tab/', {
        body: body,
      });

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data, { status: response.status });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status: 502 });
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

  const tabId = searchParams.get('tabId');
  const interfaceId = searchParams.get('interfaceId');
  const name = searchParams.get('name');

  try {
    const { data, error, response } = await client.PUT('/v0/tab/', {
      params: {
        query: {
          tab_id: tabId || undefined,
          interface_id: interfaceId || undefined,
          name: name || undefined,
        },
      },
      body: body,
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status: 502 });
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

  const tabId = searchParams.get('tabId');
  const interfaceId = searchParams.get('interfaceId');
  const name = searchParams.get('name');

  try {
    const { data, error, response } = await client.DELETE('/v0/tab/', {
      params: {
        query: {
          tab_id: tabId || undefined,
          interface_id: interfaceId || undefined,
          name: name || undefined,
        },
      },
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

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  const tabId = searchParams.get('tabId');
  const interfaceId = searchParams.get('interfaceId');
  const name = searchParams.get('name');

  try {
    const { data, error, response } = await client.PATCH('/v0/tab', {
      params: {
        query: {
          tab_id: tabId || undefined,
          interface_id: interfaceId || undefined,
          name: name || undefined,
        },
      },
      body: body,
    });

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status: 502 });
  }
}
