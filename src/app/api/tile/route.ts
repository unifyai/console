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

  const tileId = searchParams.get('tileId');
  const tabId = searchParams.get('tabId');
  const name = searchParams.get('name');

  try {
    // Determine which endpoint to call based on parameters
    if (tabId && !tileId && !name) {
      // List tiles for a tab
      const { data, error, response } = await client.GET('/v0/tile/list', {
        params: {
          query: { tab_id: tabId },
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
      // Get specific tile by ID or by tab + name
      const { data, error, response } = await client.GET('/v0/tile/', {
        params: {
          query: {
            tile_id: tileId || undefined,
            tab_id: tabId || undefined,
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
      const { data, error, response } = await client.POST('/v0/tile/export_template', {
        body: body,
      });

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data, { status: response.status });
    } else if (isImportTemplate) {
      const { data, error, response } = await client.POST('/v0/tile/import_template', {
        body: body,
      });

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data, { status: response.status });
    } else {
      // Regular tile creation
      const { data, error, response } = await client.POST('/v0/tile/', {
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

  const tileId = searchParams.get('tileId');
  const tabId = searchParams.get('tabId');
  const name = searchParams.get('name');

  try {
    const { data, error, response } = await client.PUT('/v0/tile/', {
      params: {
        query: {
          tile_id: tileId || undefined,
          tab_id: tabId || undefined,
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

  const tileId = searchParams.get('tileId');
  const tabId = searchParams.get('tabId');
  const name = searchParams.get('name');

  try {
    const { data, error, response } = await client.DELETE('/v0/tile/', {
      params: {
        query: {
          tile_id: tileId || undefined,
          tab_id: tabId || undefined,
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

  const tileId = searchParams.get('tileId');
  const tabId = searchParams.get('tabId');
  const name = searchParams.get('name');
  const tileType = searchParams.get('tile_type');

  try {
    if (tileType) {
      // Specialized tile patch
      const { data, error, response } = await client.PATCH('/v0/tile/specialized', {
        params: {
          query: {
            tile_id: tileId || undefined,
            tab_id: tabId || undefined,
            name: name || undefined,
            tile_type: tileType,
          },
        },
        body: body,
      });

      if (error) {
        return NextResponse.json(error, { status: response.status });
      }

      return NextResponse.json(data, { status: response.status });
    } else {
      // Regular tile update - use PUT since there's no PATCH without tile_type
      const { data, error, response } = await client.PUT('/v0/tile/', {
        params: {
          query: {
            tile_id: tileId || undefined,
            tab_id: tabId || undefined,
            name: name || undefined,
          },
        },
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
