"use client";

import { useMemo } from "react";
import { usePatchTileQuery } from "@/hooks/Query/useTilesQuery";
import { GranularTileActions, LogsActions, FieldsActions, ProjectsActions, ContextActions } from "@/types/evals/grid";
import { useTile, TileActions } from "../useTile";
import { usePlotTileSync, PlotTileSyncResult } from "./usePlotTileSync";
import { useTableTileSync, TableTileSyncResult } from "./useTableTileSync";
import { TileDataActions } from "../useTileData";
import { TileData } from "@/types/evals/grid";
import { TileUIActions } from "../useTileUI";
import { TileMetaActions } from "../useTileMeta";
import { usePatchTileQueryOptimistic } from "@/hooks/Query/usePatchTileQueryOptimistic";
import { selectTileByTabIdAndName } from "@/contexts/selectors/tile";
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";

/**
 * Debug flag for state syncing logging
 * Set NEXT_PUBLIC_DEBUG_STATE_SYNCING=true to enable detailed state synchronization logs
 */
const DEBUG_STATE_SYNCING = process.env.NEXT_PUBLIC_DEBUG_STATE_SYNCING === 'true';

/**
 * Conditional debug logger for state syncing
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_STATE_SYNCING) {
    console.log(...args);
  }
};

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
  granularTileActions?: GranularTileActions,
  projectsActions?: ProjectsActions,
  contextActions?: ContextActions,
  logsActions?: LogsActions,
  fieldsActions?: FieldsActions
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
    granularTileActions,
    projectsActions,
    contextActions,
    logsActions,
    fieldsActions
  );

  const tableTileSync = useTableTileSync(
    tileId,
    tabId,
    granularTileActions,
    projectsActions,
    contextActions,
    logsActions,
    fieldsActions,
  );

  const tileName = meta?.name;

  // Get the store API reference - can be used to get state outside of React's render cycle
  const storeApi = useStoreApiContext();

  // Create individual mutation hooks for each property
  const typeMutation = usePatchTileQueryOptimistic();
  const tableMutation = usePatchTileQueryOptimistic();
  const filtersMutation = usePatchTileQueryOptimistic();
  const contextMutation = usePatchTileQueryOptimistic();
  const columnContextMutation = usePatchTileQueryOptimistic();
  const contextAndColumnContextMutation = usePatchTileQueryOptimistic();
  const commonFilterMutation = usePatchTileQueryOptimistic();
  const groupingMutation = usePatchTileQueryOptimistic();
  const metricMutation = usePatchTileQueryOptimistic();
  const freezeMutation = usePatchTileQueryOptimistic();
  const autoUpdateMutation = usePatchTileQuery();

  const colorMutation = usePatchTileQuery();
  const visibleMutation = usePatchTileQuery();
  const lockedMutation = usePatchTileQuery();
  const pendingMutation = usePatchTileQuery();
  const loadingMutation = usePatchTileQuery();
  const errorMutation = usePatchTileQuery();
  const movedMutation = usePatchTileQuery();
  const staticMutation = usePatchTileQuery();

  // Create a mapping for the mutations to use in the loading and error states
  const mutations = {
    type: typeMutation,
    table: tableMutation,
    filters: filtersMutation,
    context: contextMutation,
    column_context: columnContextMutation,
    context_and_column_context: contextAndColumnContextMutation,
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
  const wrapType = async (type?: string) => {
    if (!metaActions || !tileName || !tabId || !granularTileActions) return;
    
    // Set UI states immediately before any operations
    if (uiActions) {
      uiActions.setLoading(true);
      uiActions.setPending(true);
    }
    
    // 1) Update local state immediately
    metaActions.setType(type);

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();
    const tile = selectTileByTabIdAndName(state, tabId, tileName);

    // 2) Optimistic server update
    await typeMutation.mutateAsync({
      id: tile?.id || "",
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      updateData: { type: type ?? null } as Partial<TileData>,
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: true,
      rebuildPlotData: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router without setting states again
      debugLog("[wrapType] onSettled:", type);
      uiActions.setLoading(false);
      uiActions.setPending(false);
    });
  };

  const wrapTable = (table?: string) => {
    if (!dataActions || !tileName || !tabId || !granularTileActions) return;
    
    // 1) Update local state immediately
    dataActions.setTable(table);

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();
    const tile = selectTileByTabIdAndName(state, tabId, tileName);
    
    // 2) Optimistic server update
    tableMutation.mutate({
      id: tile?.id || "",
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      updateData: { table: table ?? null } as Partial<TileData>,
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: false,
      rebuildPlotData: false,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    });
  };

  const wrapFilters = async (filters?: string) => {
    if (!dataActions || !tileName || !tabId || !granularTileActions) return;
    
    // Set loading state immediately
    if (uiActions) {
      uiActions.setLoading(true);
    }
    
    // 1) Update local state immediately
    dataActions.setFilters(filters);

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();
    const tile = selectTileByTabIdAndName(state, tabId, tileName);
    
    // 2) Optimistic server update
    await filtersMutation.mutateAsync({
      id: tile?.id || "",
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      updateData: { filters: filters ?? null } as Partial<TileData>,
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: true, 
      rebuildPlotData: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router
      debugLog("[wrapFilters] onSettled:", filters);
      uiActions.setLoading(false);
    });
  };

  const wrapContext = async (context?: string) => {
    if (!dataActions || !tileName || !tabId || !granularTileActions) return;
    
    // Set UI states immediately before any operations
    if (uiActions) {
      uiActions.setLoading(true);
      uiActions.setPending(true);
    }
    
    // 1) Update local state immediately
    dataActions.setContext(context);

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();
    const tile = selectTileByTabIdAndName(state, tabId, tileName);

    // 2) Optimistic server update
    await contextMutation.mutateAsync({
      id: tile?.id || "",
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      updateData: { context: context ?? null } as Partial<TileData>,
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: true,
      rebuildPlotData: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router - UI states already set
      debugLog("[wrapContext] onSettled:", context);
      uiActions.setLoading(false);
      uiActions.setPending(false);
    });
  };

  const wrapColumnContext = async (columnContext?: string) => {
    if (!dataActions || !tileName || !tabId || !granularTileActions) return;
    
    // Set UI states immediately before any operations
    if (uiActions) {
      uiActions.setLoading(true);
      uiActions.setPending(true);
    }
    
    // 1) Update local state immediately
    dataActions.setColumnContext(columnContext);

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();
    const tile = selectTileByTabIdAndName(state, tabId, tileName);
    
    // 2) Optimistic server update
    await columnContextMutation.mutateAsync({
      id: tile?.id || "",
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      updateData: { column_context: columnContext ?? null } as Partial<TileData>,
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: true,
      rebuildPlotData: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router - UI states already set
      debugLog("[wrapColumnContext] onSettled:", columnContext);
      uiActions.setLoading(false);
      uiActions.setPending(false);
    });
  };

  /**
   * Efficiently updates both context and column_context together in a single operation
   * to minimize UI flickering and reduce the number of router refreshes.
   */
  const wrapContextAndColumnContext = async (context?: string, columnContext?: string) => {
    if (!dataActions || !tileName || !tabId || !granularTileActions) return;
    
    // Set UI states immediately before any operations
    if (uiActions) {
      uiActions.setLoading(true);
      uiActions.setPending(true);
    }
    
    // 1) Update both local states immediately
    dataActions.setContext(context);
    dataActions.setColumnContext(columnContext);

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();
    const tile = selectTileByTabIdAndName(state, tabId, tileName);
    
    // Create update object with both properties
    const updateData: Partial<TileData> = {
      context: context ?? null,
      column_context: columnContext ?? null
    } as Partial<TileData>;
    
    // 2) Single optimistic server update with both changes
    await contextAndColumnContextMutation.mutateAsync({
      id: tile?.id || "",
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      updateData,
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: true,
      rebuildPlotData: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Single router refresh for both changes
      debugLog("[wrapContextAndColumnContext] onSettled:", context, columnContext);
      uiActions.setLoading(false);
      uiActions.setPending(false);
    });
  };

  const wrapCommonFilter = async (commonFilter?: string) => {
    if (!dataActions || !tileName || !tabId || !granularTileActions) return;
    
    // Set loading state immediately
    if (uiActions) {
      uiActions.setLoading(true);
    }
    
    // 1) Update local state immediately
    dataActions.setCommonFilter(commonFilter);

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();
    const tile = selectTileByTabIdAndName(state, tabId, tileName);

    // 2) Optimistic server update
    await commonFilterMutation.mutateAsync({
      id: tile?.id || "",
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      updateData: { common_filter: commonFilter ?? null } as Partial<TileData>,
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: true,
      rebuildPlotData: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router
      debugLog("[wrapCommonFilter] onSettled:", commonFilter);
      uiActions.setLoading(false);
    });
  };

  const wrapGrouping = async (grouping?: string) => {
    if (!dataActions || !tileName || !tabId || !granularTileActions) return;
    
    // Set loading state immediately
    if (uiActions) {
      uiActions.setLoading(true);
    }
    
    // 1) Update local state immediately
    dataActions.setGrouping(grouping);

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();
    const tile = selectTileByTabIdAndName(state, tabId, tileName);

    // 2) Optimistic server update
    await groupingMutation.mutateAsync({
      id: tile?.id || "",
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      updateData: { grouping: grouping ?? null } as Partial<TileData>,
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: true,
      rebuildPlotData: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router
      debugLog("[wrapGrouping] onSettled:", grouping);
      uiActions.setLoading(false);
    });
  };

  const wrapMetric = async (metric?: string) => {
    if (!dataActions || !tileName || !tabId || !granularTileActions) return;
    
    // Set loading state immediately
    if (uiActions) {
      uiActions.setLoading(true);
    }
    
    // 1) Update local state immediately
    dataActions.setMetric(metric);

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();
    const tile = selectTileByTabIdAndName(state, tabId, tileName);
    
    // 2) Optimistic server update
    await metricMutation.mutateAsync({
      id: tile?.id || "",
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      updateData: { metric: metric ?? null } as Partial<TileData>,
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: true,
      rebuildPlotData: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router
      debugLog("[wrapMetric] onSettled:", metric);
      uiActions.setLoading(false);
    });
  };

  const wrapFreeze = async (freeze?: string) => {
    if (!dataActions || !tileName || !tabId || !granularTileActions) return;
    
    // Set loading state immediately
    if (uiActions) {
      uiActions.setLoading(true);
    }
    
    // 1) Update local state immediately
    dataActions.setFreeze(freeze);

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();
    const tile = selectTileByTabIdAndName(state, tabId, tileName);

    // 2) Optimistic server update
    await freezeMutation.mutateAsync({
      id: tile?.id || "",
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      updateData: { freeze: freeze ?? null } as Partial<TileData>,
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: true,
      rebuildPlotData: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router
      debugLog("[wrapFreeze] onSettled:", freeze);
      uiActions.setLoading(false);
    });
  };

  const wrapAutoUpdate = (autoUpdate?: string) => {
    if (!dataActions || !tileName || !tabId || !granularTileActions) return;
    
    // 1) Update local state immediately
    dataActions.setAutoUpdate(autoUpdate);
    
    // 2) Optimistic server update
    autoUpdateMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { auto_update: autoUpdate ?? null } as Partial<TileData>,
      actions: granularTileActions,
    });
  };

  const wrapVisible = (visible?: boolean) => {
    if (!uiActions || !tileName || !tabId || !granularTileActions) return;
    
    // 1) Update local state immediately
    uiActions.setVisible(visible ?? true);
    
    // 2) Optimistic server update
    visibleMutation.mutate({
      tab_id: tabId,
      name: tileName,
      updateData: { visible: visible ?? true } as Partial<TileData>,
      actions: granularTileActions
    });
  };

  const wrapColor = (color?: string) => {
    if (!uiActions || !tileName || !tabId || !granularTileActions) return;
    
    // 1) Update local state immediately
    uiActions.setColor(color);
    
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
    if (!metaActions || !tileName || !tabId || !granularTileActions) return null;

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
    if (!dataActions || !tileName || !tabId || !granularTileActions) return null;

    return {
      ...dataActions,
      // Use the specialized wrapper functions for each property
      setType: wrapType,
      setTable: wrapTable,
      setFilters: wrapFilters, 
      setContext: wrapContext,
      setColumnContext: wrapColumnContext,
      setContextAndColumnContext: wrapContextAndColumnContext,
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
    if (!uiActions || !tileName || !tabId || !granularTileActions) return null;

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
    if (!actions || !syncedDataActions || !syncedMetaActions || !syncedUIActions) return null;

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
      terminalTileActions: actions.terminalTileActions,
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