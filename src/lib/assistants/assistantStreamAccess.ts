/**
 * Access control for the assistant event streams.
 *
 * Most `[assistantId]` API routes need no authorization of their own: they forward
 * to Orchestra with the *viewer's* own API key, which is data-scoped, so Orchestra
 * decides what comes back. The SSE routes are the exception — they subscribe to the
 * assistant's Pub/Sub topic with the platform's service-account credentials, so
 * nothing downstream is scoped to the caller and the route is the only place the
 * question can be asked.
 *
 * The check is deliberately the same one the interface already applies: the shell
 * builds its assistant list from `GET /v0/assistant` with this exact key, so a
 * viewer who can see an assistant in the UI passes here by construction. That is
 * what makes this an authorization fix rather than a behaviour change.
 *
 * Server-only.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getApiKeyFromRequest } from '@/app/api/_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

export type AssistantStreamAccess = { ok: true } | { ok: false; response: NextResponse };

/**
 * Whether this viewer may read this assistant's event stream.
 *
 * The API key resolves against the active workspace, so an organization member
 * gets that organization's assistants and a personal session gets their own —
 * the same scoping every other console read uses.
 */
export async function authorizeAssistantStream(
  request: NextRequest,
  assistantId: string
): Promise<AssistantStreamAccess> {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json({ detail: 'Unauthorized' }, { status: 401 }),
    };
  }

  const client = createOrchestraClient(apiKey);

  let assistants: unknown;
  try {
    const { data, error } = await client.GET('/v0/assistant', {});
    if (error) {
      // Orchestra refused the key or is unreachable. Failing closed: this route
      // hands out an assistant's whole activity feed, so an inconclusive check
      // must not be read as a pass.
      return {
        ok: false,
        response: NextResponse.json({ detail: 'Could not verify access' }, { status: 503 }),
      };
    }
    assistants = data;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ detail: 'Could not verify access' }, { status: 503 }),
    };
  }

  // The list arrives either bare or wrapped in `info`, matching `listAssistants`.
  const rows = Array.isArray(assistants)
    ? assistants
    : Array.isArray((assistants as { info?: unknown })?.info)
      ? ((assistants as { info: unknown[] }).info as unknown[])
      : [];

  // The stream is keyed by the agent id, which is what names the Pub/Sub topic.
  // Compared as strings because the path segment is one and the payload may carry
  // either, and `agentId` covers the simulation adapter's camelCase rows.
  const permitted = rows.some((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    const id = record['agent_id'] ?? record['agentId'];
    return id !== undefined && id !== null && String(id) === assistantId;
  });

  if (!permitted) {
    return {
      ok: false,
      response: NextResponse.json({ detail: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true };
}
