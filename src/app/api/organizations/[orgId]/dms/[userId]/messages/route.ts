import { NextRequest } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../_utils/auth';
import { forwardToOrchestra, resolveThreadId } from '../../../../../chat/_utils/orchestra';

interface RouteParams {
  params: Promise<{ orgId: string; userId: string }>;
}

/** Human DM history via the unified chat store (most recent last). */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId, userId } = await params;
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId) || !userId) {
    return badRequest('Invalid organization ID or user ID.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const thread = await resolveThreadId(apiKey, {
    kind: 'dm',
    organization_id: organizationId,
    peer_user_id: userId,
  });
  if ('error' in thread) return thread.error;

  const query = new URLSearchParams();
  const limit = request.nextUrl.searchParams.get('limit');
  const beforeId = request.nextUrl.searchParams.get('before_id');
  const q = request.nextUrl.searchParams.get('q');
  if (limit) query.set('limit', limit);
  if (beforeId) query.set('before_id', beforeId);
  if (q) query.set('q', q);

  return forwardToOrchestra(request, `/chat/threads/${thread.threadId}/messages`, {
    method: 'GET',
    query,
    apiKey,
  });
}

/** Send one DM to another org member via the unified chat store. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, userId } = await params;
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId) || !userId) {
    return badRequest('Invalid organization ID or user ID.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let body: { content?: string; attachments?: unknown };
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

  const thread = await resolveThreadId(apiKey, {
    kind: 'dm',
    organization_id: organizationId,
    peer_user_id: userId,
  });
  if ('error' in thread) return thread.error;

  return forwardToOrchestra(request, `/chat/threads/${thread.threadId}/messages`, {
    method: 'POST',
    body: { content, attachments },
    apiKey,
  });
}
