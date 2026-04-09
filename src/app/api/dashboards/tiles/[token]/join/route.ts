/**
 * Join Bridge Proxy Route
 *
 * Proxies cross-context join requests from tile iframes to Orchestra's
 * admin join bridge. Maps to UnifyData.join() -> DM.filter_join().
 *
 * Orchestra endpoint: POST /v0/admin/dashboards/tiles/{token}/join
 */

import { NextRequest, NextResponse } from 'next/server';
import { camelToSnakeObject } from '@/utils/casing';
import type { JoinBridgeBody } from '@/types/assistants/bridge';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const ORCHESTRA_ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  if (!ORCHESTRA_ADMIN_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: JoinBridgeBody;
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

  const orchestraParams: Record<string, unknown> = {
    tables: body.tables,
    joinExpr: body.joinExpr,
    select: body.select,
  };
  if (body.mode) orchestraParams.mode = body.mode;
  if (body.leftWhere) orchestraParams.leftWhere = body.leftWhere;
  if (body.rightWhere) orchestraParams.rightWhere = body.rightWhere;
  if (body.resultWhere) orchestraParams.resultWhere = body.resultWhere;
  if (body.resultLimit != null) orchestraParams.resultLimit = body.resultLimit;
  if (body.resultOffset != null) orchestraParams.resultOffset = body.resultOffset;

  const orchestraBody = camelToSnakeObject(orchestraParams);

  try {
    const res = await fetch(`${ORCHESTRA_URL}/v0/admin/dashboards/tiles/${params.token}/join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ORCHESTRA_ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orchestraBody),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: 'Join bridge request failed' }));
      return NextResponse.json(
        { error: errorData.detail || 'Join bridge request failed' },
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
