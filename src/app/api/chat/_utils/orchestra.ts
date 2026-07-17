import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

export interface ThreadScope {
  kind: 'dm' | 'assistant_dm' | 'team' | 'group';
  // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
  organization_id?: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
  peer_user_id?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
  assistant_id?: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
  team_id?: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
  group_id?: number;
}

/**
 * Resolve (get-or-create) the unified chat-store thread for one scope with
 * the caller's API key. Returns the thread id or an error response to
 * bubble straight back to the client.
 */
export async function resolveThreadId(
  apiKey: string,
  scope: ThreadScope
): Promise<{ threadId: number } | { error: NextResponse }> {
  try {
    const response = await fetch(`${ORCHESTRA_URL}/v0/chat/threads/resolve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scope),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.thread_id) {
      return {
        error: NextResponse.json(data || { detail: 'Failed to resolve chat thread' }, {
          status: response.ok ? 502 : response.status,
        }),
      };
    }
    return { threadId: Number(data.thread_id) };
  } catch {
    return {
      error: NextResponse.json({ detail: 'Failed to resolve chat thread' }, { status: 502 }),
    };
  }
}

/**
 * Forward one request to Orchestra's unified chat API with the caller's
 * user API key. Every chat surface (assistant DM, human DM, team, group)
 * reads and writes through these endpoints — never through Transcripts.
 */
export async function forwardToOrchestra(
  request: NextRequest,
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; query?: URLSearchParams; apiKey?: string }
): Promise<NextResponse> {
  const apiKey = init.apiKey ?? (await getApiKeyFromRequest(request));
  if (!apiKey) {
    return unauthorized();
  }

  const query = init.query?.toString();
  const url = `${ORCHESTRA_URL}/v0${path}${query ? `?${query}` : ''}`;
  try {
    const response = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(data || { detail: `Chat request failed (${response.status})` }, {
        status: response.status,
      });
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ detail: 'Chat request failed' }, { status: 502 });
  }
}
