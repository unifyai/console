import { NextRequest } from 'next/server';
import { badRequest } from '../../../_utils/auth';
import { forwardToOrchestra } from '../../../chat/_utils/orchestra';

interface RouteParams {
  params: Promise<{ callId: string; action: string }>;
}

const LIFECYCLE_ACTIONS = new Set(['answer', 'join', 'decline', 'leave', 'end']);

/**
 * Unified call lifecycle proxy: answer/join/decline/leave/end plus
 * assistants (add or redispatch an assistant on the call).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { callId, action } = await params;
  if (!callId) {
    return badRequest('callId is required');
  }

  if (action === 'assistants') {
    const body = await request.json().catch(() => null);
    const assistantId = Number(body?.assistantId ?? body?.assistant_id);
    if (!Number.isFinite(assistantId)) {
      return badRequest('assistantId is required');
    }
    return forwardToOrchestra(request, `/calls/${encodeURIComponent(callId)}/assistants`, {
      method: 'POST',
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      body: { assistant_id: assistantId },
    });
  }

  if (!LIFECYCLE_ACTIONS.has(action)) {
    return badRequest(`Unknown call action: ${action}`);
  }
  return forwardToOrchestra(request, `/calls/${encodeURIComponent(callId)}/${action}`, {
    method: 'POST',
  });
}
