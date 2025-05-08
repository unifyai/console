"use client";

import { useMemo } from "react";
import { usePatchSpecializedTileQuery } from "@/hooks/Query/useTilesQuery";
import { GranularTileActions } from "@/types/evals/grid";
import { useTableTile, TableActions } from "../useTableTile";
import { useTileUI } from "../useTileUI";
import { useTileRouterRefresh } from "@/contexts/hooks/tile/sync/useTileRouterRefresh";

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
  tileName: string | null,
  tabId: string | null,
  interfaceName: string | null,
  projectName?: string | null,
  granularTileActions?: GranularTileActions
): TableTileSyncResult {
  // Get the original table tile state and actions
  const { tableTile, tableTileActions, exists } = useTableTile(
    tileName, 
    tabId, 
    interfaceName, 
    projectName
  );

  // Get UI actions to update loading state
  const { uiActions } = useTileUI(
    tileName,
    tabId,
    interfaceName,
    projectName
  );

  // React router refresh handling
  const refreshRouter = useTileRouterRefresh(uiActions);

  // Create individual mutation hooks for each property
  const tableTypeMutation = usePatchSpecializedTileQuery<"Table">();
  const sortingMutation = usePatchSpecializedTileQuery<"Table">();
  const groupSortingMutation = usePatchSpecializedTileQuery<"Table">();
  const columnOrderMutation = usePatchSpecializedTileQuery<"Table">();
  const hiddenColumnsMutation = usePatchSpecializedTileQuery<"Table">();
  const columnsPinLeftMutation = usePatchSpecializedTileQuery<"Table">();
  const columnsPinRightMutation = usePatchSpecializedTileQuery<"Table">();
  const selectedMutation = usePatchSpecializedTileQuery<"Table">();
  const pageNumberMutation = usePatchSpecializedTileQuery<"Table">();

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
  const wrapTableType = (value: string | undefined) => {
    if (!tableTileActions) return;
    
    // 1) Update local state immediately
    tableTileActions.setTableType(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    tableTypeMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Table",
      updateData: { table_type: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true, withPending: true });
      }
    });
  };

  const wrapSorting = (value: string | undefined) => {
    if (!tableTileActions) return;
    
    // 1) Update local state immediately
    tableTileActions.setSorting(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    sortingMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Table",
      updateData: { sorting: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapGroupSorting = (value: string | undefined) => {
    if (!tableTileActions) return;
    
    // 1) Update local state immediately
    tableTileActions.setGroupSorting(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    groupSortingMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Table",
      updateData: { group_sorting: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapColumnOrder = (value: string | undefined) => {
    if (!tableTileActions) return;
    
    // 1) Update local state immediately
    tableTileActions.setColumnOrder(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    columnOrderMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Table",
      updateData: { column_order: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapHiddenColumns = (value: string | undefined) => {
    if (!tableTileActions) return;
    
    // 1) Update local state immediately
    tableTileActions.setHiddenColumns(value);   
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    hiddenColumnsMutation.mutate({
      tab_id: tabId,    
      name: tileName,
      tileType: "Table",
      updateData: { hidden_columns: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };    

  const wrapColumnsPinLeft = (value: string | undefined) => {
    if (!tableTileActions) return;
    
    // 1) Update local state immediately
    tableTileActions.setColumnsPinLeft(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    columnsPinLeftMutation.mutate({
      tab_id: tabId,
      name: tileName,   
      tileType: "Table",
      updateData: { columns_pin_left: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapColumnsPinRight = (value: string | undefined) => {  
    if (!tableTileActions) return;
    
    // 1) Update local state immediately
    tableTileActions.setColumnsPinRight(value);
    
    // Don't attempt server update if we don't have required info   
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    columnsPinRightMutation.mutate({
      tab_id: tabId,
      name: tileName,   
      tileType: "Table",
      updateData: { columns_pin_right: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapSelected = (value: string | undefined) => { 
    if (!tableTileActions) return;
    
    // 1) Update local state immediately
    tableTileActions.setSelected(value);
    
    // Don't attempt server update if we don't have required info   
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    selectedMutation.mutate({
      tab_id: tabId,
      name: tileName,   
      tileType: "Table",
      updateData: { selected: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapPageNumber = (value: string | undefined) => {   
    if (!tableTileActions) return;
    
    // 1) Update local state immediately
    tableTileActions.setPageNumber(value);
    
    // Don't attempt server update if we don't have required info   
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    pageNumberMutation.mutate({
      tab_id: tabId,
      name: tileName,   
      tileType: "Table",
      updateData: { page_number: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
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
    tileName,
    granularTileActions,
    refreshRouter
  ]);

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