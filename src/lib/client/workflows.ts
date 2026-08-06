/**
 * Workflow catalogue reads.
 *
 * The shelf listing is platform data: one hand-curated collection,
 * identical for every assistant, living in the public-read Builtins
 * project — exactly like the integrations app catalogue. Reading it never
 * touches (or wakes) an assistant. Everything per-assistant — the
 * installation rows, settings, and the planted content — stays in the
 * assistant's own contexts and is read through `fetchBrainContext`.
 */

const WORKFLOWS_CATALOG_CONTEXT = 'Workflows/Catalog';

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
 * Every published catalogue row, keyed access left to the caller.
 *
 * An environment whose Builtins project has not been seeded yet answers
 * with an empty shelf rather than an error — same posture as the
 * integrations gallery against a missing catalogue.
 */
export async function fetchWorkflowsCatalog(): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  params.set('projectName', process.env.NEXT_PUBLIC_UNITY_BUILTINS_PROJECT || 'Builtins');
  params.set('context', WORKFLOWS_CATALOG_CONTEXT);
  params.set('limit', '500');
  params.set('offset', '0');
  const response = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
  try {
    const data = await readJson<LogPayload<Record<string, unknown>>>(response);
    return (data.logs ?? []).flatMap((log) => (log.entries ? [log.entries] : []));
  } catch (error) {
    if (error instanceof Error && /Builtins|project|context/i.test(error.message)) {
      return [];
    }
    throw error;
  }
}
