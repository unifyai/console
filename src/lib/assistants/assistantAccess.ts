/**
 * Which assistants Orchestra will hand a given caller.
 *
 * The console has one answer to "may this person see this teammate", and it is
 * the roster's own: `GET /v0/assistant` with the caller's workspace-scoped API
 * key. Orchestra applies the organization's `assistant:read` permission itself,
 * so a viewer who can see an assistant in the UI resolves it here by
 * construction, and one who cannot resolves nothing — without the console
 * reimplementing role logic of its own, and without trusting anything the
 * client passed in.
 *
 * `list_all_org` is what makes that equivalence hold inside an organization.
 * Without it Orchestra lists only the assistants the caller created, which is a
 * narrower question than the shell asks to draw its roster; a member whose role
 * lacks `assistant:read` is refused the org-wide listing and falls back to the
 * creator-scoped one, mirroring `fetchAssistants`.
 *
 * Server-only.
 */

import { createOrchestraClient } from '@/lib/orchestra/client';

/** An assistant as Orchestra sends it; callers read the fields they need. */
export type AssistantRow = Record<string, unknown>;

/** The list arrives either bare or wrapped in `info`, matching `listAssistants`. */
function assistantRows(payload: unknown): AssistantRow[] {
  if (Array.isArray(payload)) {
    return payload as AssistantRow[];
  }
  const info = (payload as { info?: unknown } | null)?.info;
  return Array.isArray(info) ? (info as AssistantRow[]) : [];
}

/**
 * Read a row field that may arrive in either casing, as a string.
 *
 * Responses pass through the Orchestra client's camelCasing middleware, while
 * the simulation adapter and Orchestra's own schema speak snake_case. Ids are
 * compared as strings because a path segment is one and the payload may carry
 * either.
 */
export function assistantField(row: AssistantRow, snake: string, camel: string): string | null {
  const value = row[snake] ?? row[camel];
  return value === undefined || value === null ? null : String(value);
}

/**
 * The assistant Orchestra will show this caller, or `null`.
 *
 * Returns the row rather than a boolean so a caller can check the fields its
 * decision hangs on — a client-supplied owner id, say — against what Orchestra
 * actually holds for that assistant.
 *
 * An inconclusive check is a refusal: Orchestra rejecting the key or being
 * unreachable must never read as a pass.
 */
export async function readableAssistantRow(
  apiKey: string,
  assistantId: string
): Promise<AssistantRow | null> {
  const client = createOrchestraClient(apiKey);

  let payload: unknown;
  try {
    const orgWide = await client.GET('/v0/assistant', {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
      params: { query: { list_all_org: true } },
    });
    // A member without `assistant:read` cannot list every assistant in the org.
    // Ask the narrower question rather than reading that refusal as "no access".
    const result =
      orgWide.response?.status === 403 ? await client.GET('/v0/assistant', {}) : orgWide;
    if (result.error) {
      return null;
    }
    payload = result.data;
  } catch {
    return null;
  }

  return (
    assistantRows(payload).find(
      (row) => assistantField(row, 'agent_id', 'agentId') === assistantId
    ) ?? null
  );
}
