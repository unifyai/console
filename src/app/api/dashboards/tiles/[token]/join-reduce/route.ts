/**
 * Join-Reduce Bridge Proxy Route
 *
 * Proxies cross-context join + aggregation requests from tile iframes to
 * Orchestra's admin join-reduce bridge.
 * Maps to UnifyData.joinReduce() -> DM.reduce_join().
 *
 * Orchestra endpoint: POST /v0/admin/dashboards/tiles/{token}/join-reduce
 */

import { NextRequest, NextResponse } from 'next/server';
import type { JoinReduceBridgeBody } from '@/types/assistants/bridge';
import { aliasJoinPaths } from '@/utils/assistants/join-alias';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  if (!ORCHESTRA_ADMIN_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: JoinReduceBridgeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.tables?.length || body.tables.length !== 2) {
    return NextResponse.json(
      { error: 'tables must contain exactly 2 context paths' },
      { status: 400 }
    );
  }
  if (!body.joinExpr) {
    return NextResponse.json({ error: 'joinExpr is required' }, { status: 400 });
  }
  if (!body.select || Object.keys(body.select).length === 0) {
    return NextResponse.json({ error: 'select is required' }, { status: 400 });
  }
  if (!body.metric) {
    return NextResponse.json({ error: 'metric is required' }, { status: 400 });
  }
  if (!body.columns) {
    return NextResponse.json({ error: 'columns is required' }, { status: 400 });
  }

  const aliased = aliasJoinPaths(
    body.tables as [string, string],
    body.joinExpr,
    body.select,
    body.resultWhere
  );

  const orchestraBody: Record<string, unknown> = {
    tables: body.tables,
    join_expr: aliased.joinExpr,
    select: aliased.select,
    metric: body.metric,
    columns: body.columns,
  };
  if (body.mode) orchestraBody.mode = body.mode;
  if (body.leftWhere) orchestraBody.left_where = body.leftWhere;
  if (body.rightWhere) orchestraBody.right_where = body.rightWhere;
  if (body.groupBy?.length) orchestraBody.group_by = body.groupBy;
  if (aliased.resultWhere) orchestraBody.result_where = aliased.resultWhere;

  try {
    const res = await fetch(
      `${ORCHESTRA_URL}/v0/admin/dashboards/tiles/${params.token}/join-reduce`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orchestraBody),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      let errorData: Record<string, unknown>;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { detail: errorText.slice(0, 500) };
      }
      return NextResponse.json(
        { error: errorData.detail || 'Join-reduce bridge request failed' },
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
