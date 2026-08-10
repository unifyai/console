import { rootContext, rootKey, roots, type ContextRoot } from '@/lib/assistants/scope';
import { escapeFilterValue } from '@/utils/assistants/filterExpressions';
import { snakeToCamelObject } from '@/utils/casing';
import type { Assistant } from '@/types/assistants/assistant';
import type { DashboardPaneData, DashboardRecord, TileRecord } from '@/types/assistants/dashboard';

const PAGE_SIZE = 200;

const TILE_METADATA_FIELDS = [
  'token',
  'title',
  'description',
  'tile_id',
  'has_data_bindings',
  'data_binding_contexts',
  'created_at',
  'updated_at',
].join('&');

async function fetchContext(
  context: string,
  options?: { fromFields?: string; filter?: string }
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({
    projectName: 'Assistants',
    context,
    limit: String(PAGE_SIZE),
  });
  if (options?.fromFields) params.set('fromFields', options.fromFields);
  if (options?.filter) params.set('filter', options.filter);

  const response = await fetch(`/api/logs?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) return [];

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) return [];

  const data = await response.json();
  const logs: Array<{ entries?: Record<string, unknown> }> = data?.logs ?? [];
  return logs.map((log) => snakeToCamelObject<Record<string, unknown>>(log.entries ?? {}));
}

async function readAcrossDashboardRoots<T>(
  assistant: Assistant,
  table: string,
  options?: { fromFields?: string; filter?: string; root?: ContextRoot | null }
): Promise<T[]> {
  const readableRoots = options?.root ? [options.root] : roots(assistant);
  const results = await Promise.all(
    readableRoots.map(async (root) => {
      const rows = await fetchContext(
        rootContext(root, assistant.userId, assistant.agentId, table),
        options
      );
      // Roots are concatenated without dedup, so keep each row's provenance:
      // duplicates across roots are indistinguishable in the UI otherwise.
      return rows.map((row) => ({ ...row, originRoot: rootKey(root) }));
    })
  );
  return results.flat() as T[];
}

export async function fetchDashboardMetadata(
  assistant: Assistant,
  root: ContextRoot | null = null
): Promise<DashboardPaneData> {
  const [dashboards, tiles] = await Promise.all([
    readAcrossDashboardRoots<DashboardRecord>(assistant, 'Dashboards/Layouts', { root }),
    readAcrossDashboardRoots<TileRecord>(assistant, 'Dashboards/Tiles', {
      fromFields: TILE_METADATA_FIELDS,
      root,
    }),
  ]);

  return { dashboards, tiles };
}

export async function fetchDashboardTileContent(
  assistant: Assistant,
  tileToken: string,
  root: ContextRoot | null = null
): Promise<string | null> {
  if (!tileToken || tileToken === 'undefined') return null;

  const rows = await readAcrossDashboardRoots<TileRecord>(assistant, 'Dashboards/Tiles', {
    fromFields: 'token&html_content',
    filter: `token == '${escapeFilterValue(tileToken)}'`,
    root,
  });

  return rows[0]?.htmlContent ?? null;
}
