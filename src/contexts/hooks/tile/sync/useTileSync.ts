"use client";

import { useMemo } from "react";
import { usePatchTileQuery } from "@/hooks/Query/useTilesQuery";
import { GranularTileActions } from "@/types/evals/grid";
import { useTile, TileActions } from "../useTile";
import { usePlotTileSync, PlotTileSyncResult } from "./usePlotTileSync";
import { useTableTileSync, TableTileSyncResult } from "./useTableTileSync";
import { TileDataActions } from "../useTileData";
import { useTileRouterRefresh } from "./useTileRouterRefresh";

/**
 * Properties of the base Tile that will be synced with the server
 */
export type SyncedTileProperties = 'type' | 'filters' | 'context' | 'column_context' | 
  'common_filter' | 'grouping' | 'metric' | 'freeze' | 'color' | 'auto_update';

/**
 * Loading states for each property
 */
export type TileLoadingStates = {
  [key in SyncedTileProperties]: boolean;
} & {
  any: boolean;
};

/**
 * Error states for each property
 */
export type TileErrorStates = {
  [key in SyncedTileProperties]: Error | null;
} & {
  any: boolean;
};

/**
 * Return type for the useTileSync hook
 */
export interface TileSyncResult {
  // Base tile state and actions
  tile: ReturnType<typeof useTile>['tile'];
  actions: TileActions | null;
  exists: boolean;
  
  // Sync-specific states
  loading: TileLoadingStates;
  error: TileErrorStates;
  
  // Specialized tile results
  plotTile: PlotTileSyncResult | null;
  tableTile: TableTileSyncResult | null;
}

/**
 * Thin wrapper around useTile that transparently keeps the
 * server in-sync (optimistic-update) for the critical tile fields.
 * 
 * Also composes the specialized sync hooks for type-specific properties.
 */
