'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
/**
 * Server Actions for Dashboards Pane
 *
 * Factory functions that return server actions for fetching dashboard
 * layouts and tile data from the Dashboards/* Unify contexts.
 *
 * Uses `from_fields` to implement two-phase loading:
 *   1. getDashboardMetadata — lightweight fetch (titles, tokens, descriptions)
 *   2. getDashboardTileContent — on-demand fetch of html_content for a tile
 *
 * Follows the same pattern as action.ts (paginated fetch, snakeToCamelObject
 * on entries, factory receiving apiKey).
 */

import { snakeToCamelObject } from '@/utils/casing';
import type { DashboardPaneData, DashboardRecord, TileRecord } from '@/types/assistants/dashboard';
import type { Assistant } from '@/types/assistants/assistant';
import { readAcrossRoots } from '@/lib/client/read_across_roots';
import { rootContext } from '@/lib/assistants/scope';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';

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
  apiKey: string,
  context: string,
  options?: { extraParams?: string; fromFields?: string; filter?: string }
): Promise<Record<string, unknown>[]> {
  let url = `${getInternalApiBaseUrl()}/api/logs?projectName=Assistants&context=${encodeURIComponent(context)}&limit=${PAGE_SIZE}`;
  if (options?.extraParams) url += `&${options.extraParams}`;
  if (options?.fromFields) url += `&fromFields=${encodeURIComponent(options.fromFields)}`;
  if (options?.filter) url += `&filter=${encodeURIComponent(options.filter)}`;

  const res = await fetch(url, { method: 'GET', headers: { apiKey } });
  if (!res.ok) return [];

  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) return [];

  const data = await res.json();
  const logs: any[] = data?.logs ?? [];

  return logs.map((log: any) => snakeToCamelObject<Record<string, unknown>>(log.entries));
}

/**
 * Factory for getDashboardMetadata server action.
 *
 * Fetches all dashboard layouts (full) and tile metadata (without html_content)
 * for a given assistant. Used for populating the dropdown selector.
 */
export async function getDashboardMetadata(assistant: Assistant): Promise<DashboardPaneData> {
  const apiKey = await requireUserApiKey();
  try {
    const [layoutRows, tileRows] = await Promise.all([
      readAcrossRoots(assistant, (root) =>
        fetchContext(
          apiKey,
          rootContext(root, assistant.userId, assistant.agentId, 'Dashboards/Layouts')
        )
      ),
      readAcrossRoots(assistant, (root) =>
        fetchContext(
          apiKey,
          rootContext(root, assistant.userId, assistant.agentId, 'Dashboards/Tiles'),
          {
            fromFields: TILE_METADATA_FIELDS,
          }
        )
      ),
    ]);

    const dashboards = layoutRows as unknown as DashboardRecord[];
    const tiles = tileRows as unknown as TileRecord[];

    return { dashboards, tiles };
  } catch (err) {
    console.error('[dashboard.ts getDashboardMetadata] Error:', err);
    return { dashboards: [], tiles: [] };
  }
}
/**
 * Factory for getDashboardTileContent server action.
 *
 * Fetches html_content for a single tile by token. Called lazily when a
 * tile is first viewed.
 */
export async function getDashboardTileContent(
  assistant: Assistant,
  tileToken: string
): Promise<string | null> {
  const apiKey = await requireUserApiKey();
  if (!tileToken || tileToken === 'undefined') {
    return null;
  }

  try {
    const rows = await readAcrossRoots(assistant, (root) =>
      fetchContext(
        apiKey,
        rootContext(root, assistant.userId, assistant.agentId, 'Dashboards/Tiles'),
        {
          fromFields: 'token&html_content',
          filter: `token == '${tileToken}'`,
        }
      )
    );

    if (rows.length === 0) return null;
    return (rows[0] as unknown as { htmlContent?: string }).htmlContent ?? null;
  } catch (err) {
    console.error(`[dashboard.ts getDashboardTileContent] Error for token=${tileToken}:`, err);
    return null;
  }
}
/**
 * Factory for getDashboardData server action.
 *
 * Fetches all dashboard layouts and full tile records (including html_content).
 * Used by full-refresh callers that need layout and tile payloads together.
 */
export async function getDashboardData(assistant: Assistant): Promise<DashboardPaneData> {
  const apiKey = await requireUserApiKey();
  try {
    const [layoutRows, tileRows] = await Promise.all([
      readAcrossRoots(assistant, (root) =>
        fetchContext(
          apiKey,
          rootContext(root, assistant.userId, assistant.agentId, 'Dashboards/Layouts')
        )
      ),
      readAcrossRoots(assistant, (root) =>
        fetchContext(
          apiKey,
          rootContext(root, assistant.userId, assistant.agentId, 'Dashboards/Tiles')
        )
      ),
    ]);

    const dashboards = layoutRows as unknown as DashboardRecord[];
    const tiles = tileRows as unknown as TileRecord[];

    return { dashboards, tiles };
  } catch (err) {
    console.error('[dashboard.ts getDashboardData] Error:', err);
    return { dashboards: [], tiles: [] };
  }
}
