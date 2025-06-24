"use client";

import { useMemo, useRef, useEffect } from "react";
import { usePatchSpecializedTileQuery } from "@/hooks/Query/useTilesQuery";
import { ContextActions, FieldsActions, LogsActions, ProjectsActions, GranularTileActions } from "@/types/evals/grid";
import { useTableTile, TableActions } from "../useTableTile";
import { useTileUI } from "../useTileUI";
import { useTileMeta } from "@/contexts/hooks/tile/useTileMeta";
import { usePatchSpecializedTileQueryOptimistic } from "@/hooks/Query/usePatchSpecializedTileQueryOptimistic";
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
 * Properties of the TableTile that will be synced with the server
 */
export type SyncedTableProperties = 'table_type' | 
'page_number' | 
'column_order' |
'hidden_columns' |
'sorting' | 
'group_sorting' | 
'columns_pin_left' | 
'columns_pin_right' | 
'selected';

/**
 * Loading states for each property
 */
export type TableLoadingStates = {
  [key in SyncedTableProperties]: boolean;
} & {
  any: boolean;
};

/**
 * Error states for each property
 */
export type TableErrorStates = {
  [key in SyncedTableProperties]: Error | null;
} & {
  any: boolean;
};

/**
 * Return type for the useTableTileSync hook
 */
export interface TableTileSyncResult {
  tableTile: ReturnType<typeof useTableTile>['tableTile'];
  tableTileActions: TableActions | null;
  loading: TableLoadingStates;
  error: TableErrorStates;
  exists: boolean;
}

/**
 * Thin wrapper around useTableTile that transparently keeps the
 * server in-sync (optimistic-update) for the critical table fields.
 *
 * The API surface is similar to useTableTile but with additional
 * loading and error state information.
 */
