import { NextRequest } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';
import { forwardToOrchestra, resolveThreadId } from '../../../../../chat/_utils/orchestra';

interface RouteParams {
  params: Promise<{ orgId: string; groupId: string }>;
}

/** Ended-call session summaries for a chat-group thread (duration pills only). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId, groupId } = await params;
  const organizationId = parseInt(orgId, 10);
  const group = parseInt(groupId, 10);
  if (isNaN(organizationId) || isNaN(group)) {
    return badRequest('Invalid organization or group ID format. Must be integers.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const thread = await resolveThreadId(apiKey, { kind: 'group', group_id: group });
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
