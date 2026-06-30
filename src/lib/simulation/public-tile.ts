/**
 * Mock resolver for the public tile-view route.
 *
 * The `/tile/view/[token]` page resolves tile HTML through `fetchTileData`,
 * which talks to Orchestra admin endpoints via raw `fetch` (outside the
 * Orchestra client seam). In simulation mode there is no Orchestra, so this
 * helper resolves a tile directly from the scenario fixtures by token.
 */

import { listScenarios } from './scenario';
import { buildTables } from './fixtures/tables';

export interface MockTileData {
  token: string;
  title: string;
  htmlContent: string;
  hasDataBindings: boolean;
  dataBindingContexts: string | null;
  dataBindingsJson: string | null;
  onDataScript: string | null;
  description: string | null;
}

/** Finds a tile by token across every scenario's Dashboards/Tiles fixtures. */
export function findMockTileData(token: string): MockTileData | null {
  for (const scenario of listScenarios()) {
    const tiles = buildTables(scenario.dataset)['Dashboards/Tiles'] ?? [];
    const row = tiles.find((t) => t.token === token);
    if (!row) continue;
    return {
      token: String(row.token),
      title: String(row.title ?? 'Untitled Tile'),
      htmlContent: String(row.htmlContent ?? ''),
      hasDataBindings: Boolean(row.hasDataBindings),
      dataBindingContexts: (row.dataBindingContexts as string | null) ?? null,
      dataBindingsJson: null,
      onDataScript: null,
      description: (row.description as string | null) ?? null,
    };
  }
  return null;
}
