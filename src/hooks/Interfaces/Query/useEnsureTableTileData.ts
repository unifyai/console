"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GranularTileActions,
  ProjectsActions,
  ContextActions,
  FieldsActions,
  LogsActions,
  TileData,
  TableDataItem,
} from "@/types/interfaces/grid";
import {
  fetchProjectsContextsFields,
  buildOptimisticTableDataItem,
  OptimisticUpdateDependencies,
} from "@/utils/data/buildServerDataOptimistic";
import { TableArguments } from "@/types/interfaces/logs";

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
 * Hook that guarantees the TableDataItem for a given table tile exists in the React-Query cache.
 * It suspends (using React-Query + Suspense) until the data has been built and cached.
 */
export function useEnsureTableTileData(params: {
  interfaceId: string;
  tabId: string;
  tileId: string;
  projectId: string;
  tableArguments: TableArguments;
  actions: {
    tileActions: GranularTileActions;
    projectsActions: ProjectsActions;
    contextActions: ContextActions;
    fieldsActions: FieldsActions;
    logsActions: LogsActions;
  };
}) {
  const { interfaceId, tabId, tileId, projectId, tableArguments, actions } = params;
  const queryClient = useQueryClient();

  /** Query that builds the TableDataItem if it is missing */
  return useQuery<TableDataItem>({
    queryKey: ["ensureTableTileData", tileId, projectId],
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!tileId && !!projectId && !!tableArguments,
    queryFn: async () => {
      debugLog(`[useEnsureTableTileData] Building table data for tile: ${tileId}`);
      
      // Fast-path: if data already cached just return it.
      const existing = queryClient.getQueryData<TableDataItem>([
        "tableDataItem",
        tileId,
      ]);
      if (existing) {
        debugLog(`[useEnsureTableTileData] Table data already cached for tile: ${tileId}`);
        return existing;
      }

      /* --------------------------------------------------
       * Locate the TileData metadata (cheap)             
       * ------------------------------------------------*/
      let tiles = queryClient.getQueryData<TileData[]>(["tiles", tabId]);
      if (!tiles) {
        tiles = await actions.tileActions.list(tabId, undefined, false);
        queryClient.setQueryData(["tiles", tabId], tiles);
      }
      const tile = tiles?.find((t) => t.id === tileId);
      if (!tile) throw new Error(`Tile ${tileId} not found in tab ${tabId}`);

      debugLog(`[useEnsureTableTileData] Building table data item for: ${tile.name}`);

      /* --------------------------------------------------
       * Build dependencies & fetch required resources    
       * ------------------------------------------------*/
      const dependencies: OptimisticUpdateDependencies = {
        queryClient,
        projectId,
        tabId,
        projectsActions: actions.projectsActions,
        contextActions: actions.contextActions,
        fieldsActions: actions.fieldsActions,
        logsActions: actions.logsActions,
      } as OptimisticUpdateDependencies;

      const { fieldsArray } = await fetchProjectsContextsFields(
        dependencies,
        [tile],
        { refetchFields: true, updateCache: true }
      );

      /* --------------------------------------------------
       * Build & cache the TableDataItem                   
       * ------------------------------------------------*/
      const tableDataItem = await buildOptimisticTableDataItem(
        dependencies,
        tile,
        fieldsArray[0],
        tableArguments,
        { updateCache: true }
      );

      debugLog(`[useEnsureTableTileData] Successfully built table data for: ${tile.name}`);
      return tableDataItem;
    },
  });
} 