/**
 * One canvas, as a surface needs it.
 *
 * The three surfaces — chat embed, assistants tab, standalone page — all mount the
 * same `CanvasFrame`, and all need the same four things before they can: the
 * compiled bundle, the props frozen at author time, the binding aliases the frame
 * is allowed to ask for, and the declared actions. Serving them together is what
 * keeps a surface from rendering a canvas whose actions have not arrived yet, and
 * costs one round trip instead of two.
 *
 * The bundle is integrity-checked in `fetchCanvasRecord` before it reaches this
 * response, so a surface never has to decide whether to trust it.
 */

import { NextRequest, NextResponse } from 'next/server';

import { authorizeCanvasRead, listCanvasActions } from '@/lib/canvas/canvasAccess';
import { fetchCanvasRecord } from '@/lib/canvas/canvasRecord';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const access = await authorizeCanvasRead(request, token);
  if (!access.ok) {
    return NextResponse.json({ error: access.denial.error }, { status: access.denial.status });
  }

  const record = await fetchCanvasRecord(access.resolution, token);
  if (!record.ok) {
    return NextResponse.json({ error: record.denial.error }, { status: record.denial.status });
  }

  const actions = await listCanvasActions(token);
  if (!actions.ok) {
    return NextResponse.json({ error: actions.denial.error }, { status: actions.denial.status });
  }

  return NextResponse.json({ ...record.record, actions: actions.actions });
}
