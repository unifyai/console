"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlotDataItem, LogsActions, FieldsActions, ProjectsActions, ContextActions } from "@/types/evals/grid";
import { LogFieldsResponseProps, PlotArguments } from "@/types/evals/logs";
import { buildPlotDataItem } from "@/utils/data/buildPlotDataItem";
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";
import { selectTileById, selectTilesForTab } from "@/contexts/selectors/tile";
import { convertTileToTileData } from "@/contexts/utils/sliceUtils";
import { useTileData } from "@/contexts/hooks/tile/useTileData";
import { fetchOrBuildProjectsContextsFields } from "@/utils/data/buildServerData";
import { selectProjectById } from "@/contexts/selectors/project";

/**
 * Auto-updating plot data query hook that:
 * • Automatically polls every 5s when auto_update === "true"
 * • Uses the same query key as usePatchTileQueryOptimistic for cache consistency
 * • Exposes a manualRefresh() helper for manual refresh buttons
 * • Handles dependencies on multiple table tiles
 * • Fetches fresh data using current tile and table states
 */
export function usePlotAutoUpdateQuery(
  tileId: string | null,
  tabId: string | null,
  projectId: string,
  pending: boolean,
  logsActions: LogsActions,
  projectsActions: ProjectsActions,
  contextActions: ContextActions,
  fieldsActions: FieldsActions,
) {
  const storeApi = useStoreApiContext();
  const queryClient = useQueryClient();
  
  // Get reactive access to tile item for auto_update flag
  const { data: tileDataState } = useTileData(tileId, tabId);
  const autoUpdate = tileDataState?.auto_update === "true";
  
  // Use the same query key as the optimistic update hook for cache consistency
  const queryKey = ["plotDataItem", tileId];
  
  const queryFn = async (): Promise<PlotDataItem> => {
    if (!tileId || !tabId) throw new Error("Tile ID and Tab ID are required");
    
    // Get current state from store
    const state = storeApi.getState();
    const projectData = selectProjectById(state, projectId);
    const plotTile = selectTileById(state, tileId);
    const plotTileData = plotTile ? convertTileToTileData(plotTile) : null;
    
    if (!plotTileData) throw new Error("Plot tile not found");
    
    // Get all tiles in the tab and filter to table tiles
    const tilesInTab = selectTilesForTab(state, tabId).map(tile => convertTileToTileData(tile));
    const tableTilesData = tilesInTab.filter(tile => tile.type === "Table");
    
    // Get plot arguments from cache (should be built by tab-level logic)
    const plotArguments = queryClient.getQueryData<PlotArguments>(["plotArguments", tabId]) || {} as PlotArguments;
    
    // Build or fetch projects, contexts and fields
    const tProjectsAndContexts = performance.now();
    const { contexts, fields: fieldsArray } = await fetchOrBuildProjectsContextsFields(
      queryClient,
      tableTilesData,
      projectId,
      false,
      true,
      true,
      projectsActions,
      contextActions,
      fieldsActions
    );
    console.log(
      `[perf] usePlotAutoUpdateQuery – fetchOrBuildProjectsContextsFields: ${(
        performance.now() - tProjectsAndContexts
      ).toFixed(2)} ms`
    );

    // Update the contexts in the store
    storeApi.setState({
      ...state,
      projectsById: {
        ...state.projectsById,
        [projectId]: {
            ...projectData,
            contexts: contexts
        }
      }
    });
    
    // Build plot data item using the same logic as optimistic updates
    const plotDataItem = await buildPlotDataItem(
      plotTileData,
      tableTilesData,
      plotArguments,
      fieldsArray,
      projectId,
      logsActions
    );

    // Update the PlotDataItem in the cache
    queryClient.setQueryData(['plotDataItem', tileId], plotDataItem);

    return plotDataItem;
  };
  
  const query = useQuery<PlotDataItem>({
    queryKey,
    queryFn,
    enabled: !!tileId && !!tabId && !!tileDataState && !pending,
    refetchInterval: autoUpdate ? 5000 : false,
    refetchIntervalInBackground: autoUpdate,
    refetchOnWindowFocus: autoUpdate,
    refetchOnReconnect: autoUpdate,
    refetchOnMount: false,
    staleTime: 0, // Always fetch fresh data
  });
    
  // Manual refresh function for refresh buttons
  const manualRefresh = () => query.refetch({ throwOnError: false });
  
  return {
    ...query,
    manualRefresh,
  };
} 