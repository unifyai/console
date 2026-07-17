import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';
import { mockSimulationEnabled } from '@/lib/simulation/config';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

/**
 * Toggle the caller's emoji reaction on one assistant-DM chat message.
 *
 * Reactions persist in the unified chat store; Orchestra publishes the
 * Console frame and notifies the assistant runtime (which keeps its own
 * Transcripts mirror in sync via the mirrored chat_message_id).
 */
export async function POST(request: NextRequest) {
  if (mockSimulationEnabled()) {
    return NextResponse.json({ info: 'Reaction accepted (mock simulation).' }, { status: 202 });
  }

  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  let requestBody;
  try {
    requestBody = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const normalizedBody = snakeToCamelObject<{
    assistantId?: string | number;
    targetMessageId?: string | number;
    emoji?: string | null;
  }>(requestBody);

  const { assistantId, targetMessageId, emoji } = normalizedBody;

  if (!assistantId) {
    return badRequest('Missing assistantId');
  }
  if (targetMessageId === undefined || targetMessageId === null) {
    return badRequest('Missing targetMessageId');
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const resolveResponse = await fetch(`${ORCHESTRA_URL}/v0/chat/threads/resolve`, {
      method: 'POST',
      headers,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      body: JSON.stringify({ kind: 'assistant_dm', assistant_id: Number(assistantId) }),
      cache: 'no-store',
    });
    const thread = await resolveResponse.json().catch(() => null);
    if (!resolveResponse.ok || !thread?.thread_id) {
      return NextResponse.json(thread || { detail: 'Failed to resolve chat thread' }, {
        status: resolveResponse.ok ? 502 : resolveResponse.status,
      });
    }

    const reactionResponse = await fetch(
      `${ORCHESTRA_URL}/v0/chat/threads/${thread.thread_id}/messages/${Number(targetMessageId)}/reactions`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ emoji: emoji ?? null }),
      }
    );
    const data = await reactionResponse.json().catch(() => null);
    if (!reactionResponse.ok) {
      return NextResponse.json(data || { detail: 'Failed to update reaction' }, {
        status: reactionResponse.status,
      });
    }
    return NextResponse.json({ info: 'Reaction updated.', message: data }, { status: 200 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/assistant/message/reaction] Error updating reaction:', errorMessage);
    return NextResponse.json({ detail: `Reaction error: ${errorMessage}` }, { status: 502 });
  }
}
