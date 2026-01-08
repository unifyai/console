'use client';

import { useMemo, useRef, useEffect } from 'react';
import { usePatchSpecializedTileQuery } from '@/hooks/Interfaces/Query/useTilesQuery';
import {
  ContextActions,
  FieldsActions,
  LogsActions,
  ProjectsActions,
  GranularTileActions,
} from '@/types/interfaces/grid';
import { useTableTile, TableActions } from '../useTableTile';
import { useTileUI } from '../useTileUI';
import { useTileMeta } from '@/contexts/hooks/tile/useTileMeta';
import { usePatchSpecializedTileQueryOptimistic } from '@/hooks/Interfaces/Query/usePatchSpecializedTileQueryOptimistic';
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { showErrorToast, withLoadingToastFn } from '@/components/Common/Toasts/notifications';

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
export type SyncedTableProperties =
  | 'tableType'
  | 'pageNumber'
  | 'columnOrder'
  | 'hiddenColumns'
  | 'defaultHiddenColumns'
  | 'sorting'
  | 'groupSorting'
  | 'columnsPinLeft'
  | 'columnsPinRight'
  | 'selected';

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
  const defaultHiddenColumnsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
      if (defaultHiddenColumnsTimeoutRef.current) {
        clearTimeout(defaultHiddenColumnsTimeoutRef.current);
      }
    };
  }, []);

  // Create individual mutation hooks for each property
  const tableTypeMutation = usePatchSpecializedTileQueryOptimistic<'Table'>();
  const sortingMutation = usePatchSpecializedTileQueryOptimistic<'Table'>();
  const groupSortingMutation = usePatchSpecializedTileQueryOptimistic<'Table'>();
  const columnOrderMutation = usePatchSpecializedTileQuery<'Table'>();
  const hiddenColumnsMutation = usePatchSpecializedTileQuery<'Table'>();
  const columnsPinLeftMutation = usePatchSpecializedTileQuery<'Table'>();
  const columnsPinRightMutation = usePatchSpecializedTileQuery<'Table'>();
  const selectedMutation = usePatchSpecializedTileQuery<'Table'>();
  const pageNumberMutation = usePatchSpecializedTileQueryOptimistic<'Table'>();
  const defaultHiddenColumnsMutation = usePatchSpecializedTileQuery<'Table'>();
  // Create a mapping for the mutations to use in the loading and error states
  const mutations = {
    tableType: tableTypeMutation,
    sorting: sortingMutation,
    groupSorting: groupSortingMutation,
    columnOrder: columnOrderMutation,
    hiddenColumns: hiddenColumnsMutation,
    defaultHiddenColumns: defaultHiddenColumnsMutation,
    columnsPinLeft: columnsPinLeftMutation,
    columnsPinRight: columnsPinRightMutation,
    selected: selectedMutation,
    pageNumber: pageNumberMutation,
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
    try {
      await withLoadingToastFn(
        () =>
          tableTypeMutation.mutateAsync({
            tabId: tabId,
            name: tileName,
            projectId: state.activeProjectId || '',
            tileType: 'Table',
            updateData: { tableType: value ?? null },
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
          }),
        {
          loadingMessage: 'Updating table type...',
          successMessage: 'Table type updated!',
          errorMessage: `Failed to set table type for ${tileName}`,
        }
      );
    } catch (error) {
      // Error is already handled by withLoadingToast, just re-throwing
      throw error;
    } finally {
      // 3. Refresh the router and set the loading state
      debugLog('[wrapTableType] onSettled:', value);
      uiActions?.setLoading(false);
      uiActions?.setPending(false);
    }
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
    try {
      await withLoadingToastFn(
        () =>
          sortingMutation.mutateAsync({
            tabId: tabId,
            name: tileName,
            projectId: state.activeProjectId || '',
            tileType: 'Table',
            updateData: { sorting: value ?? null },
            refetchProjects: false,
            refetchContexts: false,
            refetchFields: true,
            rebuildTableData: true,
            rebuildPlotData: false,
            actions: granularTileActions,
            projectsActions: projectsActions as ProjectsActions,
            contextActions: contextActions as ContextActions,
            logsActions: logsActions as LogsActions,
            fieldsActions: fieldsActions as FieldsActions,
          }),
        {
          loadingMessage: 'Applying sorting...',
          successMessage: 'Sorting applied!',
          errorMessage: `Failed to set sorting for ${tileName}`,
        }
      );
    } catch (error) {
      // Error is already handled by withLoadingToast, just re-throwing
      throw error;
    } finally {
      // 3. Refresh the router and set the loading state
      debugLog('[wrapSorting] onSettled:', value);
      uiActions?.setLoading(false);
    }
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
    try {
      await withLoadingToastFn(
        () =>
          groupSortingMutation.mutateAsync({
            tabId: tabId,
            name: tileName,
            projectId: state.activeProjectId || '',
            tileType: 'Table',
            updateData: { groupSorting: value ?? null },
            refetchProjects: false,
            refetchContexts: false,
            refetchFields: true,
            rebuildTableData: true,
            rebuildPlotData: false,
            actions: granularTileActions,
            projectsActions: projectsActions as ProjectsActions,
            contextActions: contextActions as ContextActions,
            logsActions: logsActions as LogsActions,
            fieldsActions: fieldsActions as FieldsActions,
          }),
        {
          loadingMessage: 'Applying grouping...',
          successMessage: 'Grouping applied successfully!',
          errorMessage: `Failed to apply grouping for ${tileName}.`,
        }
      );
    } catch (error) {
      // Error is already handled by withLoadingToast, just re-throwing
      throw error;
    } finally {
      // 3. Refresh the router and set the loading state
      debugLog('[wrapGroupSorting] onSettled:', value);
      uiActions?.setLoading(false);
    }
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
        tabId: tabId,
        name: tileName,
        tileType: 'Table',
        updateData: { columnOrder: value ?? null },
        actions: granularTileActions,
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
        tabId: tabId,
        name: tileName,
        tileType: 'Table',
        updateData: { hiddenColumns: value ?? null },
        actions: granularTileActions,
      });
    }, 500); // 500ms debounce delay
  };

  const wrapDefaultHiddenColumns = (value: boolean | undefined) => {
    if (!tableTileActions || !granularTileActions) return;

    // 1) Update local state immediately (no debouncing for UI responsiveness)
    tableTileActions.setDefaultHiddenColumns(value);

    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Debounce the server mutation
    // Clear any existing timeout
    if (defaultHiddenColumnsTimeoutRef.current) {
      clearTimeout(defaultHiddenColumnsTimeoutRef.current);
    }

    defaultHiddenColumnsTimeoutRef.current = setTimeout(() => {
      defaultHiddenColumnsMutation.mutate({
        tabId: tabId,
        name: tileName,
        tileType: 'Table',
        updateData: { defaultHiddenColumns: value ?? true },
        actions: granularTileActions,
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
        tabId: tabId,
        name: tileName,
        tileType: 'Table',
        updateData: { columnsPinLeft: value ?? null },
        actions: granularTileActions,
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
        tabId: tabId,
        name: tileName,
        tileType: 'Table',
        updateData: { columnsPinRight: value ?? null },
        actions: granularTileActions,
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
        tabId: tabId,
        name: tileName,
        tileType: 'Table',
        updateData: { selected: value ?? null },
        actions: granularTileActions,
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
    try {
      await withLoadingToastFn(
        () =>
          pageNumberMutation.mutateAsync({
            tabId: tabId,
            name: tileName,
            projectId: state.activeProjectId || '',
            tileType: 'Table',
            updateData: { pageNumber: value ?? null },
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
          }),
        {
          loadingMessage: 'Changing page...',
          successMessage: 'Page changed!',
          errorMessage: `Failed to set page number for ${tileName}`,
        }
      );
    } catch (error) {
      // Error is already handled by withLoadingToast, just re-throwing
      throw error;
    } finally {
      // 3. Refresh the router and set the loading state
      debugLog('[wrapPageNumber] onSettled:', value);
      uiActions?.setLoading(false);
    }
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
      setDefaultHiddenColumns: wrapDefaultHiddenColumns,
      setColumnsPinLeft: wrapColumnsPinLeft,
      setColumnsPinRight: wrapColumnsPinRight,
      setSelected: wrapSelected,
      setPageNumber: wrapPageNumber,
    } as TableActions;
  }, [tableTileActions, tabId, tileId, granularTileActions, uiActions]);

  if (!tableTileActions || !granularTileActions) {
    return {
      tableTile,
      tableTileActions: null,
      loading: {
        tableType: false,
        columnOrder: false,
        hiddenColumns: false,
        defaultHiddenColumns: true,
        sorting: false,
        groupSorting: false,
        columnsPinLeft: false,
        columnsPinRight: false,
        selected: false,
        pageNumber: false,
        any: false,
      },
      error: {
        tableType: null,
        sorting: null,
        groupSorting: null,
        columnOrder: null,
        hiddenColumns: null,
        defaultHiddenColumns: null,
        columnsPinLeft: null,
        columnsPinRight: null,
        selected: null,
        pageNumber: null,
        any: false,
      },
      exists: false,
    };
  }

  // Prepare loading states
  const loading: TableLoadingStates = {
    tableType: mutations.tableType.isPending,
    sorting: mutations.sorting.isPending,
    groupSorting: mutations.groupSorting.isPending,
    columnOrder: mutations.columnOrder.isPending,
    hiddenColumns: mutations.hiddenColumns.isPending,
    defaultHiddenColumns: mutations.defaultHiddenColumns.isPending,
    columnsPinLeft: mutations.columnsPinLeft.isPending,
    columnsPinRight: mutations.columnsPinRight.isPending,
    selected: mutations.selected.isPending,
    pageNumber: mutations.pageNumber.isPending,
    any: false,
  };

  // Check if any property is loading
  loading.any = Object.values(mutations).some((m) => m.isPending);

  // Prepare error states
  const error: TableErrorStates = {
    tableType: mutations.tableType.error,
    sorting: mutations.sorting.error,
    groupSorting: mutations.groupSorting.error,
    columnOrder: mutations.columnOrder.error,
    hiddenColumns: mutations.hiddenColumns.error,
    defaultHiddenColumns: mutations.defaultHiddenColumns.error,
    columnsPinLeft: mutations.columnsPinLeft.error,
    columnsPinRight: mutations.columnsPinRight.error,
    selected: mutations.selected.error,
    pageNumber: mutations.pageNumber.error,
    any: false,
  };

  // Check if any property has error
  error.any = Object.values(mutations).some((m) => !!m.error);

  return {
    tableTile,
    tableTileActions: syncedActions,
    loading,
    error,
    exists,
  };
}
