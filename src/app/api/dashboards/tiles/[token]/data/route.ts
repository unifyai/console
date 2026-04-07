/**
 * Data Bridge Proxy Route
 *
 * Proxies data requests from tile iframes to Orchestra's admin data bridge.
 * Accepts camelCase param names from TileViewer and maps them to Orchestra's
 * snake_case /v0/logs query param names before forwarding.
 *
 * Mapping (same as tableData.ts / plotData.ts):
 *   filter       -> filter_expr
 *   columns      -> from_fields  (joined with &)
 *   excludeColumns -> exclude_fields (joined with &)
 *   orderBy + descending -> sorting (JSON dict)
 *   sorting      -> sorting (JSON stringified, overrides orderBy)
 *   groupBy      -> group_by
 *   columnContext -> column_context
 *   randomize    -> randomize
 */

import { NextRequest, NextResponse } from 'next/server';
import { camelToSnakeObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

interface BridgeRequestBody {
  context?: string;
  filter?: string;
  columns?: string[];
  excludeColumns?: string[];
  orderBy?: string;
  descending?: boolean;
  sorting?: Record<string, string>;
  limit?: number;
  offset?: number;
  groupBy?: string[];
  columnContext?: string;
  randomize?: boolean;
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  if (!ORCHESTRA_ADMIN_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: BridgeRequestBody;
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
  if (body.columns?.length) orchestraParams.columns = body.columns;
  if (body.excludeColumns?.length) orchestraParams.excludeColumns = body.excludeColumns;
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
    const res = await fetch(`${ORCHESTRA_URL}/v0/admin/dashboards/tiles/${params.token}/data`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orchestraBody),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: 'Bridge request failed' }));
      return NextResponse.json(
        { error: errorData.detail || 'Data bridge request failed' },
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
