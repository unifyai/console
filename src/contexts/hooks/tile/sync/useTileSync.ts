'use client';

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePatchTileQuery } from '@/hooks/Interfaces/Query/useTilesQuery';
import {
  GranularTileActions,
  LogsActions,
  FieldsActions,
  ProjectsActions,
  ContextActions,
  TableDataItem,
} from '@/types/interfaces/grid';
import { useTile, TileActions } from '../useTile';
import { usePlotTileSync, PlotTileSyncResult } from './usePlotTileSync';
import { useTableTileSync, TableTileSyncResult } from './useTableTileSync';
import { TileDataActions } from '../useTileData';
import { TileData } from '@/types/interfaces/grid';
import { TileUIActions } from '../useTileUI';
import { TileMetaActions } from '../useTileMeta';
import { usePatchTileQueryOptimistic } from '@/hooks/Interfaces/Query/usePatchTileQueryOptimistic';
import { selectTileByTabIdAndName } from '@/contexts/selectors/tile';
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';

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
export type SyncedTileProperties =
  | 'name'
  | 'type'
  | 'table'
  | 'filters'
  | 'context'
  | 'columnContext'
  | 'commonFilter'
  | 'grouping'
  | 'metric'
  | 'freeze'
  | 'color'
  | 'autoUpdate';

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
  const { meta, metaActions, dataActions, uiActions, actions, exists } = useTile(tileId, tabId);

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
    fieldsActions
  );

  const tileName = meta?.name;

  // Get the store API reference - can be used to get state outside of React's render cycle
  const storeApi = useStoreApiContext();

  // Get queryClient for cache invalidation during context switches
  const queryClient = useQueryClient();

  // Create individual mutation hooks for each property
  const nameMutation = usePatchTileQueryOptimistic();
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
    name: nameMutation,
    type: typeMutation,
    table: tableMutation,
    filters: filtersMutation,
    context: contextMutation,
    columnContext: columnContextMutation,
    contextAndColumnContext: contextAndColumnContextMutation,
    commonFilter: commonFilterMutation,
    grouping: groupingMutation,
    metric: metricMutation,
    freeze: freezeMutation,
    autoUpdate: autoUpdateMutation,
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
  const wrapName = useCallback(
    async (name: string) => {
      if (!metaActions || !tileName || !tabId || !granularTileActions) return;

      // Set UI states immediately before any operations
      if (uiActions) {
        uiActions.setLoading(true);
        uiActions.setPending(true);
      }

      const oldName = tileName;

      // 1) Update local state immediately
      metaActions.setName(name);

      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();
      const tile = selectTileByTabIdAndName(state, tabId, oldName);

      // 2) Optimistic server update
      await nameMutation
        .mutateAsync({
          id: tile?.id || '',
          tabId: tabId,
          name: oldName, // for lookup by name if id is not primary
          projectId: state.activeProjectId || '',
          updateData: { name: name } as Partial<TileData>,
          refetchProjects: false,
          refetchContexts: false,
          refetchFields: false,
          rebuildTableData: false,
          rebuildPlotData: false,
          actions: granularTileActions,
          projectsActions: projectsActions as ProjectsActions,
          contextActions: contextActions as ContextActions,
          logsActions: logsActions as LogsActions,
          fieldsActions: fieldsActions as FieldsActions,
        })
        .then(() => {
          // 3. Refresh the router without setting states again
          debugLog('[wrapName] onSettled:', name);
          uiActions.setLoading(false);
          uiActions.setPending(false);
        });
    },
    [
      metaActions,
      tileName,
      tabId,
      granularTileActions,
      uiActions,
      storeApi,
      nameMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapType = useCallback(
    async (type?: string) => {
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
      await typeMutation
        .mutateAsync({
          id: tile?.id || '',
          tabId: tabId,
          name: tileName,
          projectId: state.activeProjectId || '',
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
        })
        .then(() => {
          // 3. Refresh the router without setting states again
          debugLog('[wrapType] onSettled:', type);
          uiActions.setLoading(false);
          uiActions.setPending(false);
        });
    },
    [
      metaActions,
      tileName,
      tabId,
      granularTileActions,
      uiActions,
      storeApi,
      typeMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapTable = useCallback(
    (table?: string) => {
      if (!dataActions || !tileName || !tabId || !granularTileActions) return;

      // 1) Update local state immediately
      dataActions.setTable(table);

      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();
      const tile = selectTileByTabIdAndName(state, tabId, tileName);

      // 2) Optimistic server update
      tableMutation.mutate({
        id: tile?.id || '',
        tabId: tabId,
        name: tileName,
        projectId: state.activeProjectId || '',
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
    },
    [
      dataActions,
      tileName,
      tabId,
      granularTileActions,
      storeApi,
      tableMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapFilters = useCallback(
    async (filters?: string) => {
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
      await filtersMutation
        .mutateAsync({
          id: tile?.id || '',
          tabId: tabId,
          name: tileName,
          projectId: state.activeProjectId || '',
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
        })
        .then(() => {
          // 3. Refresh the router
          debugLog('[wrapFilters] onSettled:', filters);
          uiActions.setLoading(false);
        });
    },
    [
      dataActions,
      tileName,
      tabId,
      granularTileActions,
      uiActions,
      storeApi,
      filtersMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  /**
   * Updates tile context - OPTIMIZED to not rebuild table data synchronously.
   */
  const wrapContext = useCallback(
    async (context?: string) => {
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

      // 2) Optimistic server update - DON'T rebuild table data synchronously
      await contextMutation
        .mutateAsync({
          id: tile?.id || '',
          tabId: tabId,
          name: tileName,
          projectId: state.activeProjectId || '',
          updateData: { context: context ?? null } as Partial<TileData>,
          refetchProjects: false, // Not needed for context switch
          refetchContexts: false, // Not needed for context switch
          refetchFields: true, // Fields may change with new context
          rebuildTableData: false, // DON'T rebuild synchronously - causes UI flash
          rebuildPlotData: false, // DON'T rebuild synchronously - causes UI flash
          actions: granularTileActions,
          projectsActions: projectsActions as ProjectsActions,
          contextActions: contextActions as ContextActions,
          logsActions: logsActions as LogsActions,
          fieldsActions: fieldsActions as FieldsActions,
        })
        .then(() => {
          // 3. Invalidate caches to trigger refetch with new context
          if (tile?.id) {
            const existingTableData = queryClient.getQueryData<TableDataItem>([
              'tableDataItem',
              tile.id,
            ]);
            if (existingTableData) {
              // FIX: Set isLoading: false to allow useInfiniteLogsQuery to run
              // Setting isLoading: true was causing a deadlock where the query
              // would never fetch because it checks !isTableDataLoading for enabled
              queryClient.setQueryData(['tableDataItem', tile.id], {
                ...existingTableData,
                isLoading: false,
                logs: [],
              });
            }
            // FIX: Query key structure is ['logs', 'infinite', tileId, tabId, projectId, context, ...]
            // Previous buggy predicate checked for 'infiniteLogs' which never matched
            queryClient.invalidateQueries({
              predicate: (q: any) => {
                const k0 = q?.queryKey?.[0] as string;
                const k1 = q?.queryKey?.[1] as string;
                const k2 = q?.queryKey?.[2] as string;
                return k0 === 'logs' && k1 === 'infinite' && k2 === tile.id;
              },
            });
          }
          debugLog('[wrapContext] onSettled:', context);
          uiActions.setLoading(false);
          uiActions.setPending(false);
        });
    },
    [
      dataActions,
      tileName,
      tabId,
      granularTileActions,
      uiActions,
      storeApi,
      contextMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
      queryClient,
    ]
  );

  /**
   * Updates tile column context - OPTIMIZED to not rebuild table data synchronously.
   */
  const wrapColumnContext = useCallback(
    async (columnContext?: string) => {
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

      // 2) Optimistic server update - DON'T rebuild table data synchronously
      await columnContextMutation
        .mutateAsync({
          id: tile?.id || '',
          tabId: tabId,
          name: tileName,
          projectId: state.activeProjectId || '',
          updateData: { columnContext: columnContext ?? null } as Partial<TileData>,
          refetchProjects: false, // Not needed
          refetchContexts: false, // Not needed
          refetchFields: false, // Column context doesn't change available fields
          rebuildTableData: false, // DON'T rebuild synchronously - causes UI flash
          rebuildPlotData: false, // DON'T rebuild synchronously - causes UI flash
          actions: granularTileActions,
          projectsActions: projectsActions as ProjectsActions,
          contextActions: contextActions as ContextActions,
          logsActions: logsActions as LogsActions,
          fieldsActions: fieldsActions as FieldsActions,
        })
        .then(() => {
          // 3. Invalidate caches to trigger refetch with new column context
          if (tile?.id) {
            const existingTableData = queryClient.getQueryData<TableDataItem>([
              'tableDataItem',
              tile.id,
            ]);
            if (existingTableData) {
              // FIX: Set isLoading: false to allow useInfiniteLogsQuery to run
              // Setting isLoading: true was causing a deadlock where the query
              // would never fetch because it checks !isTableDataLoading for enabled
              queryClient.setQueryData(['tableDataItem', tile.id], {
                ...existingTableData,
                isLoading: false,
                logs: [],
              });
            }
            // FIX: Query key structure is ['logs', 'infinite', tileId, tabId, projectId, context, ...]
            // Previous buggy predicate checked for 'infiniteLogs' which never matched
            queryClient.invalidateQueries({
              predicate: (q: any) => {
                const k0 = q?.queryKey?.[0] as string;
                const k1 = q?.queryKey?.[1] as string;
                const k2 = q?.queryKey?.[2] as string;
                return k0 === 'logs' && k1 === 'infinite' && k2 === tile.id;
              },
            });
          }
          debugLog('[wrapColumnContext] onSettled:', columnContext);
          uiActions.setLoading(false);
          uiActions.setPending(false);
        });
    },
    [
      dataActions,
      tileName,
      tabId,
      granularTileActions,
      uiActions,
      storeApi,
      columnContextMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
      queryClient,
    ]
  );

  /**
   * Efficiently updates both context and columnContext together in a single operation
   * to minimize UI flickering and reduce the number of router refreshes.
   *
   * OPTIMIZED: Does NOT rebuild TableDataItem synchronously to avoid UI flash.
   * Instead, invalidates the cache and lets React Query refetch naturally.
   */
  const wrapContextAndColumnContext = useCallback(
    async (context?: string, columnContext?: string) => {
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
        columnContext: columnContext ?? null,
      } as Partial<TileData>;

      // 2) Optimistic server update - DON'T rebuild table data synchronously
      // This prevents the UI flash that happens when we await fetch inside onMutate
      await contextAndColumnContextMutation
        .mutateAsync({
          id: tile?.id || '',
          tabId: tabId,
          name: tileName,
          projectId: state.activeProjectId || '',
          updateData,
          refetchProjects: false, // Don't refetch projects - expensive and not needed
          refetchContexts: false, // Don't refetch contexts - expensive and not needed
          refetchFields: true, // Fields may change with new context
          rebuildTableData: false, // DON'T rebuild synchronously - causes UI flash
          rebuildPlotData: false, // DON'T rebuild synchronously - causes UI flash
          actions: granularTileActions,
          projectsActions: projectsActions as ProjectsActions,
          contextActions: contextActions as ContextActions,
          logsActions: logsActions as LogsActions,
          fieldsActions: fieldsActions as FieldsActions,
        })
        .then(() => {
          // 3. Invalidate caches to trigger refetch with new context
          // The infinite logs query will automatically refetch with the updated context
          if (tile?.id) {
            // Mark the existing tableDataItem as loading before clearing
            const existingTableData = queryClient.getQueryData<TableDataItem>([
              'tableDataItem',
              tile.id,
            ]);
            if (existingTableData) {
              // FIX: Set isLoading: false to allow useInfiniteLogsQuery to run
              // Setting isLoading: true was causing a deadlock where the query
              // would never fetch because it checks !isTableDataLoading for enabled
              queryClient.setQueryData(['tableDataItem', tile.id], {
                ...existingTableData,
                isLoading: false,
                logs: [], // Clear logs to show loading state
              });
            }
            // FIX: Query key structure is ['logs', 'infinite', tileId, tabId, projectId, context, ...]
            // Previous buggy predicate checked for 'infiniteLogs' which never matched
            // Invalidate infinite logs queries for this tile to trigger refetch
            queryClient.invalidateQueries({
              predicate: (q: any) => {
                const k0 = q?.queryKey?.[0] as string;
                const k1 = q?.queryKey?.[1] as string;
                const k2 = q?.queryKey?.[2] as string;
                return k0 === 'logs' && k1 === 'infinite' && k2 === tile.id;
              },
            });
          }
          debugLog('[wrapContextAndColumnContext] onSettled:', context, columnContext);
          uiActions.setLoading(false);
          uiActions.setPending(false);
        });
    },
    [
      dataActions,
      tileName,
      tabId,
      granularTileActions,
      uiActions,
      storeApi,
      contextAndColumnContextMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
      queryClient,
    ]
  );

  const wrapCommonFilter = useCallback(
    async (commonFilter?: string) => {
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
      await commonFilterMutation
        .mutateAsync({
          id: tile?.id || '',
          tabId: tabId,
          name: tileName,
          projectId: state.activeProjectId || '',
          updateData: { commonFilter: commonFilter ?? null } as Partial<TileData>,
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
        })
        .then(() => {
          // 3. Refresh the router
          debugLog('[wrapCommonFilter] onSettled:', commonFilter);
          uiActions.setLoading(false);
        });
    },
    [
      dataActions,
      tileName,
      tabId,
      granularTileActions,
      uiActions,
      storeApi,
      commonFilterMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapGrouping = useCallback(
    async (grouping?: string) => {
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
      await groupingMutation
        .mutateAsync({
          id: tile?.id || '',
          tabId: tabId,
          name: tileName,
          projectId: state.activeProjectId || '',
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
        })
        .then(() => {
          // 3. Refresh the router
          debugLog('[wrapGrouping] onSettled:', grouping);
          uiActions.setLoading(false);
        });
    },
    [
      dataActions,
      tileName,
      tabId,
      granularTileActions,
      uiActions,
      storeApi,
      groupingMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapMetric = useCallback(
    async (metric?: string) => {
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
      await metricMutation
        .mutateAsync({
          id: tile?.id || '',
          tabId: tabId,
          name: tileName,
          projectId: state.activeProjectId || '',
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
        })
        .then(() => {
          // 3. Refresh the router
          debugLog('[wrapMetric] onSettled:', metric);
          uiActions.setLoading(false);
        });
    },
    [
      dataActions,
      tileName,
      tabId,
      granularTileActions,
      uiActions,
      storeApi,
      metricMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapFreeze = useCallback(
    async (freeze?: string) => {
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
      await freezeMutation
        .mutateAsync({
          id: tile?.id || '',
          tabId: tabId,
          name: tileName,
          projectId: state.activeProjectId || '',
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
        })
        .then(() => {
          // 3. Refresh the router
          debugLog('[wrapFreeze] onSettled:', freeze);
          uiActions.setLoading(false);
        });
    },
    [
      dataActions,
      tileName,
      tabId,
      granularTileActions,
      uiActions,
      storeApi,
      freezeMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapAutoUpdate = useCallback(
    (autoUpdate?: string) => {
      if (!dataActions || !tileName || !tabId || !granularTileActions) return;

      // 1) Update local state immediately
      dataActions.setAutoUpdate(autoUpdate);

      // 2) Optimistic server update
      autoUpdateMutation.mutate({
        tabId: tabId,
        name: tileName,
        updateData: { autoUpdate: autoUpdate ?? null } as Partial<TileData>,
        actions: granularTileActions,
      });
    },
    [dataActions, tileName, tabId, granularTileActions, autoUpdateMutation]
  );

  const wrapVisible = useCallback(
    (visible?: boolean) => {
      if (!uiActions || !tileName || !tabId || !granularTileActions) return;

      // 1) Update local state immediately
      uiActions.setVisible(visible ?? true);

      // 2) Optimistic server update
      visibleMutation.mutate({
        tabId: tabId,
        name: tileName,
        updateData: { visible: visible ?? true } as Partial<TileData>,
        actions: granularTileActions,
      });
    },
    [uiActions, tileName, tabId, granularTileActions, visibleMutation]
  );

  const wrapColor = useCallback(
    (color?: string) => {
      if (!uiActions || !tileName || !tabId || !granularTileActions) return;

      // 1) Update local state immediately
      uiActions.setColor(color);

      // 2) Optimistic server update
      colorMutation.mutate({
        tabId: tabId,
        name: tileName,
        updateData: { color: color ?? null } as Partial<TileData>,
        actions: granularTileActions,
      });
    },
    [uiActions, tileName, tabId, granularTileActions, colorMutation]
  );

  // Create the enhanced actions object with the wrapped setters
  const syncedMetaActions = useMemo<TileMetaActions | null>(() => {
    if (!metaActions || !tileName || !tabId || !granularTileActions) return null;

    return {
      ...metaActions,
      // Use the specialized wrapper functions for each property
      setName: wrapName,
      setType: wrapType,
    } as TileMetaActions;
  }, [metaActions, wrapName, wrapType, tileName, tabId, granularTileActions]);

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
    wrapAutoUpdate,
    wrapColor,
    wrapColumnContext,
    wrapCommonFilter,
    wrapContext,
    wrapContextAndColumnContext,
    wrapFilters,
    wrapFreeze,
    wrapGrouping,
    wrapMetric,
    wrapTable,
    wrapType,
    tileName,
    tabId,
    granularTileActions,
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
  }, [uiActions, wrapColor, wrapVisible, tileName, tabId, granularTileActions]);

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
      // Keep the existing actions for view
      viewTileActions: actions.viewTileActions,
    } as TileActions;

    return newActions;
  }, [
    actions,
    syncedDataActions,
    syncedMetaActions,
    syncedUIActions,
    tableTileSync.tableTileActions,
    plotTileSync.plotTileActions,
  ]);

  if (!granularTileActions) {
    return {
      actions: null,
      exists: false,
      loading: {
        name: false,
        type: false,
        table: false,
        filters: false,
        context: false,
        columnContext: false,
        commonFilter: false,
        grouping: false,
        metric: false,
        freeze: false,
        color: false,
        autoUpdate: false,
        any: false,
      },
      error: {
        name: null,
        type: null,
        table: null,
        filters: null,
        context: null,
        columnContext: null,
        commonFilter: null,
        grouping: null,
        metric: null,
        freeze: null,
        color: null,
        autoUpdate: null,
        any: false,
      },
      plotTile: null,
      tableTile: null,
    };
  }

  // Prepare loading states
  const loading: TileLoadingStates = {
    name: mutations.name.isPending,
    type: mutations.type.isPending,
    table: mutations.table.isPending,
    filters: mutations.filters.isPending,
    context: mutations.context.isPending,
    columnContext: mutations.columnContext.isPending,
    commonFilter: mutations.commonFilter.isPending,
    grouping: mutations.grouping.isPending,
    metric: mutations.metric.isPending,
    freeze: mutations.freeze.isPending,
    color: mutations.color.isPending,
    autoUpdate: mutations.autoUpdate.isPending,
    any: false,
  };

  // Check if any property is loading
  loading.any =
    Object.values(mutations).some((m) => m.isPending) ||
    plotTileSync.loading.any ||
    tableTileSync.loading.any;

  // Prepare error states
  const error: TileErrorStates = {
    name: mutations.name.error,
    type: mutations.type.error,
    table: mutations.table.error,
    filters: mutations.filters.error,
    context: mutations.context.error,
    columnContext: mutations.columnContext.error,
    commonFilter: mutations.commonFilter.error,
    grouping: mutations.grouping.error,
    metric: mutations.metric.error,
    freeze: mutations.freeze.error,
    color: mutations.color.error,
    autoUpdate: mutations.autoUpdate.error,
    any: false,
  };

  // Check if any property has error
  error.any =
    Object.values(mutations).some((m) => !!m.error) ||
    plotTileSync.error.any ||
    tableTileSync.error.any;

  return {
    actions: syncedActions,
    exists,
    loading,
    error,
    plotTile: plotTileSync.exists ? plotTileSync : null,
    tableTile: tableTileSync.exists ? tableTileSync : null,
  };
}
