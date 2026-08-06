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

import { snakeToCamelObject } from '@/utils/casing';

const WORKFLOWS_CATALOG_CONTEXT = 'Workflows/Catalog';
const WORKFLOWS_CONTENT_CONTEXT = 'Workflows/Content';

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