export function useTableTileSync(
  tileId: string | null,
  tabId: string | null,
  granularTileActions?: GranularTileActions,
  projectsActions?: ProjectsActions,
  contextActions?: ContextActions,
  logsActions?: LogsActions,
  fieldsActions?: FieldsActions
): TableTileSyncResult {
  // Get the original table tile state and actions
  const { tableTile, tableTileActions, exists } = useTableTile(tileId, tabId);

  // Get UI actions to update loading state
  const { meta } = useTileMeta(tileId, tabId);
  const { uiActions } = useTileUI(tileId, tabId);
  const tileName = meta?.name;

  // Get the store API reference - can be used to get state outside of React's render cycle
  const storeApi = useStoreApiContext();

  // Debounce timeout refs for mutations that don't need immediate server sync
  const selectedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const columnOrderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hiddenColumnsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const columnsPinLeftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const columnsPinRightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (selectedTimeoutRef.current) {
        clearTimeout(selectedTimeoutRef.current);
      }
      if (columnOrderTimeoutRef.current) {
        clearTimeout(columnOrderTimeoutRef.current);
      }
      if (hiddenColumnsTimeoutRef.current) {
        clearTimeout(hiddenColumnsTimeoutRef.current);
      }
      if (columnsPinLeftTimeoutRef.current) {
        clearTimeout(columnsPinLeftTimeoutRef.current);
      }
      if (columnsPinRightTimeoutRef.current) {
        clearTimeout(columnsPinRightTimeoutRef.current);
      }
    };
  }, []);

  // Create individual mutation hooks for each property
  const tableTypeMutation = usePatchSpecializedTileQueryOptimistic<"Table">();
  const sortingMutation = usePatchSpecializedTileQueryOptimistic<"Table">();
  const groupSortingMutation = usePatchSpecializedTileQueryOptimistic<"Table">();
  const columnOrderMutation = usePatchSpecializedTileQuery<"Table">();
  const hiddenColumnsMutation = usePatchSpecializedTileQuery<"Table">();
  const columnsPinLeftMutation = usePatchSpecializedTileQuery<"Table">();
  const columnsPinRightMutation = usePatchSpecializedTileQuery<"Table">();
  const selectedMutation = usePatchSpecializedTileQuery<"Table">();
  const pageNumberMutation = usePatchSpecializedTileQueryOptimistic<"Table">();

  // Create a mapping for the mutations to use in the loading and error states
  const mutations = {
    table_type: tableTypeMutation,
    sorting: sortingMutation,
    group_sorting: groupSortingMutation,
    column_order: columnOrderMutation,
    hidden_columns: hiddenColumnsMutation,
    columns_pin_left: columnsPinLeftMutation,
    columns_pin_right: columnsPinRightMutation,
    selected: selectedMutation,
    page_number: pageNumberMutation,
  };

  // Individual wrapper functions for each property
  const wrapTableType = async (value: string | undefined) => {
    if (!tableTileActions || !granularTileActions) return;


    // Set UI states immediately before any operations
    if (uiActions) {
      uiActions.setLoading(true);
      uiActions.setPending(true);
    }
    
    // 1) Update local state immediately
    tableTileActions.setTableType(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();

    // 2) Optimistic server update
    await tableTypeMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      tileType: "Table",
      updateData: { table_type: value ?? null },
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
      // 3. Refresh the router and set the loading state
      debugLog("[wrapTableType] onSettled:", value);
      uiActions?.setLoading(false);
      uiActions?.setPending(false);
    });
  };

  const wrapSorting = async (value: string | undefined) => {
    if (!tableTileActions || !granularTileActions) return;

    // Set UI states immediately before any operations
    if (uiActions) {
      uiActions.setLoading(true);
    }
    
    // 1) Update local state immediately
    tableTileActions.setSorting(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();

    // 2) Optimistic server update
    await sortingMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      tileType: "Table",
      updateData: { sorting: value ?? null },
      refetchProjects: false,
      refetchContexts: false,
      refetchFields: false,
      rebuildTableData: true,
      rebuildPlotData: false,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router and set the loading state
      debugLog("[wrapSorting] onSettled:", value);
      uiActions?.setLoading(false);
    });
  };

  const wrapGroupSorting = async (value: string | undefined) => {
    if (!tableTileActions || !granularTileActions) return;

    // Set UI states immediately before any operations
    if (uiActions) {
      uiActions.setLoading(true);
    }
    
    // 1) Update local state immediately
    tableTileActions.setGroupSorting(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();

    // 2) Optimistic server update
    await groupSortingMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      tileType: "Table",
      updateData: { group_sorting: value ?? null },
      refetchProjects: false,
      refetchContexts: false,
      refetchFields: false,
      rebuildTableData: true,
      rebuildPlotData: false,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router and set the loading state
      debugLog("[wrapGroupSorting] onSettled:", value);
      uiActions?.setLoading(false);
    });
  };

  const wrapColumnOrder = (value: string | undefined) => {
    if (!tableTileActions || !granularTileActions) return;
    
    // 1) Update local state immediately (no debouncing for UI responsiveness)
    tableTileActions.setColumnOrder(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Debounce the server mutation
    // Clear any existing timeout
    if (columnOrderTimeoutRef.current) {
      clearTimeout(columnOrderTimeoutRef.current);
    }
    
    // Set a new timeout for the server mutation
    columnOrderTimeoutRef.current = setTimeout(() => {
      columnOrderMutation.mutate({
        tab_id: tabId,
        name: tileName,
        tileType: "Table",
        updateData: { column_order: value ?? null },
        actions: granularTileActions
      });
    }, 500); // 500ms debounce delay
  };

  const wrapHiddenColumns = (value: string | undefined) => {
    if (!tableTileActions || !granularTileActions) return;
    
    // 1) Update local state immediately (no debouncing for UI responsiveness)
    tableTileActions.setHiddenColumns(value);   
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Debounce the server mutation
    // Clear any existing timeout
    if (hiddenColumnsTimeoutRef.current) {
      clearTimeout(hiddenColumnsTimeoutRef.current);
    }
    
    // Set a new timeout for the server mutation
    hiddenColumnsTimeoutRef.current = setTimeout(() => {
      hiddenColumnsMutation.mutate({
        tab_id: tabId,    
        name: tileName,
        tileType: "Table",
        updateData: { hidden_columns: value ?? null },
        actions: granularTileActions
      });
    }, 500); // 500ms debounce delay
  };    

  const wrapColumnsPinLeft = (value: string | undefined) => {
    if (!tableTileActions || !granularTileActions) return;
    
    // 1) Update local state immediately (no debouncing for UI responsiveness)
    tableTileActions.setColumnsPinLeft(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Debounce the server mutation
    // Clear any existing timeout
    if (columnsPinLeftTimeoutRef.current) {
      clearTimeout(columnsPinLeftTimeoutRef.current);
    }
    
    // Set a new timeout for the server mutation
    columnsPinLeftTimeoutRef.current = setTimeout(() => {
      columnsPinLeftMutation.mutate({
        tab_id: tabId,
        name: tileName,   
        tileType: "Table",
        updateData: { columns_pin_left: value ?? null },
        actions: granularTileActions
      });
    }, 500); // 500ms debounce delay
  };

  const wrapColumnsPinRight = (value: string | undefined) => {  
    if (!tableTileActions || !granularTileActions) return;
    
    // 1) Update local state immediately (no debouncing for UI responsiveness)
    tableTileActions.setColumnsPinRight(value);
    
    // Don't attempt server update if we don't have required info   
    if (!tileName || !tabId) return;

    // 2) Debounce the server mutation
    // Clear any existing timeout
    if (columnsPinRightTimeoutRef.current) {
      clearTimeout(columnsPinRightTimeoutRef.current);
    }
    
    // Set a new timeout for the server mutation
    columnsPinRightTimeoutRef.current = setTimeout(() => {
      columnsPinRightMutation.mutate({
        tab_id: tabId,
        name: tileName,   
        tileType: "Table",
        updateData: { columns_pin_right: value ?? null },
        actions: granularTileActions
      });
    }, 500); // 500ms debounce delay
  };

  const wrapSelected = (value: string | undefined) => { 
    if (!tableTileActions || !granularTileActions) return;
    
    // 1) Update local state immediately (no debouncing for UI responsiveness)
    tableTileActions.setSelected(value);
    
    // Don't attempt server update if we don't have required info   
    if (!tileName || !tabId) return;

    // 2) Debounce the server mutation
    // Clear any existing timeout
    if (selectedTimeoutRef.current) {
      clearTimeout(selectedTimeoutRef.current);
    }
    
    // Set a new timeout for the server mutation
    selectedTimeoutRef.current = setTimeout(() => {
      selectedMutation.mutate({
        tab_id: tabId,
        name: tileName,   
        tileType: "Table",
        updateData: { selected: value ?? null },
        actions: granularTileActions
      });
    }, 500); // 500ms debounce delay
  };

  const wrapPageNumber = async (value: string | undefined) => {   
    if (!tableTileActions || !granularTileActions) return;

    // Set UI states immediately before any operations
    if (uiActions) {
      uiActions.setLoading(true);
    }
    
    // 1) Update local state immediately
    tableTileActions.setPageNumber(value);
    
    // Don't attempt server update if we don't have required info   
    if (!tileName || !tabId) return;

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();

    // 2) Optimistic server update
    await pageNumberMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,   
      projectId: state.activeProjectId || "",
      tileType: "Table",
      updateData: { page_number: value ?? null },
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      rebuildTableData: true,
      rebuildPlotData: false,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router and set the loading state
      debugLog("[wrapPageNumber] onSettled:", value);
      uiActions?.setLoading(false);
    });
  };

  // Create the enhanced actions object
  const syncedActions = useMemo(() => {
    if (!tableTileActions) return null;

    return {
      ...tableTileActions,
      // Use the specialized wrapper functions for each property
      setTableType: wrapTableType,
      setSorting: wrapSorting,
      setGroupSorting: wrapGroupSorting,
      setColumnOrder: wrapColumnOrder,
      setHiddenColumns: wrapHiddenColumns,
      setColumnsPinLeft: wrapColumnsPinLeft,
      setColumnsPinRight: wrapColumnsPinRight,
      setSelected: wrapSelected,
      setPageNumber: wrapPageNumber,
    } as TableActions;
  }, [
    tableTileActions,
    tabId,
    tileId,
    granularTileActions,
    uiActions
  ]);

  if (!tableTileActions || !granularTileActions) {
    return {
      tableTile,
      tableTileActions: null,
      loading: {
        table_type: false,
        column_order: false,
        hidden_columns: false,
        sorting: false,
        group_sorting: false,
        columns_pin_left: false,
        columns_pin_right: false,
        selected: false,
        page_number: false,
        any: false
      },
      error: {
        table_type: null,
        sorting: null,
        group_sorting: null,
        column_order: null,
        hidden_columns: null,
        columns_pin_left: null,
        columns_pin_right: null,
        selected: null,
        page_number: null,
        any: false
      },
      exists: false
    };
  }

  // Prepare loading states
  const loading: TableLoadingStates = {
    table_type: mutations.table_type.isPending,
    sorting: mutations.sorting.isPending,
    group_sorting: mutations.group_sorting.isPending,
    column_order: mutations.column_order.isPending,
    hidden_columns: mutations.hidden_columns.isPending,
    columns_pin_left: mutations.columns_pin_left.isPending,
    columns_pin_right: mutations.columns_pin_right.isPending,
    selected: mutations.selected.isPending,
    page_number: mutations.page_number.isPending,
    any: false
  };
  
  // Check if any property is loading
  loading.any = Object.values(mutations).some(m => m.isPending);

  // Prepare error states
  const error: TableErrorStates = {
    table_type: mutations.table_type.error,
    sorting: mutations.sorting.error,
    group_sorting: mutations.group_sorting.error,
    column_order: mutations.column_order.error,
    hidden_columns: mutations.hidden_columns.error,
    columns_pin_left: mutations.columns_pin_left.error,
    columns_pin_right: mutations.columns_pin_right.error,
    selected: mutations.selected.error,
    page_number: mutations.page_number.error,
    any: false
  };
  
  // Check if any property has error
  error.any = Object.values(mutations).some(m => !!m.error);

  return {
    tableTile,
    tableTileActions: syncedActions,
    loading,
    error,
    exists
  };
} 