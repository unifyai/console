/**
 * Canvas data proxy.
 *
 * The frame asks its parent for a binding alias; the parent asks this route; this
 * route authorizes the viewer and then asks Orchestra to run the binding stored
 * on the canvas record.
 *
 * Nothing about the query travels with the request. The body carries an alias and
 * the path carries a token, so the most a compromised canvas can do is name one
 * of its own declared bindings. That is the difference between this and the tile
 * bridge it replaces, which accepts a context path and a filter expression from
 * the browser.
 *
 * Orchestra endpoint: POST /v0/admin/canvas/{token}/query
 */

import { NextRequest, NextResponse } from 'next/server';

import { authorizeCanvasRead, queryCanvasAlias } from '@/lib/canvas/canvasAccess';

/** Binding aliases are JavaScript identifiers. */
const ALIAS_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const access = await authorizeCanvasRead(request, token);
  if (!access.ok) {
    return NextResponse.json({ error: access.denial.error }, { status: access.denial.status });
  }

  let alias: unknown;
  try {
    ({ alias } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof alias !== 'string' || !ALIAS_PATTERN.test(alias)) {
    return NextResponse.json({ error: 'Invalid binding alias' }, { status: 400 });
  }

  const result = await queryCanvasAlias(token, alias);
  if (!result.ok) {
    return NextResponse.json({ error: result.denial.error }, { status: result.denial.status });
  }

  return NextResponse.json({ alias, rows: result.rows, truncated: result.truncated });
}
