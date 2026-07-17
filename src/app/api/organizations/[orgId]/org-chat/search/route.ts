import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../_utils/auth';
import { resolveThreadId, type ThreadScope } from '../../../../chat/_utils/orchestra';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

/**
 * GET /api/organizations/[orgId]/org-chat/search?q=&scope=dm|team|group&id=
 *
 * Resolves the scope's unified chat-store thread, searches it, and maps the
 * unified message payloads into the legacy search-result shape the dialog
 * renders.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { orgId } = await params;
  const organizationId = parseInt(orgId, 10);
  if (isNaN(organizationId)) {
    return badRequest('Invalid organization ID format. Must be an integer.');
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const scope = request.nextUrl.searchParams.get('scope')?.trim() ?? '';
  const id = request.nextUrl.searchParams.get('id')?.trim() ?? '';
  if (!q || (scope !== 'dm' && scope !== 'team' && scope !== 'group') || !id) {
    return badRequest('q, scope (dm|team|group), and id are required');
  }

  let threadScope: ThreadScope;
  if (scope === 'dm') {
    threadScope = { kind: 'dm', organization_id: organizationId, peer_user_id: id };
  } else if (scope === 'team') {
    const teamId = parseInt(id, 10);
    if (isNaN(teamId)) return badRequest('Team search id must be an integer team id');
    threadScope = { kind: 'team', team_id: teamId };
  } else {
    const groupId = parseInt(id, 10);
    if (isNaN(groupId)) return badRequest('Group search id must be an integer group id');
    threadScope = { kind: 'group', group_id: groupId };
  }

  const thread = await resolveThreadId(apiKey, threadScope);
  if ('error' in thread) return thread.error;

  try {
    const searchParams = new URLSearchParams({ q });
    const response = await fetch(
      `${ORCHESTRA_URL}/v0/chat/threads/${thread.threadId}/search?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: 'Search failed' }, { status: response.status });
    }
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    return NextResponse.json(
      {
        results: messages.map((message: Record<string, unknown>) => ({
          id: String(message.id ?? ''),
          scope,
          content: String(message.content ?? ''),
          timestamp: (message.timestamp as string | undefined) ?? null,
          // eslint-disable-next-line @typescript-eslint/naming-convention -- legacy shape
          sender_name: String(message.sender_name ?? 'Unknown'),
        })),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ detail: 'Search failed' }, { status: 500 });
  }
}
