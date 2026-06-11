import { NextResponse, NextRequest } from 'next/server';
import { badRequest, internalError } from '../../../_utils/auth';
import { camelToSnakeObject } from '@/utils/casing';
import { getAdaptersBaseUrl } from '@/utils/assistants/api-utils';

// This route dispatches an agent to join a LiveKit room for a voice call.
// It proxies to your backend/agents orchestrator.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assistantId, roomName, openingConfig } = body;

    if (!assistantId || !roomName) {
      return badRequest('assistantId and roomName are required');
    }

    const localAdaptersUrl = process.env.LOCAL_ADAPTERS_URL;
    const dispatchUrl = `${getAdaptersBaseUrl({ localAdaptersUrl })}/unify/meet`;
    const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY;

    if (!ADMIN_KEY) {
      console.warn(
        '[API /dispatch] Admin Key not configured. Simulating success for local development.'
      );
      return NextResponse.json(
        { info: 'Dispatch accepted (no backend configured)' },
        { status: 202 }
      );
    }

    // The request to the orchestrator needs to tell the assistant which room to join.
    // Transform camelCase to snake_case for external API
    const dispatchPayload = camelToSnakeObject({
      assistantId,
      livekitAgentName: roomName,
      roomName,
      ...(openingConfig ? { openingConfig } : {}),
    });

    const resp = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_KEY}`,
      },
      body: JSON.stringify(dispatchPayload),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => 'Failed to dispatch agent');
      console.error(`[API /dispatch] Error dispatching agent to ${dispatchUrl}: ${detail}`);
      return NextResponse.json({ detail }, { status: 502 });
    }

    const data = await resp.json().catch(() => ({}));
    return NextResponse.json({ info: 'Agent dispatched', data }, { status: 202 });
  } catch (error: any) {
    console.error(`[API /dispatch] Internal server error: ${error.message}`);
    return internalError(error?.message || 'Unknown error');
  }
}
