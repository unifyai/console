/**
 * A canvas's run history.
 *
 * Served for the chrome panel rather than for the frame. The canvas never sees this
 * and cannot influence it: run metadata — what was submitted, by whom, whether it
 * worked — is the one thing an authored canvas must not be able to misreport, since
 * a control that failed repeatedly could otherwise be drawn as having succeeded.
 *
 * Read from the stored invocation rows as the canvas owner, the same way its bundle
 * is, so there is one integrity story for everything on the canvas record.
 */

import { NextRequest, NextResponse } from 'next/server';

import { authorizeCanvasRead } from '@/lib/canvas/canvasAccess';
import { fetchCanvasRuns } from '@/lib/canvas/canvasRecord';

/** Enough to show a real history without turning a panel open into a large read. */
const MAX_RUNS = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const access = await authorizeCanvasRead(request, token);
  if (!access.ok) {
    return NextResponse.json({ error: access.denial.error }, { status: access.denial.status });
  }

  const result = await fetchCanvasRuns(access.resolution, token, MAX_RUNS);
  if (!result.ok) {
    return NextResponse.json({ error: result.denial.error }, { status: result.denial.status });
  }

  return NextResponse.json({ runs: result.runs });
}
