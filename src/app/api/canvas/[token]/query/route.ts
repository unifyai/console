/**
 * Canvas data proxy.
 *
 * The frame asks its parent for binding aliases; the parent batches what one
 * mount requests and asks this route once; this route authorizes the viewer and
 * then asks Orchestra to run the bindings stored on the canvas record.
 *
 * Nothing about the queries travels with the request. The body carries aliases
 * and the path carries a token, so the most a compromised canvas can do is name
 * its own declared bindings. That is the difference between this and the tile
 * bridge it replaces, which accepts a context path and a filter expression from
 * the browser.
 *
 * Failures inside the batch are per-alias entries in a 200, mirroring
 * Orchestra: one broken binding must not blank the panels whose bindings are
 * fine. Only what applies to the whole canvas — an unauthorized viewer, an
 * unknown token, an unpublished record — fails the request.
 *
 * Orchestra endpoint: POST /v0/admin/canvas/{token}/queries
 */

import { NextRequest, NextResponse } from 'next/server';

import { authorizeCanvasRead, queryCanvasAliases } from '@/lib/canvas/canvasAccess';

/** Binding aliases are JavaScript identifiers. */
const ALIAS_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;

/** Matches the batch ceiling Orchestra enforces on its own schema. */
const MAX_ALIASES = 32;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const access = await authorizeCanvasRead(request, token);
  if (!access.ok) {
    return NextResponse.json({ error: access.denial.error }, { status: access.denial.status });
  }

  let aliases: unknown;
  try {
    ({ aliases } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (
    !Array.isArray(aliases) ||
    aliases.length === 0 ||
    aliases.length > MAX_ALIASES ||
    !aliases.every((alias) => typeof alias === 'string' && ALIAS_PATTERN.test(alias))
  ) {
    return NextResponse.json({ error: 'Invalid binding aliases' }, { status: 400 });
  }

  const result = await queryCanvasAliases(token, aliases as string[]);
  if (!result.ok) {
    return NextResponse.json({ error: result.denial.error }, { status: result.denial.status });
  }

  return NextResponse.json({ results: result.results });
}
