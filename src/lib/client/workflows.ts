/**
 * Workflow catalogue reads.
 *
 * The shelf is platform data: one hand-curated collection, identical for
 * every assistant, living in the public-read Builtins project — exactly
 * like the integrations app catalogue. Two contexts are published there:
 * the listing (`Workflows/Catalog`, one row per workflow) and the
 * artifacts (`Workflows/Content`, one row per thing a workflow would
 * plant, substance included, so the drawer can open a procedure or a task
 * brief before anything is installed). Reading either never touches (or
 * wakes) an assistant. Everything per-assistant — the installation rows,
 * settings, and the planted content — stays in the assistant's own
 * contexts and is read through `fetchBrainContext`.
 */

import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';
import { rootContext } from '@/lib/assistants/scope';
import type { Assistant } from '@/types/assistants/assistant';

const WORKFLOWS_CATALOG_CONTEXT = 'Workflows/Catalog';
const WORKFLOWS_CONTENT_CONTEXT = 'Workflows/Content';
const WORKFLOWS_REQUESTS_CONTEXT = 'Workflows/Requests';

/** Mutations a reading surface may ask the assistant to carry out. */
export type WorkflowRequestAction = 'install' | 'uninstall' | 'update' | 'save_params';

interface LogPayload<T> {
  logs?: Array<{ entries?: T }>;
  count?: number;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`logs request failed (${response.status}): ${body.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

/**
 * Rows from one Builtins workflow context, entries camelized to match what
 * `fetchBrainContext` hands every other mapper. An environment whose
 * Builtins project has not been seeded yet answers with an empty list
 * rather than an error — same posture as the integrations gallery against
 * a missing catalogue.
 */
async function fetchBuiltinsWorkflowRows(
  context: string,
  filter?: string
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  params.set('projectName', process.env.NEXT_PUBLIC_UNITY_BUILTINS_PROJECT || 'Builtins');
  params.set('context', context);
  params.set('limit', '500');
  params.set('offset', '0');
  if (filter) params.set('filter', filter);
  const response = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
  try {
    const data = await readJson<LogPayload<Record<string, unknown>>>(response);
    return (data.logs ?? []).flatMap((log) =>
      log.entries ? [snakeToCamelObject<Record<string, unknown>>(log.entries)] : []
    );
  } catch (error) {
    if (error instanceof Error && /Builtins|project|context/i.test(error.message)) {
      return [];
    }
    throw error;
  }
}

/** Every published catalogue row, keyed access left to the caller. */
export async function fetchWorkflowsCatalog(): Promise<Record<string, unknown>[]> {
  return fetchBuiltinsWorkflowRows(WORKFLOWS_CATALOG_CONTEXT);
}

/** One workflow's published artifacts, filtered server-side by slug. */
export async function fetchWorkflowContent(slug: string): Promise<Record<string, unknown>[]> {
  return fetchBuiltinsWorkflowRows(WORKFLOWS_CONTENT_CONTEXT, `slug == ${JSON.stringify(slug)}`);
}

/**
 * Ask the assistant to change a workflow's install state.
 *
 * Console cannot do this itself: planting content fans out over unify's
 * custom-sync engine, which only the assistant has. So the intent is written as
 * a durable `Workflows/Requests` row and the assistant carries it out — on the
 * wake this dispatch triggers, or on its next boot if the wake never lands.
 *
 * The order matters and is the same one Orchestra uses for canvas invocations:
 * persist, then dispatch. Dispatching first could wake an assistant for work no
 * row records. A dispatch that fails is therefore not an error — the change is
 * already durable — so this reports it as `dispatched: false` rather than
 * throwing, and the caller can say "queued" instead of "failed".
 *
 * `requestId` is minted here so a retried submit converges on one row instead of
 * queueing the same install twice.
 */
export async function submitWorkflowRequest(
  assistant: Assistant,
  {
    slug,
    action,
    params = {},
    destination = { kind: 'personal' } as const,
  }: {
    slug: string;
    action: WorkflowRequestAction;
    params?: Record<string, string | number | boolean>;
    destination?: { kind: 'personal' } | { kind: 'team'; teamId: number };
  }
): Promise<{ requestId: string; dispatched: boolean }> {
  const requestId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const destinationValue = destination.kind === 'team' ? `team:${destination.teamId}` : 'personal';

  const context = rootContext(
    destination,
    assistant.userId,
    String(assistant.agentId),
    WORKFLOWS_REQUESTS_CONTEXT
  );

  const write = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: 'Assistants',
      context,
      // Converted to Orchestra's wire casing rather than written in it: the
      // row fields are snake_case (unify's WorkflowRequest model), and the
      // same conversion is what canvasAccess does at this boundary.
      entries: camelToSnakeObject({
        requestId,
        slug,
        action,
        params: JSON.stringify(params),
        destination: destinationValue,
        status: 'pending',
      }),
    }),
  });

  if (!write.ok) {
    const detail = await write.text().catch(() => '');
    throw new Error(`could not record the request (${write.status}): ${detail.slice(0, 200)}`);
  }

  // Best-effort from here: the row is what makes the change happen.
  try {
    const dispatch = await fetch('/api/workflows/requests/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assistantId: assistant.agentId,
        requestId,
        slug,
        action,
        destination: destinationValue,
      }),
    });
    if (!dispatch.ok) return { requestId, dispatched: false };
    const body = (await dispatch.json()) as { dispatched?: boolean };
    return { requestId, dispatched: body.dispatched === true };
  } catch {
    return { requestId, dispatched: false };
  }
}

/** This assistant's recorded requests, newest first, for rendering their state. */
export async function fetchWorkflowRequests(
  assistant: Assistant,
  { limit = 50 }: { limit?: number } = {}
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  params.set('projectName', 'Assistants');
  params.set(
    'context',
    rootContext(
      { kind: 'personal' },
      assistant.userId,
      String(assistant.agentId),
      WORKFLOWS_REQUESTS_CONTEXT
    )
  );
  params.set('limit', String(limit));
  const response = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
  try {
    const data = await readJson<LogPayload<Record<string, unknown>>>(response);
    return (data.logs ?? []).flatMap((log) =>
      log.entries ? [snakeToCamelObject<Record<string, unknown>>(log.entries)] : []
    );
  } catch {
    // A never-booted assistant has no such context yet; that is an empty list,
    // not an error.
    return [];
  }
}
