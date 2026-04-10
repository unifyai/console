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
  options?: { extraParams?: string; fromFields?: string; filterExpr?: string }
): Promise<Record<string, unknown>[]> {
  let url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=Assistants&context=${encodeURIComponent(context)}&limit=${PAGE_SIZE}`;
  if (options?.extraParams) url += `&${options.extraParams}`;
  if (options?.fromFields) url += `&fromFields=${encodeURIComponent(options.fromFields)}`;
  if (options?.filterExpr) url += `&filterExpr=${encodeURIComponent(options.filterExpr)}`;

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
export const getDashboardMetadata = async (apiKey: string) => {
  return async (ownerId: string, assistantId: string): Promise<DashboardPaneData> => {
    'use server';

    try {
      const [layoutRows, tileRows] = await Promise.all([
        fetchContext(apiKey, `${ownerId}/${assistantId}/Dashboards/Layouts`),
        fetchContext(apiKey, `${ownerId}/${assistantId}/Dashboards/Tiles`, {
          fromFields: TILE_METADATA_FIELDS,
        }),
      ]);

      const dashboards = layoutRows as unknown as DashboardRecord[];
      const tiles = tileRows as unknown as TileRecord[];

      return { dashboards, tiles };
    } catch (err) {
      console.error('[dashboard.ts getDashboardMetadata] Error:', err);
      return { dashboards: [], tiles: [] };
    }
  };
};

/**
 * Factory for getDashboardTileContent server action.
 *
 * Fetches html_content for a single tile by token. Called lazily when a
 * tile is first viewed.
 */
export const getDashboardTileContent = async (apiKey: string) => {
  return async (
    ownerId: string,
    assistantId: string,
    tileToken: string
  ): Promise<string | null> => {
    'use server';

    if (!tileToken || tileToken === 'undefined') {
      return null;
    }

    try {
      const rows = await fetchContext(apiKey, `${ownerId}/${assistantId}/Dashboards/Tiles`, {
        fromFields: 'token&html_content',
        filterExpr: `token == '${tileToken}'`,
      });

      if (rows.length === 0) return null;
      return (rows[0] as unknown as { htmlContent?: string }).htmlContent ?? null;
    } catch (err) {
      console.error(`[dashboard.ts getDashboardTileContent] Error for token=${tileToken}:`, err);
      return null;
    }
  };
};

/**
 * Factory for getDashboardData server action.
 *
 * Fetches all dashboard layouts and full tile records (including html_content).
 * Kept for backward compatibility and full-refresh scenarios.
 */
export const getDashboardData = async (apiKey: string) => {
  return async (ownerId: string, assistantId: string): Promise<DashboardPaneData> => {
    'use server';

    try {
      const [layoutRows, tileRows] = await Promise.all([
        fetchContext(apiKey, `${ownerId}/${assistantId}/Dashboards/Layouts`),
        fetchContext(apiKey, `${ownerId}/${assistantId}/Dashboards/Tiles`),
      ]);

      const dashboards = layoutRows as unknown as DashboardRecord[];
      const tiles = tileRows as unknown as TileRecord[];

      return { dashboards, tiles };
    } catch (err) {
      console.error('[dashboard.ts getDashboardData] Error:', err);
      return { dashboards: [], tiles: [] };
    }
  };
};
