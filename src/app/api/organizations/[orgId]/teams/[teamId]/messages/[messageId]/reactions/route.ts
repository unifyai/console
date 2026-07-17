import { NextRequest } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../../../../_utils/auth';
import { forwardToOrchestra, resolveThreadId } from '../../../../../../../chat/_utils/orchestra';

interface RouteParams {
  params: Promise<{ orgId: string; teamId: string; messageId: string }>;
}

/** Toggle the caller's emoji reaction on a team chat message. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { orgId, teamId, messageId } = await params;

  const organizationId = parseInt(orgId, 10);
  const teamIdNum = parseInt(teamId, 10);
  const messageIdNum = parseInt(messageId, 10);
  if (isNaN(organizationId) || isNaN(teamIdNum) || isNaN(messageIdNum)) {
    return badRequest('Invalid organization, team, or message ID.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let body: { emoji?: string | null };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const thread = await resolveThreadId(apiKey, { kind: 'team', team_id: teamIdNum });
  if ('error' in thread) return thread.error;

  return forwardToOrchestra(
    request,
    `/chat/threads/${thread.threadId}/messages/${messageIdNum}/reactions`,
    { method: 'POST', body: { emoji: body.emoji ?? null }, apiKey }
  );
}
