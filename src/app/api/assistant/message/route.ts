import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../_utils/auth';
import { snakeToCamelObject } from '@/utils/casing';
import { mockSimulationEnabled } from '@/lib/simulation/config';
import type { Attachment } from '@/types/assistants/chat';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

/**
 * Send one message to an assistant's 1-on-1 chat.
 *
 * Thin proxy over the unified chat store: resolves the caller's
 * assistant-DM thread, then posts the message. Orchestra persists it and
 * hands realtime delivery + runtime fan-out to the hosted communication
 * layer — Console never dispatches to adapters directly.
 */
export async function POST(request: NextRequest) {
  // Mock simulation has no backend; accept optimistically so the chat
  // composer's optimistic echo shows without a backend dispatch.
  if (mockSimulationEnabled()) {
    return NextResponse.json({ info: 'Message accepted (mock simulation).' }, { status: 202 });
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

  // Transform from snake_case to camelCase (support both formats)
  const normalizedBody = snakeToCamelObject<{
    assistantId?: string | number;
    message?: string;
    body?: string;
    attachments?: Attachment[];
  }>(requestBody);

  const { assistantId, attachments } = normalizedBody;
  const message = normalizedBody.message || normalizedBody.body;
  const hasContent = message || (attachments && attachments.length > 0);

  if (!assistantId) {
    return badRequest('Missing assistantId');
  }
  if (!hasContent) {
    return badRequest('Missing message or attachments');
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

    const sendResponse = await fetch(
      `${ORCHESTRA_URL}/v0/chat/threads/${thread.thread_id}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: message || '',
          attachments: (attachments || []).map((attachment) => ({
            id: attachment.id,
            filename: attachment.filename,
            // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
            gs_url: attachment.gsUrl,
            // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
            content_type: attachment.contentType,
            // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
            size_bytes: attachment.sizeBytes,
          })),
        }),
      }
    );
    const data = await sendResponse.json().catch(() => null);
    if (!sendResponse.ok) {
      return NextResponse.json(data || { detail: 'Failed to send message' }, {
        status: sendResponse.status,
      });
    }
    return NextResponse.json(
      { info: 'Message sent to assistant for processing.', message: data },
      { status: 202 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/assistant/message] Error sending chat message:', errorMessage);
    return NextResponse.json({ detail: `Chat send error: ${errorMessage}` }, { status: 502 });
  }
}
