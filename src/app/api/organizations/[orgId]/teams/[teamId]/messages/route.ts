import { NextRequest } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';
import { forwardToOrchestra, resolveThreadId } from '../../../../../chat/_utils/orchestra';

interface RouteParams {
  params: Promise<{ orgId: string; teamId: string }>;
}

function parseIds(orgId: string, teamId: string): { organizationId: number; team: number } | null {
  const organizationId = parseInt(orgId, 10);
  const team = parseInt(teamId, 10);
  if (isNaN(organizationId) || isNaN(team)) return null;
  return { organizationId, team };
}

/** Team group-chat history via the unified chat store (most recent last). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId, teamId } = await params;
  const ids = parseIds(orgId, teamId);
  if (!ids) {
    return badRequest('Invalid organization or team ID format. Must be integers.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const thread = await resolveThreadId(apiKey, { kind: 'team', team_id: ids.team });
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

/** Post one message to a team group chat via the unified chat store. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, teamId } = await params;
  const ids = parseIds(orgId, teamId);
  if (!ids) {
    return badRequest('Invalid organization or team ID format. Must be integers.');
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

  const thread = await resolveThreadId(apiKey, { kind: 'team', team_id: ids.team });
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
