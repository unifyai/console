import { NextRequest } from 'next/server';
import { badRequest } from '../_utils/auth';
import { forwardToOrchestra } from '../chat/_utils/orchestra';

/** Call summaries transcribed by one assistant (most recent last). */
export async function GET(request: NextRequest) {
  const assistantId = request.nextUrl.searchParams.get('assistantId');
  if (!assistantId || isNaN(parseInt(assistantId, 10))) {
    return badRequest('assistantId query parameter is required');
  }

  const query = new URLSearchParams({ assistant_id: assistantId });
  const limit = request.nextUrl.searchParams.get('limit');
  if (limit) query.set('limit', limit);

  return forwardToOrchestra(request, '/calls', { method: 'GET', query });
}

/**
 * Create a call session against one chat scope (dm/team/group/assistant_dm).
 * Orchestra owns the session, room naming, ring frames, and agent dispatch.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.kind !== 'string') {
    return badRequest('kind is required');
  }
  return forwardToOrchestra(request, '/calls', {
    method: 'POST',
    body: {
      kind: body.kind,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      organization_id: body.organizationId ?? body.organization_id ?? undefined,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      peer_user_id: body.peerUserId ?? body.peer_user_id ?? undefined,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      team_id: body.teamId ?? body.team_id ?? undefined,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      group_id: body.groupId ?? body.group_id ?? undefined,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      assistant_id: body.assistantId ?? body.assistant_id ?? undefined,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      opening_config: body.openingConfig ?? body.opening_config ?? undefined,
    },
  });
}
