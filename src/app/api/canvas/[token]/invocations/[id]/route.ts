/**
 * Canvas invocation status.
 *
 * The client that pressed a control polls this until the run reaches a terminal
 * state, which is what moves the control out of "working".
 *
 * This rather than the assistant event stream is the primary path, because it is
 * the only one available to every viewer. A `team` canvas can be read by someone
 * who is not permitted to see the assistant itself, so stream-delivered updates
 * would silently never arrive for exactly those viewers. The stream stays as the
 * fast path, and as the way *other* people watching a shared canvas see a run they
 * did not start.
 *
 * Orchestra scopes the lookup to the canvas in the path, so an invocation id
 * belonging to one canvas cannot be read through another.
 *
 * Orchestra endpoint: GET /v0/admin/canvas/{token}/invocations/{id}
 */

import { NextRequest, NextResponse } from 'next/server';

import { authorizeCanvasRead, readCanvasInvocation } from '@/lib/canvas/canvasAccess';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;

  const access = await authorizeCanvasRead(request, token);
  if (!access.ok) {
    return NextResponse.json({ error: access.denial.error }, { status: access.denial.status });
  }

  // Auto-counted ids are 0-based, so the first run of a canvas is id 0 and a
  // truthiness check here would make it unpollable.
  const invocationId = Number(id);
  if (!Number.isInteger(invocationId) || invocationId < 0) {
    return NextResponse.json({ error: 'Invalid invocation id' }, { status: 400 });
  }

  const result = await readCanvasInvocation(token, invocationId);
  if (!result.ok) {
    return NextResponse.json({ error: result.denial.error }, { status: result.denial.status });
  }

  return NextResponse.json(result.invocation);
}
