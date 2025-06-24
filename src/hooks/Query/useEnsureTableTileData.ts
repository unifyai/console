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
} from "@/types/evals/grid";
import {
  fetchProjectsContextsFields,
  buildOptimisticTableDataItem,
  OptimisticUpdateDependencies,
} from "@/utils/data/buildServerDataOptimistic";

/**
 * Hook that guarantees the TableDataItem for a given table tile exists in the React-Query cache.
 * It suspends (using React-Query + Suspense) until the data has been built and cached.
 */
export function useEnsureTableTileData(params: {
  interfaceId: string;
  tabId: string;
  tileId: string;
  projectId: string;
  actions: {
    tileActions: GranularTileActions;
    projectsActions: ProjectsActions;
    contextActions: ContextActions;
    fieldsActions: FieldsActions;
    logsActions: LogsActions;
  };
}) {
  const { interfaceId, tabId, tileId, projectId, actions } = params;
  const queryClient = useQueryClient();

  /** Query that builds the TableDataItem if it is missing */
  return useQuery<TableDataItem>({
    queryKey: ["ensureTableTileData", tileId, projectId],
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!tileId && !!projectId,
    queryFn: async () => {
      // Fast-path: if data already cached just return it.
      const existing = queryClient.getQueryData<TableDataItem>([
        "tableDataItem",
        tileId,
      ]);
      if (existing) return existing;

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
        fieldsArray,
        undefined,
        { updateCache: true }
      );

      return tableDataItem;
    },
  });
} 