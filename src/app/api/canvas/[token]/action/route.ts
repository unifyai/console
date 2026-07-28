/**
 * Canvas action proxy.
 *
 * A canvas names an action; this route authorizes the viewer and hands the name
 * and arguments to Orchestra, which resolves the target, re-validates the
 * arguments against the schema declared at author time, enforces the rate limit
 * and deduplicates.
 *
 * Deliberately no re-implementation of those rules here. They are enforced where
 * the stored action row lives, and a second copy on this side would be a second
 * thing to drift out of agreement with the first.
 *
 * What this route *does* own is the viewer's identity: `requestedByUserId` comes
 * from the session, never from the request body, so the rate limit and the audit
 * trail record who actually asked.
 */

import { NextRequest, NextResponse } from 'next/server';

import { authorizeCanvasRead, invokeCanvasAction } from '@/lib/canvas/canvasAccess';
import { getCurrentUser } from '@/lib/user/user';

/** Action names are lowercase snake case, as declared at author time. */
const ACTION_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const access = await authorizeCanvasRead(request, token);
  if (!access.ok) {
    return NextResponse.json({ error: access.denial.error }, { status: access.denial.status });
  }

  let body: { actionName?: unknown; args?: unknown; runKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { actionName, args, runKey } = body;
  if (typeof actionName !== 'string' || !ACTION_NAME_PATTERN.test(actionName)) {
    return NextResponse.json({ error: 'Invalid action name' }, { status: 400 });
  }
  if (args !== undefined && (typeof args !== 'object' || args === null || Array.isArray(args))) {
    return NextResponse.json({ error: 'Arguments must be an object' }, { status: 400 });
  }
  if (runKey !== undefined && typeof runKey !== 'string') {
    return NextResponse.json({ error: 'Invalid run key' }, { status: 400 });
  }

  // From the session, never the body. A client-supplied identity would let one
  // viewer spend another's rate limit and mislabel the audit row.
  const viewer = await getCurrentUser();

  const result = await invokeCanvasAction(token, {
    actionName,
    args: (args ?? {}) as Record<string, unknown>,
    runKey,
    requestedByUserId: viewer?.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.denial.error }, { status: result.denial.status });
  }

  return NextResponse.json(result.invocation);
}
