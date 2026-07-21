import { NextRequest } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';
import { forwardToOrchestra, resolveThreadId } from '../../../../../chat/_utils/orchestra';

interface RouteParams {
  params: Promise<{ orgId: string; teamId: string }>;
}

/** Ended-call session summaries for a team thread (duration pills only). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId, teamId } = await params;
  const organizationId = parseInt(orgId, 10);
  const team = parseInt(teamId, 10);
  if (isNaN(organizationId) || isNaN(team)) {
    return badRequest('Invalid organization or team ID format. Must be integers.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const thread = await resolveThreadId(apiKey, { kind: 'team', team_id: team });
  if ('error' in thread) return thread.error;

  const query = new URLSearchParams();
  const limit = request.nextUrl.searchParams.get('limit');
  const beforeId = request.nextUrl.searchParams.get('before_id');
  if (limit) query.set('limit', limit);
  if (beforeId) query.set('before_id', beforeId);

  return forwardToOrchestra(request, `/chat/threads/${thread.threadId}/calls`, {
    method: 'GET',
    query,
    apiKey,
  });
}
