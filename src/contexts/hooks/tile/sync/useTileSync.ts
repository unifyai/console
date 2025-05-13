"use client";

import { useMemo } from "react";
import { usePatchTileQuery } from "@/hooks/Query/useTilesQuery";
import { GranularTileActions } from "@/types/evals/grid";
import { useTile, TileActions } from "../useTile";
import { usePlotTileSync, PlotTileSyncResult } from "./usePlotTileSync";
import { useTableTileSync, TableTileSyncResult } from "./useTableTileSync";
import { TileDataActions } from "../useTileData";
import { useTileRouterRefresh } from "./useTileRouterRefresh";
import { TileData } from "@/types/evals/grid";
import { TileUIActions } from "../useTileUI";
import { TileMetaActions } from "../useTileMeta";

/**
 * Properties of the base Tile that will be synced with the server
 */
export type SyncedTileProperties = 'type' | 'table' | 'filters' | 'context' | 'column_context' | 
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
  // Base tile actions
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
  tileId: string | null,
  tabId: string | null,
  granularTileActions?: GranularTileActions
): TileSyncResult {
  // Get the original tile state and actions
  const {
    meta,
    metaActions,
    dataActions,
    uiActions,
    actions,
    exists
  } = useTile(
    tileId, 
    tabId, 
  );

  // Get specialized tile sync results
  const plotTileSync = usePlotTileSync(
    tileId,
    tabId,
    granularTileActions
  );

  const tableTileSync = useTableTileSync(
    tileId,
    tabId,
    granularTileActions
  );

  const tileName = meta?.name;

  // React router refresh handling
  const refreshRouter = useTileRouterRefresh(uiActions);

  // Create individual mutation hooks for each property
  const typeMutation = usePatchTileQuery();
  const tableMutation = usePatchTileQuery();
  const filtersMutation = usePatchTileQuery();
  const contextMutation = usePatchTileQuery();
  const columnContextMutation = usePatchTileQuery();
  const commonFilterMutation = usePatchTileQuery();
  const groupingMutation = usePatchTileQuery();
  const metricMutation = usePatchTileQuery();
  const freezeMutation = usePatchTileQuery();
  const autoUpdateMutation = usePatchTileQuery();

  const colorMutation = usePatchTileQuery();
  const visibleMutation = usePatchTileQuery();
  const lockedMutation = usePatchTileQuery();
  const pendingMutation = usePatchTileQuery();
  const loadingMutation = usePatchTileQuery();
  const errorMutation = usePatchTileQuery();
  const movedMutation = usePatchTileQuery();
  const staticMutation = usePatchTileQuery();

  if (!granularTileActions) {
    return {
      actions: null,
        exists: false,
      loading: {
        type: false,
        table: false,
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
        table: null,
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
    type: typeMutation,
    table: tableMutation,
    filters: filtersMutation,
    context: contextMutation,
    column_context: columnContextMutation,
    common_filter: commonFilterMutation,
    grouping: groupingMutation,
    metric: metricMutation,
    freeze: freezeMutation,
    auto_update: autoUpdateMutation,
    visible: visibleMutation,
    locked: lockedMutation,
    pending: pendingMutation,
    loading: loadingMutation,
    error: errorMutation,
    moved: movedMutation,
    static: staticMutation,
    color: colorMutation,
  };

  // Individual wrapper functions for each property
  const wrapType = (type?: string) => {
    if (!metaActions) return;
    
    // 1) Update local state immediately
    metaActions.setType(type);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    typeMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { type: type ?? null } as Partial<TileData>,
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true, withPending: true });
      }
    });
  };

  const wrapTable = (table?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setTable(table);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    tableMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { table: table ?? null } as Partial<TileData>,
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router
        refreshRouter();
      }
    });
  };

  const wrapFilters = (filters?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setFilters(filters);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    filtersMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { filters: filters ?? null } as Partial<TileData>,
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapContext = (context?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setContext(context);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    contextMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { context: context ?? null } as Partial<TileData>,
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true, withPending: true });
      }
    });
  };

  const wrapColumnContext = (columnContext?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setColumnContext(columnContext);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    columnContextMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { column_context: columnContext ?? null } as Partial<TileData>,
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true, withPending: true });
      }
    });
  };

  const wrapCommonFilter = (commonFilter?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setCommonFilter(commonFilter);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    commonFilterMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { common_filter: commonFilter ?? null } as Partial<TileData>,
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapGrouping = (grouping?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setGrouping(grouping);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    groupingMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { grouping: grouping ?? null } as Partial<TileData>,
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapMetric = (metric?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setMetric(metric);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    metricMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { metric: metric ?? null } as Partial<TileData>,
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapFreeze = (freeze?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setFreeze(freeze);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    freezeMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { freeze: freeze ?? null } as Partial<TileData>,
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapAutoUpdate = (autoUpdate?: string) => {
    if (!dataActions) return;
    
    // 1) Update local state immediately
    dataActions.setAutoUpdate(autoUpdate);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    autoUpdateMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { auto_update: autoUpdate ?? null } as Partial<TileData>,
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router
        refreshRouter();
      }
    });
  };

  const wrapVisible = (visible?: boolean) => {
    if (!uiActions) return;
    
    // 1) Update local state immediately
    uiActions.setVisible(visible ?? true);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    visibleMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { visible: visible ?? true } as Partial<TileData>,
      actions: granularTileActions
    });
  };

  const wrapColor = (color?: string) => {
    if (!uiActions) return;
    
    // 1) Update local state immediately
    uiActions.setColor(color);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    colorMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { color: color ?? null } as Partial<TileData>,
      actions: granularTileActions
    });
  };

  // Create the enhanced actions object with the wrapped setters
  const syncedMetaActions = useMemo<TileMetaActions | null>(() => {
    if (!metaActions) return null;

    return {
      ...metaActions,
      // Use the specialized wrapper functions for each property
      setType: wrapType,
    } as TileMetaActions;
  }, [
    metaActions,
    tabId,
    tileName,
    granularTileActions,
  ]);

  // Create the enhanced actions object with the wrapped setters
  const syncedDataActions = useMemo<TileDataActions | null>(() => {
    if (!dataActions) return null;

    return {
      ...dataActions,
      // Use the specialized wrapper functions for each property
      setType: wrapType,
      setTable: wrapTable,
      setFilters: wrapFilters, 
      setContext: wrapContext,
      setColumnContext: wrapColumnContext,
      setCommonFilter: wrapCommonFilter,
      setGrouping: wrapGrouping,
      setMetric: wrapMetric,
      setFreeze: wrapFreeze,
      setAutoUpdate: wrapAutoUpdate,
      setColor: wrapColor,
    } as TileDataActions;
  }, [
    dataActions,
    tabId,
    tileName,
    granularTileActions,
    uiActions
  ]);

  // Create the enhanced actions object with the wrapped setters
  const syncedUIActions = useMemo<TileUIActions | null>(() => {
    if (!uiActions) return null;

    return {
      ...uiActions,
      // Use the specialized wrapper functions for each property
      setVisible: wrapVisible,
      setColor: wrapColor,
    } as TileUIActions;
  }, [
    uiActions,
    tabId,
    tileName,
    granularTileActions,
  ]);

  // Create the full actions object that incorporates the synced data actions
  const syncedActions = useMemo(() => {
    if (!actions || !syncedDataActions) return null;

    // Create a new actions object with the right structure
    const newActions: TileActions = {
      ...actions,
      // Replace the data and ui actions with our synced versions
      data: syncedDataActions,
      ui: syncedUIActions,
      // Copy over the meta and UI actions as is
      meta: syncedMetaActions,
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
    table: mutations.table.isPending,
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
    table: mutations.table.error,
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
    actions: syncedActions,
    exists,
    loading,
    error,
    plotTile: plotTileSync.exists ? plotTileSync : null,
    tableTile: tableTileSync.exists ? tableTileSync : null
  };
} 