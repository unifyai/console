import { NextRequest } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';
import { forwardToOrchestra, resolveThreadId } from '../../../../../chat/_utils/orchestra';

interface RouteParams {
  params: Promise<{ orgId: string; groupId: string }>;
}

function parseIds(
  orgId: string,
  groupId: string
): { organizationId: number; group: number } | null {
  const organizationId = parseInt(orgId, 10);
  const group = parseInt(groupId, 10);
  if (isNaN(organizationId) || isNaN(group)) return null;
  return { organizationId, group };
}

/** Chat-group history via the unified chat store (most recent last). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId, groupId } = await params;
  const ids = parseIds(orgId, groupId);
  if (!ids) {
    return badRequest('Invalid organization or group ID format. Must be integers.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const thread = await resolveThreadId(apiKey, { kind: 'group', group_id: ids.group });
  if ('error' in thread) return thread.error;

  const query = new URLSearchParams();
  const limit = request.nextUrl.searchParams.get('limit');
  const beforeId =
    request.nextUrl.searchParams.get('before_id') ??
    request.nextUrl.searchParams.get('before_message_id');
  if (limit) query.set('limit', limit);
  if (beforeId) query.set('before_id', beforeId);

  return forwardToOrchestra(request, `/chat/threads/${thread.threadId}/messages`, {
    method: 'GET',
    query,
    apiKey,
  });
}

/** Post one message to a chat group via the unified chat store. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, groupId } = await params;
  const ids = parseIds(orgId, groupId);
  if (!ids) {
    return badRequest('Invalid organization or group ID format. Must be integers.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let body: { content?: string; mentions?: unknown; attachments?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }
  const content = typeof body.content === 'string' ? body.content : '';
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (!content.trim() && attachments.length === 0) {
    return badRequest('Missing content or attachments');
  }

  const thread = await resolveThreadId(apiKey, { kind: 'group', group_id: ids.group });
  if ('error' in thread) return thread.error;

  return forwardToOrchestra(request, `/chat/threads/${thread.threadId}/messages`, {
    method: 'POST',
    body: {
      content,
      ...(body.mentions !== undefined ? { mentions: body.mentions } : {}),
      attachments,
    },
    apiKey,
  });
}
