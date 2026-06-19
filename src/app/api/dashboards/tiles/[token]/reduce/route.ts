/**
 * Reduce Bridge Proxy Route
 *
 * Proxies reduce (aggregation) requests from tile iframes to Orchestra's
 * admin reduce bridge. Maps to UnifyData.reduce() -> DM.reduce().
 *
 * Orchestra endpoint: POST /v0/admin/dashboards/tiles/{token}/reduce
 */

import { NextRequest, NextResponse } from 'next/server';
import { camelToSnakeObject } from '@/utils/casing';
import type { ReduceBridgeBody } from '@/types/assistants/bridge';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!ORCHESTRA_ADMIN_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: ReduceBridgeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.context) {
    return NextResponse.json({ error: 'context is required' }, { status: 400 });
  }
  if (!body.metric) {
    return NextResponse.json({ error: 'metric is required' }, { status: 400 });
  }
  if (!body.columns) {
    return NextResponse.json({ error: 'columns is required' }, { status: 400 });
  }

  const orchestraParams: Record<string, unknown> = {
    context: body.context,
    metric: body.metric,
    columns: body.columns,
  };
  if (body.filter) orchestraParams.filter = body.filter;
  if (body.groupBy?.length) orchestraParams.groupBy = body.groupBy;
  if (body.resultWhere) orchestraParams.resultWhere = body.resultWhere;

  const orchestraBody = camelToSnakeObject(orchestraParams);

  try {
    const res = await fetch(`${ORCHESTRA_URL}/v0/admin/dashboards/tiles/${token}/reduce`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orchestraBody),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorData: Record<string, unknown>;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { detail: errorText.slice(0, 200) };
      }
      return NextResponse.json(
        { error: errorData.detail || 'Reduce bridge request failed' },
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
