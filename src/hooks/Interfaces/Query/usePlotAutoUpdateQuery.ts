"use client";

import { useQuery, useQueryClient, CancelledError } from "@tanstack/react-query";
import { PlotDataItem, LogsActions, FieldsActions, ProjectsActions, ContextActions } from "@/types/interfaces/grid";
import { PlotArguments } from "@/types/interfaces/logs";
import { buildPlotDataItem } from "@/utils/data/buildPlotDataItem";
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";
import { selectTileById, selectTilesForTab } from "@/contexts/selectors/tile";
import { convertTileToTileData } from "@/contexts/utils/sliceUtils";
import { useTileData } from "@/contexts/hooks/tile/useTileData";
import { fetchOrBuildProjectsContextsFields } from "@/utils/data/buildServerData";
import { selectProjectById } from "@/contexts/selectors/project";
import { useCallback, useState } from "react";

/**
 * Debug flag for performance logging
 * Set NEXT_PUBLIC_DEBUG_PERFORMANCE=true to enable detailed performance timing logs
 */
const DEBUG_PERFORMANCE = process.env.NEXT_PUBLIC_DEBUG_PERFORMANCE === 'true';

/**
 * Conditional debug logger for performance metrics
 */
const perfLog = (...args: any[]) => {
  if (DEBUG_PERFORMANCE) {
    console.log(...args);
  }
};

/**
 * Auto-updating plot data query hook that:
 * • Automatically polls every 5s when auto_update === "true"
 * • Uses a separate query key to avoid conflicts with manual cache updates
 * • Syncs data with the main plotDataItem cache
 * • Exposes a manualRefresh() helper for manual refresh buttons
 * • Exposes a stop() helper to cancel polling and in-flight requests
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
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  
  // Get reactive access to tile item for auto_update flag
  const { data: tileDataState } = useTileData(tileId, tabId);
  const autoUpdate = tileDataState?.auto_update === "true";
  
  // Use a separate query key to avoid conflicts with manual cache updates
  const autoUpdateQueryKey = ["plotDataItem", "autoUpdate", tileId];
  // Main cache key for syncing
  const mainQueryKey = ["plotDataItem", tileId];
  
  const queryFn = async ({ signal }: { signal?: AbortSignal }): Promise<PlotDataItem> => {
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
      true
    );
    perfLog(
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
    
    try {
      // Build plot data item using the same logic as optimistic updates
      const plotDataItem = await buildPlotDataItem(
        plotTileData,
        tableTilesData,
        plotArguments,
        fieldsArray,
        projectId,
        logsActions,
        signal as AbortSignal
      );

      // Update BOTH the auto-update cache AND the main cache to keep them in sync
      queryClient.setQueryData(autoUpdateQueryKey, plotDataItem);
      queryClient.setQueryData(mainQueryKey, plotDataItem);

      return plotDataItem;
    } catch (e: any) {
      const msg = String(e?.message || e);
      if ((signal as AbortSignal | undefined)?.aborted || e?.name === 'AbortError' || /Abort|aborted|Connection closed/i.test(msg)) {
        throw new CancelledError();
      }
      throw e;
    }
  };
  
  const query = useQuery<PlotDataItem>({
    queryKey: autoUpdateQueryKey,
    queryFn,
    enabled: !!tileId && !!tileDataState && autoUpdate,
    refetchInterval: autoUpdate ? 5000 : false,
    refetchIntervalInBackground: autoUpdate,
    refetchOnWindowFocus: autoUpdate,
    refetchOnReconnect: autoUpdate,
    refetchOnMount: autoUpdate,
    staleTime: 0, // Always fetch fresh data when auto-update is enabled
  });

  // Manual refresh function
  const manualRefresh = useCallback(async () => {
    // Mark that this is a manual refresh
    setIsManualRefresh(true);
    try {
      await query.refetch({ throwOnError: false });
    } finally {
      setIsManualRefresh(false);
    }
  }, [query]);
  
  const stop = useCallback(() => {
    // Disable auto-refresh by updating query defaults
    queryClient.setQueryDefaults(autoUpdateQueryKey, {
      ...queryClient.getQueryDefaults(autoUpdateQueryKey),
      refetchInterval: false,
    });
  }, [queryClient, autoUpdateQueryKey]);
  
  return {
    ...query,
    manualRefresh,
    stop,
    isManualRefresh,
  };
} 