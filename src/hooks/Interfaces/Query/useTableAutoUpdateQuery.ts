"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TableDataItem, LogsActions, FieldsActions, ProjectsActions, ContextActions } from "@/types/interfaces/grid";
import { LogFieldsResponseProps } from "@/types/interfaces/logs";
import { fetchAndBuildTableDataItem } from "@/utils/data/buildTableDataItem";
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";
import { selectTileById } from "@/contexts/selectors/tile";
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
 * Auto-updating table data query hook that:
 * • Automatically polls every 5s when auto_update === "true"
 * • Uses a separate query key to avoid conflicts with manual cache updates
 * • Syncs data with the main tableDataItem cache
 * • Exposes a manualRefresh() helper for manual refresh buttons
 * • Exposes a stop() helper to cancel polling and in-flight requests
 * • Fetches fresh data using current tile state (filters, context, etc.)
 */
export function useTableAutoUpdateQuery(
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
  const autoUpdateQueryKey = ["tableDataItem", "autoUpdate", tileId];
  // Main cache key for syncing
  const mainQueryKey = ["tableDataItem", tileId];

  const queryFn = async (): Promise<TableDataItem> => {
    if (!tileId) throw new Error("Tile ID is required");
    
    // Get current tile data from store (uses latest filters, context, etc.)
    const state = storeApi.getState();
    const projectData = selectProjectById(state, projectId);
    const tile = selectTileById(state, tileId);
    const tileData = tile ? convertTileToTileData(tile) : null;
    
    if (!tileData) throw new Error("Tile not found");

    // Build or fetch projects, contexts and fields
    const tProjectsAndContexts = performance.now();
    const { contexts, fields: fieldsArray } = await fetchOrBuildProjectsContextsFields(
      queryClient,
      [tileData],
      projectId,
      false,
      true,
      true
    );
    perfLog(
      `[perf] useTableAutoUpdateQuery – fetchOrBuildProjectsContextsFields: ${(
        performance.now() - tProjectsAndContexts
      ).toFixed(2)} ms`
    );

    const fields = fieldsArray.length ? fieldsArray[0] : {} as LogFieldsResponseProps;

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

    // Get previous data from the main cache, not the auto-update cache
    const tLogs = performance.now();
    const prevTableDataItem = queryClient.getQueryData<TableDataItem>(mainQueryKey);
    const prevLogs = prevTableDataItem?.logs ?? [];
    perfLog(
      `[perf] useTableAutoUpdateQuery – getLogs: ${(
        performance.now() - tLogs
      ).toFixed(2)} ms`
    );

    // Get infinite query keys from the current tile
    const infiniteQueryKeys = tile?.tableTile?.infiniteQueryKeys || [];

    // Build table data item using the same logic as optimistic updates
    const tableDataItem = await fetchAndBuildTableDataItem(
      tileData,
      fields,
      projectId,
      logsActions,
      queryClient,
      infiniteQueryKeys,
      prevLogs,
      undefined, // signal - temporarily removed to fix connection issues
    );

    // Update BOTH the auto-update cache AND the main cache to keep them in sync
    queryClient.setQueryData(autoUpdateQueryKey, tableDataItem);
    queryClient.setQueryData(mainQueryKey, tableDataItem);

    return tableDataItem;
  };
  
  const query = useQuery<TableDataItem>({
    queryKey: autoUpdateQueryKey,
    queryFn,
    enabled: !!tileId && !!tileDataState && !pending && autoUpdate,
    refetchInterval: autoUpdate ? 5000 : false,
    refetchIntervalInBackground: autoUpdate,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
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
