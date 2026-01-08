'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GranularTileActions,
  ProjectsActions,
  ContextActions,
  FieldsActions,
  LogsActions,
  TileData,
  PlotDataItem,
} from '@/types/interfaces/grid';
import {
  fetchProjectsContextsFields,
  buildOptimisticPlotDataItem,
  OptimisticUpdateDependencies,
} from '@/utils/data/buildServerDataOptimistic';
import { getUsedTableNames } from '@/utils/data/buildPlotDataItem';
import { PlotArguments } from '@/types/interfaces/logs';
import { useMemo } from 'react';

/**
 * Debug flag for tile dependency logging
 * Set NEXT_PUBLIC_DEBUG_TILE_DEPENDENCIES=true to enable detailed tile dependency logs
 */
const DEBUG_TILE_DEPENDENCIES = process.env.NEXT_PUBLIC_DEBUG_TILE_DEPENDENCIES === 'true';

/**
 * Conditional debug logger for tile dependencies
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_TILE_DEPENDENCIES) {
    console.log(...args);
  }
};

/**
 * Hook that guarantees a PlotDataItem exists for the given plot tile.
 * It assumes that all table dependencies have already been built by useEnsureTableTileData
 * and are available in the cache. This avoids duplication of table building logic.
 */
export function useEnsurePlotTileData(params: {
  interfaceId: string;
  tabId: string;
  tileId: string;
  projectId: string;
  plotArguments: PlotArguments;
  actions: {
    tileActions: GranularTileActions;
    projectsActions: ProjectsActions;
    contextActions: ContextActions;
    fieldsActions: FieldsActions;
    logsActions: LogsActions;
  };
}) {
  const { interfaceId, tabId, tileId, projectId, plotArguments, actions } = params;
  const queryClient = useQueryClient();

  // Read tiles from cache so dependency readiness can respond to cache updates
  const tiles = queryClient.getQueryData<TileData[]>(['tiles', tabId]);

  // Check dependency readiness reactively based on tiles and cached table data
  const dependenciesReady = useMemo(() => {
    if (!tileId || !projectId) return false;
    if (!tiles) return false;

    const plotTile = tiles.find((t) => t.id === tileId);
    if (!plotTile) return false;

    // Get dependency names
    const depsNames = getUsedTableNames(plotTile);
    debugLog(
      `[useEnsurePlotTileData] Checking dependencies for plot ${plotTile.name}: [${depsNames.join(
        ', '
      )}]`
    );

    // Check if all dependencies have their data cached
    for (const tableName of depsNames) {
      const depTile = tiles.find((t) => t.name === tableName);
      if (!depTile || !depTile.id) {
        debugLog(
          `[useEnsurePlotTileData] Dependency table "${tableName}" not found for plot ${plotTile.name}`
        );
        return false;
      }

      const tableData = queryClient.getQueryData(['tableDataItem', depTile.id]);
      if (!tableData) {
        debugLog(
          `[useEnsurePlotTileData] Dependency "${tableName}" (${depTile.id}) not ready for plot ${plotTile.name}`
        );
        return false;
      }

      debugLog(`[useEnsurePlotTileData] Dependency "${tableName}" is ready ✓`);
    }

    debugLog(`[useEnsurePlotTileData] All dependencies ready for plot ${plotTile.name} ✓`);
    return true;
  }, [tileId, projectId, tabId, tiles, queryClient]);

  return useQuery<PlotDataItem>({
    queryKey: ['ensurePlotTileData', tileId, projectId],
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!tileId && !!projectId && !!plotArguments && dependenciesReady,
    queryFn: async () => {
      debugLog(`[useEnsurePlotTileData] Building plot data for tile: ${tileId}`);

      // Fast-path: already exists
      const existing = queryClient.getQueryData<PlotDataItem>(['plotDataItem', tileId]);
      if (existing) {
        debugLog(`[useEnsurePlotTileData] Plot data already cached for tile: ${tileId}`);
        return existing;
      }

      /* --------------------------------------------------
       * Get tile metadata
       * ------------------------------------------------*/
      let tiles = queryClient.getQueryData<TileData[]>(['tiles', tabId]);
      if (!tiles) {
        tiles = await actions.tileActions.list(tabId, undefined, false);
        queryClient.setQueryData(['tiles', tabId], tiles);
      }
      const plotTile = tiles?.find((t) => t.id === tileId);
      if (!plotTile) throw new Error(`Plot tile ${tileId} not found in tab ${tabId}`);

      /* --------------------------------------------------
       * Verify that all table dependencies are ready
       * (They should have been built by useEnsureTableTileData)
       * ------------------------------------------------*/
      const depsNames = getUsedTableNames(plotTile);
      debugLog(
        `[useEnsurePlotTileData] Plot tile ${plotTile.name} depends on tables: [${depsNames.join(', ')}]`
      );

      for (const tableName of depsNames) {
        const depTile = tiles?.find((t) => t.name === tableName);
        if (!depTile || !depTile.id) {
          throw new Error(
            `Dependency table "${tableName}" not found for plot tile ${plotTile.name}`
          );
        }

        const tableData = queryClient.getQueryData(['tableDataItem', depTile.id]);
        if (!tableData) {
          throw new Error(
            `Table data for "${tableName}" (${depTile.id}) not ready. This should have been built by useEnsureTableTileData before plot building started.`
          );
        }

        debugLog(
          `[useEnsurePlotTileData] Dependency "${tableName}" is ready for plot ${plotTile.name}`
        );
      }

      /* --------------------------------------------------
       * Build the plot data item itself
       * ------------------------------------------------*/
      const dependencies: OptimisticUpdateDependencies = {
        queryClient,
        projectId,
        tabId,
      };

      const { fieldsArray } = await fetchProjectsContextsFields(
        dependencies,
        tiles!.filter((t) => t.type === 'Table'),
        { refetchFields: true, updateCache: true }
      );

      debugLog(`[useEnsurePlotTileData] Building plot data item for: ${plotTile.name}`);
      const plotDataItem = await buildOptimisticPlotDataItem(
        dependencies,
        plotTile,
        tiles!.filter((t) => t.type === 'Table'),
        plotArguments as PlotArguments,
        fieldsArray,
        { updateCache: true }
      );

      debugLog(`[useEnsurePlotTileData] Successfully built plot data for: ${plotTile.name}`);
      return plotDataItem;
    },
  });
}
