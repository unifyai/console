/**
 * Canvas action metadata.
 *
 * Console passes these to the frame so it can render controls. Session-authed and
 * ownership-checked like every other canvas route: knowing a token is not
 * permission to discover what a canvas can do.
 */

import { NextRequest, NextResponse } from 'next/server';

import { authorizeCanvasRead, listCanvasActions } from '@/lib/canvas/canvasAccess';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const access = await authorizeCanvasRead(request, token);
  if (!access.ok) {
    return NextResponse.json({ error: access.denial.error }, { status: access.denial.status });
  }

  const result = await listCanvasActions(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.denial.error }, { status: result.denial.status });
  }

  return NextResponse.json({ actions: result.actions });
}
