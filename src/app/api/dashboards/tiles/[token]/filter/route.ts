/**
 * Filter Bridge Proxy Route
 *
 * Proxies filter (row-level query) requests from tile iframes to Orchestra's
 * admin filter bridge. Maps to UnifyData.filter() -> DM.filter().
 *
 * Mapping (same as tableData.ts / plotData.ts):
 *   filter       -> Orchestra boolean expression
 *   columns      -> from_fields  (joined with &)
 *   excludeColumns -> exclude_fields (joined with &)
 *   orderBy + descending -> sorting (JSON dict)
 *   sorting      -> sorting (JSON stringified, overrides orderBy)
 *   groupBy      -> group_by
 *   columnContext -> column_context
 *   randomize    -> randomize
 *
 * Orchestra endpoint: POST /v0/admin/dashboards/tiles/{token}/filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { camelToSnakeObject } from '@/utils/casing';
import type { FilterBridgeBody } from '@/types/assistants/bridge';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

function joinFields(fields: string[] | undefined): string | undefined {
  return fields?.length ? fields.join('&') : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!ORCHESTRA_ADMIN_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: FilterBridgeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.context) {
    return NextResponse.json({ error: 'context is required' }, { status: 400 });
  }

  const orchestraParams: Record<string, unknown> = {
    context: body.context,
  };
  if (body.filter) orchestraParams.filter = body.filter;
  const columns = joinFields(body.columns);
  if (columns) orchestraParams.columns = columns;
  const excludeColumns = joinFields(body.excludeColumns);
  if (excludeColumns) orchestraParams.excludeColumns = excludeColumns;
  if (body.sorting) {
    orchestraParams.sorting = JSON.stringify(body.sorting);
  } else if (body.orderBy) {
    orchestraParams.sorting = JSON.stringify({
      [body.orderBy]: body.descending ? 'descending' : 'ascending',
    });
  }
  if (body.limit != null) orchestraParams.limit = body.limit;
  if (body.offset != null) orchestraParams.offset = body.offset;
  if (body.groupBy?.length) orchestraParams.groupBy = body.groupBy;
  if (body.columnContext) orchestraParams.columnContext = body.columnContext;
  if (body.randomize != null) orchestraParams.randomize = body.randomize;

  const orchestraBody = camelToSnakeObject(orchestraParams);

  try {
    const res = await fetch(`${ORCHESTRA_URL}/v0/admin/dashboards/tiles/${token}/filter`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orchestraBody),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: 'Filter bridge request failed' }));
      return NextResponse.json(
        { error: errorData.detail || 'Filter bridge request failed' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
