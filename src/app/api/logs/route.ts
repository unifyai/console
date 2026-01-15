import { NextRequest, NextResponse } from 'next/server';
import { buildCacheControl } from '../_utils/cacheResponse';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../_utils/auth';
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

  // Extract query params for the logs endpoint
  // Support both camelCase (frontend) and snake_case (legacy) param names
  const projectName = searchParams.get('projectName') || searchParams.get('project') || '';
  const context = searchParams.get('context') || undefined;
  const columnContext =
    searchParams.get('columnContext') || searchParams.get('column_context') || undefined;
  const filterExpr = searchParams.get('filterExpr') || searchParams.get('filter_expr') || undefined;
  const sorting = searchParams.get('sorting') || undefined;
  const groupBy = searchParams.getAll('groupBy'); // Can have multiple values
  const groupSorting =
    searchParams.get('groupSorting') || searchParams.get('group_sorting') || undefined;
  const fromIds = searchParams.get('fromIds') || searchParams.get('from_ids') || undefined;
  const fromFields = searchParams.get('fromFields') || searchParams.get('from_fields') || undefined;
  const excludeFields =
    searchParams.get('excludeFields') || searchParams.get('exclude_fields') || undefined;
  const limit = searchParams.get('limit') || undefined;
  const offset = searchParams.get('offset') || undefined;
  const groupLimit = searchParams.get('groupLimit') || searchParams.get('group_limit') || undefined;
  const groupOffset =
    searchParams.get('groupOffset') || searchParams.get('group_offset') || undefined;
  const groupDepth = searchParams.get('groupDepth') || searchParams.get('group_depth') || undefined;
  const returnIdsOnly =
    searchParams.get('returnIdsOnly') || searchParams.get('return_ids_only') || undefined;
  const randomize = searchParams.get('randomize') || undefined;
  const tags = searchParams.get('tags') || undefined;
  const startTime = searchParams.get('startTime') || searchParams.get('start_time') || undefined;
  const endTime = searchParams.get('endTime') || searchParams.get('end_time') || undefined;

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    const { data, error, response } = await client.GET('/v0/logs', {
      params: {
        query: {
          project_name: projectName,
          context: context,
          column_context: columnContext,
          filter_expr: filterExpr,
          sorting: sorting,
          group_by: groupBy.length > 0 ? groupBy : undefined,
          group_sorting: groupSorting,
          from_ids: fromIds,
          from_fields: fromFields,
          exclude_fields: excludeFields,
          limit: limit ? parseInt(limit, 10) : undefined,
          offset: offset ? parseInt(offset, 10) : undefined,
          group_limit: groupLimit ? parseInt(groupLimit, 10) : undefined,
          group_offset: groupOffset ? parseInt(groupOffset, 10) : undefined,
          group_depth: groupDepth ? parseInt(groupDepth, 10) : undefined,
          return_ids_only: returnIdsOnly === 'true' ? true : undefined,
          randomize: randomize === 'true' ? true : undefined,
          tags: tags,
          start_time: startTime,
          end_time: endTime,
        },
      },
    });

    if (DEBUG_API && !response.ok) {
      console.warn(
        JSON.stringify({
          route: '/api/logs',
          method: 'GET',
          endpoint: '/v0/logs',
          status: response.status,
          latencyMs: Date.now() - startedAt,
          correlationId,
        })
      );
    }

    if (error) {
      return NextResponse.json(error, { status: response.status });
    }

    // Cache logs for 30 seconds - data changes frequently
    const cacheControl = buildCacheControl('SHORT');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (cacheControl) headers['Cache-Control'] = cacheControl;

    return NextResponse.json(data, { status: 200, headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  // Support both camelCase (frontend) and snake_case input
  const projectName = body.projectName || body.project_name || '';
  const context = body.context || undefined;
  const idsAndFields = body.idsAndFields || body.ids_and_fields || [];
  const sourceType = body.sourceType || body.source_type || 'all';
  const deleteEmptyLogs = body.deleteEmptyLogs ?? body.delete_empty_logs ?? false;
  const deleteEmptyFields = body.deleteEmptyFields ?? body.delete_empty_fields ?? true;

  const orchestraUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    // Use direct fetch for DELETE because openapi-fetch doesn't properly send body for DELETE requests
    const response = await fetch(`${orchestraUrl}/v0/logs`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        project_name: projectName,
        context: context,
        ids_and_fields: idsAndFields,
        source_type: sourceType,
        delete_empty_logs: deleteEmptyLogs,
        delete_empty_fields: deleteEmptyFields,
      }),
    });

    const data = await response.json().catch(() => null);

    if (DEBUG_API && !response.ok) {
      console.warn(
        JSON.stringify({
          route: '/api/logs',
          method: 'DELETE',
          endpoint: '/v0/logs',
          status: response.status,
          latencyMs: Date.now() - startedAt,
          correlationId,
        })
      );
    }

    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Delete failed' }, { status: response.status });
    }

    return NextResponse.json(data ?? { success: true }, { status: response.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    const status = /AbortError|aborted|timeout/i.test(msg) ? 504 : 502;
    return NextResponse.json({ detail: `Upstream error: ${msg}` }, { status });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const client = createOrchestraClient(apiKey);

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    const { data, error, response } = await client.POST('/v0/logs', {
      body: body,
    });

    if (DEBUG_API && !response.ok) {
      console.warn(
        JSON.stringify({
          route: '/api/logs',
          method: 'POST',
          endpoint: '/v0/logs',
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

export async function PUT(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body');
  }

  const client = createOrchestraClient(apiKey);

  try {
    const startedAt = Date.now();
    const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

    const { data, error, response } = await client.PUT('/v0/logs', {
      body: body,
    });

    if (DEBUG_API && !response.ok) {
      console.warn(
        JSON.stringify({
          route: '/api/logs',
          method: 'PUT',
          endpoint: '/v0/logs',
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