export function useTileSync(
  tileName: string | null,
  tabId: string | null,
  granularTileActions?: GranularTileActions
): TileSyncResult {
  // Get the original tile state and actions
  const {
    tile,
    actions,
    dataActions,
    metaActions,
    uiActions,
    exists
  } = useTile(
    tileName, 
    tabId, 
  );

  // Get specialized tile sync results
  const plotTileSync = usePlotTileSync(
    tileName,
    tabId,
    granularTileActions
  );

  const tableTileSync = useTableTileSync(
    tileName,
    tabId,
    granularTileActions
  );

  // React router refresh handling
  const refreshRouter = useTileRouterRefresh(uiActions);

  // Create individual mutation hooks for each property
  const filtersMutation = usePatchTileQuery();
  const contextMutation = usePatchTileQuery();
  const columnContextMutation = usePatchTileQuery();
  const commonFilterMutation = usePatchTileQuery();
  const groupingMutation = usePatchTileQuery();
  const metricMutation = usePatchTileQuery();
  const freezeMutation = usePatchTileQuery();
  const colorMutation = usePatchTileQuery();
  const autoUpdateMutation = usePatchTileQuery();

  if (!granularTileActions) {
    return {
      tile,
      actions: null,
        exists: false,
      loading: {
        type: false,
        filters: false,
        context: false,
        column_context: false,
        common_filter: false,
        grouping: false,
        metric: false,
        freeze: false,
        color: false,
        auto_update: false,
        any: false
      },
      error: {
        type: null,
        filters: null,
        context: null,
        column_context: null,
        common_filter: null,
        grouping: null,
        metric: null,
        freeze: null,
        color: null,
        auto_update: null,
        any: false
      },
      plotTile: null,
      tableTile: null
    };
  } 

  // Create a mapping for the mutations to use in the loading and error states
  const mutations = {
    type: { isPending: false, error: null }, // Type is not directly mutable, handled by specialized actions
    filters: filtersMutation,
    context: contextMutation,
    column_context: columnContextMutation,
    common_filter: commonFilterMutation,
    grouping: groupingMutation,
    metric: metricMutation,
    freeze: freezeMutation,
    color: colorMutation,
    auto_update: autoUpdateMutation,
  };

  // Individual wrapper functions for each property
  const wrapFilters = (value?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setFilters(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    filtersMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { filters: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapContext = (value?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setContext(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    contextMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { context: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true, withPending: true });
      }
    });
  };

  const wrapColumnContext = (value?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setColumnContext(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    columnContextMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { column_context: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true, withPending: true });
      }
    });
  };

  const wrapCommonFilter = (value?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setCommonFilter(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    commonFilterMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { common_filter: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapGrouping = (value?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setGrouping(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    groupingMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { grouping: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapMetric = (value: string | undefined) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setMetric(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    metricMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { metric: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapFreeze = (value?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setFreeze(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    freezeMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { freeze: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapAutoUpdate = (value?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setAutoUpdate(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    autoUpdateMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { auto_update: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router
        refreshRouter();
      }
    });
  };

  // Create the enhanced actions object with the wrapped setters
  const syncedDataActions = useMemo<TileDataActions | null>(() => {
    if (!dataActions) return null;

    return {
      ...dataActions,
      // Use the specialized wrapper functions for each property
      setFilters: wrapFilters, 
      setContext: wrapContext,
      setColumnContext: wrapColumnContext,
      setCommonFilter: wrapCommonFilter,
      setGrouping: wrapGrouping,
      setMetric: wrapMetric,
      setFreeze: wrapFreeze,
      setAutoUpdate: wrapAutoUpdate,
    } as TileDataActions;
  }, [
    dataActions,
    tabId,
    tileName,
    granularTileActions,
    uiActions
  ]);

  // Create the full actions object that incorporates the synced data actions
  const syncedActions = useMemo(() => {
    if (!actions || !syncedDataActions) return null;

    // Create a new actions object with the right structure
    const newActions: TileActions = {
      ...actions,
      // Replace the data actions with our synced versions
      data: syncedDataActions,
      // Copy over the meta and UI actions as is
      meta: metaActions,
      ui: uiActions,
      // Include specialized actions
      tableTileActions: tableTileSync.tableTileActions || undefined,
      plotTileActions: plotTileSync.plotTileActions || undefined,
      // Keep the existing actions for view and editor
      viewTileActions: actions.viewTileActions,
      editorTileActions: actions.editorTileActions,
    } as TileActions;

    return newActions;
  }, [
    actions,
    syncedDataActions,
    metaActions,
    uiActions,
    tableTileSync.tableTileActions,
    plotTileSync.plotTileActions
  ]);

  // Prepare loading states
  const loading: TileLoadingStates = {
    type: mutations.type.isPending,
    filters: mutations.filters.isPending,
    context: mutations.context.isPending,
    column_context: mutations.column_context.isPending,
    common_filter: mutations.common_filter.isPending,
    grouping: mutations.grouping.isPending,
    metric: mutations.metric.isPending,
    freeze: mutations.freeze.isPending,
    color: mutations.color.isPending,
    auto_update: mutations.auto_update.isPending,
    any: false
  };
  
  // Check if any property is loading
  loading.any = Object.values(mutations).some(m => m.isPending) || 
               plotTileSync.loading.any || 
               tableTileSync.loading.any;

  // Prepare error states
  const error: TileErrorStates = {
    type: mutations.type.error,
    filters: mutations.filters.error,
    context: mutations.context.error,
    column_context: mutations.column_context.error,
    common_filter: mutations.common_filter.error,
    grouping: mutations.grouping.error,
    metric: mutations.metric.error,
    freeze: mutations.freeze.error,
    color: mutations.color.error,
    auto_update: mutations.auto_update.error,
    any: false
  };
  
  // Check if any property has error
  error.any = Object.values(mutations).some(m => !!m.error) ||
              plotTileSync.error.any ||
              tableTileSync.error.any;

  return {
    tile,
    actions: syncedActions,
    exists,
    loading,
    error,
    plotTile: plotTileSync.exists ? plotTileSync : null,
    tableTile: tableTileSync.exists ? tableTileSync : null
  };
} 