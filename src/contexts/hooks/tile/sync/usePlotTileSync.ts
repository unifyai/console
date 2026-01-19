'use client';

import { useCallback, useMemo } from 'react';
import {
  ContextActions,
  FieldsActions,
  LogsActions,
  ProjectsActions,
  GranularTileActions,
} from '@/types/interfaces/grid';
import { usePlotTile, PlotActions } from '../usePlotTile';
import { useTileUI } from '../useTileUI';
import { useTileMeta } from '../useTileMeta';
import { usePatchSpecializedTileQueryOptimistic } from '@/hooks/Interfaces/Query/usePatchSpecializedTileQueryOptimistic';
import { useStoreApiContext } from '@/contexts/providers/StoreProvider';
import { usePatchSpecializedTileQuery } from '@/hooks/Interfaces/Query/useTilesQuery';
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
 * Properties of the PlotTile that will be synced with the server
 */
export type SyncedPlotProperties =
  | 'plotType'
  | 'plotScaleX'
  | 'plotScaleY'
  | 'xAxis'
  | 'yAxis'
  | 'plotGroupBy'
  | 'plotGroupByColors'
  | 'plotAggregate'
  | 'binCount'
  | 'regressionLine';

/**
 * Loading states for each property
 */
export type PlotLoadingStates = {
  [key in SyncedPlotProperties]: boolean;
} & {
  any: boolean;
};

/**
 * Error states for each property
 */
export type PlotErrorStates = {
  [key in SyncedPlotProperties]: Error | null;
} & {
  any: boolean;
};

/**
 * Return type for the usePlotTileSync hook
 */
export interface PlotTileSyncResult {
  plotTile: ReturnType<typeof usePlotTile>['plotTile'];
  plotTileActions: PlotActions | null;
  loading: PlotLoadingStates;
  error: PlotErrorStates;
  exists: boolean;
}

/**
 * Thin wrapper around usePlotTile that transparently keeps the
 * server in-sync (optimistic-update) for the critical plot fields.
 *
 * The API surface is similar to usePlotTile but with additional
 * loading and error state information.
 */
export function usePlotTileSync(
  tileId: string | null,
  tabId: string | null,
  granularTileActions?: GranularTileActions,
  projectsActions?: ProjectsActions,
  contextActions?: ContextActions,
  logsActions?: LogsActions,
  fieldsActions?: FieldsActions
): PlotTileSyncResult {
  // Get the original plot tile state and actions
  const { plotTile, plotTileActions, exists } = usePlotTile(tileId, tabId);

  // Get UI actions to update loading state
  const { meta } = useTileMeta(tileId, tabId);
  const { uiActions } = useTileUI(tileId, tabId);
  const tileName = meta?.name;

  // Get the store API reference - can be used to get state outside of React's render cycle
  const storeApi = useStoreApiContext();

  // Create individual mutation hooks for each property
  const plotScaleXMutation = usePatchSpecializedTileQuery<'Plot'>();
  const plotScaleYMutation = usePatchSpecializedTileQuery<'Plot'>();
  const plotTypeMutation = usePatchSpecializedTileQuery<'Plot'>();
  const xAxisMutation = usePatchSpecializedTileQueryOptimistic<'Plot'>();
  const yAxisMutation = usePatchSpecializedTileQueryOptimistic<'Plot'>();
  const plotGroupByMutation = usePatchSpecializedTileQueryOptimistic<'Plot'>();
  const plotGroupByColorsMutation = usePatchSpecializedTileQuery<'Plot'>();
  const plotAggregateMutation = usePatchSpecializedTileQueryOptimistic<'Plot'>();
  const binCountMutation = usePatchSpecializedTileQuery<'Plot'>();
  const regressionLineMutation = usePatchSpecializedTileQuery<'Plot'>();

  // Create a mapping for the mutations to use in the loading and error states
  const mutations = {
    plotType: plotTypeMutation,
    plotScaleX: plotScaleXMutation,
    plotScaleY: plotScaleYMutation,
    xAxis: xAxisMutation,
    yAxis: yAxisMutation,
    plotGroupBy: plotGroupByMutation,
    plotGroupByColors: plotGroupByColorsMutation,
    plotAggregate: plotAggregateMutation,
    binCount: binCountMutation,
    regressionLine: regressionLineMutation,
  };

  // Helper function to create wrapped setters
  const wrapPlotType = useCallback(
    async (value: string | undefined) => {
      if (!plotTileActions || !granularTileActions) return;

      // Set UI states immediately before any operations
      if (uiActions) {
        uiActions.setLoading(true);
      }

      // 1) Update local state immediately
      plotTileActions.setPlotType(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // 2) Optimistic server update - plotTypeMutation uses simple interface
      try {
        await withLoadingToastFn(
          () =>
            plotTypeMutation.mutateAsync({
              tabId: tabId,
              name: tileName,
              tileType: 'Plot',
              updateData: { plotType: value ?? null },
              actions: granularTileActions,
            }),
          {
            loadingMessage: 'Updating plot type...',
            successMessage: 'Plot type updated!',
            errorMessage: `Failed to set plot type for ${tileName}`,
          }
        );
      } catch (error) {
        // Error is already handled by withLoadingToast, just re-throwing
        throw error;
      } finally {
        // 3. Refresh the router and set the loading state
        debugLog('[wrapPlotType] onSettled:', value);
        uiActions?.setLoading(false);
      }
    },
    [plotTileActions, granularTileActions, uiActions, tileName, tabId, plotTypeMutation]
  );

  const wrapPlotScaleX = useCallback(
    async (value: string | undefined) => {
      if (!plotTileActions || !granularTileActions) return;

      // 1) Update local state immediately
      plotTileActions.setPlotScaleX(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // 2) Optimistic server update
      await plotScaleXMutation
        .mutateAsync({
          tabId: tabId,
          name: tileName,
          tileType: 'Plot',
          updateData: { plotScaleX: value ?? null },
          actions: granularTileActions as GranularTileActions,
        })
        .then(() => {
          // 3. Refresh the router and set the loading state
          debugLog('[wrapPlotScaleX] onSettled:', value);
        });
    },
    [plotTileActions, granularTileActions, tileName, tabId, plotScaleXMutation]
  );

  const wrapPlotScaleY = useCallback(
    async (value: string | undefined) => {
      if (!plotTileActions || !granularTileActions) return;
      // 1) Update local state immediately
      plotTileActions.setPlotScaleY(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // 2) Optimistic server update
      await plotScaleYMutation
        .mutateAsync({
          tabId: tabId,
          name: tileName,
          tileType: 'Plot',
          updateData: { plotScaleY: value ?? null },
          actions: granularTileActions as GranularTileActions,
        })
        .then(() => {
          // 3. Refresh the router and set the loading state
          debugLog('[wrapPlotScaleY] onSettled:', value);
        });
    },
    [plotTileActions, granularTileActions, tileName, tabId, plotScaleYMutation]
  );

  const wrapXAxis = useCallback(
    async (value: string | undefined) => {
      if (!plotTileActions || !granularTileActions) return;

      // Set UI states immediately before any operations
      if (uiActions) {
        uiActions.setLoading(true);
      }

      // 1) Update local state immediately
      plotTileActions.setXAxis(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();

      // 2) Optimistic server update
      try {
        await withLoadingToastFn(
          () =>
            xAxisMutation.mutateAsync({
              tabId: tabId,
              name: tileName,
              projectId: state.activeProjectId || '',
              tileType: 'Plot',
              updateData: { xAxis: value ?? null },
              refetchProjects: true,
              refetchContexts: true,
              refetchFields: true,
              rebuildTableData: false,
              rebuildPlotData: true,
              actions: granularTileActions,
              projectsActions: projectsActions as ProjectsActions,
              contextActions: contextActions as ContextActions,
              logsActions: logsActions as LogsActions,
              fieldsActions: fieldsActions as FieldsActions,
            }),
          {
            loadingMessage: 'Updating X-axis...',
            successMessage: 'X-axis updated!',
            errorMessage: `Failed to set X-axis for ${tileName}`,
          }
        );
      } catch (error) {
        // Error is already handled by withLoadingToast, just re-throwing
        throw error;
      } finally {
        // 3. Refresh the router and set the loading state
        debugLog('[wrapXAxis] onSettled:', value);
        uiActions?.setLoading(false);
      }
    },
    [
      plotTileActions,
      granularTileActions,
      uiActions,
      tileName,
      tabId,
      storeApi,
      xAxisMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapYAxis = useCallback(
    async (value: string | undefined) => {
      if (!plotTileActions || !granularTileActions) return;

      // Set UI states immediately before any operations
      if (uiActions) {
        uiActions.setLoading(true);
      }

      // 1) Update local state immediately
      plotTileActions.setYAxis(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();

      // 2) Optimistic server update
      try {
        await withLoadingToastFn(
          () =>
            yAxisMutation.mutateAsync({
              tabId: tabId,
              name: tileName,
              projectId: state.activeProjectId || '',
              tileType: 'Plot',
              updateData: { yAxis: value ?? null },
              refetchProjects: true,
              refetchContexts: true,
              refetchFields: true,
              rebuildTableData: false,
              rebuildPlotData: true,
              actions: granularTileActions,
              projectsActions: projectsActions as ProjectsActions,
              contextActions: contextActions as ContextActions,
              logsActions: logsActions as LogsActions,
              fieldsActions: fieldsActions as FieldsActions,
            }),
          {
            loadingMessage: 'Updating Y-axis...',
            successMessage: 'Y-axis updated!',
            errorMessage: `Failed to set Y-axis for ${tileName}`,
          }
        );
      } catch (error) {
        // Error is already handled by withLoadingToast, just re-throwing
        throw error;
      } finally {
        // 3. Refresh the router and set the loading state
        debugLog('[wrapYAxis] onSettled:', value);
        uiActions?.setLoading(false);
      }
    },
    [
      plotTileActions,
      granularTileActions,
      uiActions,
      tileName,
      tabId,
      storeApi,
      yAxisMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapPlotGroupBy = useCallback(
    async (value: string | undefined) => {
      if (!plotTileActions || !granularTileActions) return;

      // Set UI states immediately before any operations
      if (uiActions) {
        uiActions.setLoading(true);
      }

      // 1) Update local state immediately
      plotTileActions.setPlotGroupBy(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();

      // 2) Optimistic server update
      try {
        await withLoadingToastFn(
          () =>
            plotGroupByMutation.mutateAsync({
              tabId: tabId,
              name: tileName,
              projectId: state.activeProjectId || '',
              tileType: 'Plot',
              updateData: { plotGroupBy: value ?? null },
              refetchProjects: true,
              refetchContexts: true,
              refetchFields: true,
              rebuildTableData: false,
              rebuildPlotData: true,
              actions: granularTileActions,
              projectsActions: projectsActions as ProjectsActions,
              contextActions: contextActions as ContextActions,
              logsActions: logsActions as LogsActions,
              fieldsActions: fieldsActions as FieldsActions,
            }),
          {
            loadingMessage: 'Updating group by...',
            successMessage: 'Group by updated!',
            errorMessage: `Failed to set group-by for ${tileName}`,
          }
        );
      } catch (error) {
        // Error is already handled by withLoadingToast, just re-throwing
        throw error;
      } finally {
        // 3. Refresh the router and set the loading state
        debugLog('[wrapPlotGroupBy] onSettled:', value);
        uiActions?.setLoading(false);
      }
    },
    [
      plotTileActions,
      granularTileActions,
      uiActions,
      tileName,
      tabId,
      storeApi,
      plotGroupByMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapPlotGroupByColors = useCallback(
    async (value: string | undefined) => {
      if (!plotTileActions || !granularTileActions) return;

      // Set UI states immediately before any operations
      if (uiActions) {
        uiActions.setLoading(true);
      }

      // 1) Update local state immediately
      plotTileActions.setPlotGroupByColors(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // 2) Optimistic server update - plotGroupByColorsMutation uses simple interface
      try {
        await withLoadingToastFn(
          () =>
            plotGroupByColorsMutation.mutateAsync({
              tabId: tabId,
              name: tileName,
              tileType: 'Plot',
              updateData: { plotGroupByColors: value ?? null },
              actions: granularTileActions,
            }),
          {
            loadingMessage: 'Updating colors...',
            successMessage: 'Colors updated!',
            errorMessage: `Failed to set group-by colors for ${tileName}`,
          }
        );
      } catch (error) {
        // Error is already handled by withLoadingToast, just re-throwing
        throw error;
      } finally {
        // 3. Refresh the router and set the loading state
        debugLog('[wrapPlotGroupByColors] onSettled:', value);
        uiActions?.setLoading(false);
      }
    },
    [plotTileActions, granularTileActions, uiActions, tileName, tabId, plotGroupByColorsMutation]
  );

  const wrapAggregateProperty = useCallback(
    async (value: string | undefined) => {
      if (!plotTileActions || !granularTileActions) return;

      // Set UI states immediately before any operations
      if (uiActions) {
        uiActions.setLoading(true);
      }

      // 1) Update local state immediately
      plotTileActions.setAggregateProperty(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // Get fresh data from Zustand using the pure selectors
      const state = storeApi.getState();

      // 2) Optimistic server update
      try {
        await withLoadingToastFn(
          () =>
            plotAggregateMutation.mutateAsync({
              tabId: tabId,
              name: tileName,
              projectId: state.activeProjectId || '',
              tileType: 'Plot',
              updateData: { plotAggregate: value ?? '' },
              refetchProjects: true,
              refetchContexts: true,
              refetchFields: true,
              rebuildTableData: false,
              rebuildPlotData: true,
              actions: granularTileActions,
              projectsActions: projectsActions as ProjectsActions,
              contextActions: contextActions as ContextActions,
              logsActions: logsActions as LogsActions,
              fieldsActions: fieldsActions as FieldsActions,
            }),
          {
            loadingMessage: 'Updating aggregate...',
            successMessage: 'Aggregate updated!',
            errorMessage: `Failed to set aggregate property for ${tileName}`,
          }
        );
      } catch (error) {
        // Error is already handled by withLoadingToast, just re-throwing
        throw error;
      } finally {
        // 3. Refresh the router and set the loading state
        debugLog('[wrapAggregateProperty] onSettled:', value);
        uiActions?.setLoading(false);
      }
    },
    [
      plotTileActions,
      granularTileActions,
      uiActions,
      tileName,
      tabId,
      storeApi,
      plotAggregateMutation,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions,
    ]
  );

  const wrapBinCount = useCallback(
    async (value: string | undefined) => {
      if (!plotTileActions || !granularTileActions) return;
      // 1) Update local state immediately
      plotTileActions.setBinCount(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // 2) Optimistic server update
      await binCountMutation
        .mutateAsync({
          tabId: tabId,
          name: tileName,
          tileType: 'Plot',
          updateData: { binCount: value ?? null },
          actions: granularTileActions as GranularTileActions,
        })
        .then(() => {
          // 3. Refresh the router and set the loading state
          debugLog('[wrapBinCount] onSettled:', value);
        });
    },
    [plotTileActions, granularTileActions, tileName, tabId, binCountMutation]
  );

  const wrapRegressionLine = useCallback(
    async (value: string | undefined) => {
      if (!plotTileActions || !granularTileActions) return;
      // 1) Update local state immediately
      plotTileActions.setRegressionLine(value);

      // Don't attempt server update if we don't have required info
      if (!tileName || !tabId) return;

      // 2) Optimistic server update
      await regressionLineMutation
        .mutateAsync({
          tabId: tabId,
          name: tileName,
          tileType: 'Plot',
          updateData: { regressionLine: value ?? null },
          actions: granularTileActions as GranularTileActions,
        })
        .then(() => {
          // 3. Refresh the router and set the loading state
          debugLog('[wrapRegressionLine] onSettled:', value);
        });
    },
    [plotTileActions, granularTileActions, tileName, tabId, regressionLineMutation]
  );

  // Create the enhanced actions object
  const syncedActions = useMemo(() => {
    if (!plotTileActions) return null;

    return {
      ...plotTileActions,
      // Use the specialized wrapper functions for each property
      setPlotType: wrapPlotType,
      setPlotScaleX: wrapPlotScaleX,
      setPlotScaleY: wrapPlotScaleY,
      setXAxis: wrapXAxis,
      setYAxis: wrapYAxis,
      setPlotGroupBy: wrapPlotGroupBy,
      setPlotGroupByColors: wrapPlotGroupByColors,
      setAggregateProperty: wrapAggregateProperty,
      setBinCount: wrapBinCount,
      setRegressionLine: wrapRegressionLine,
    } as PlotActions;
  }, [
    plotTileActions,
    wrapAggregateProperty,
    wrapBinCount,
    wrapPlotGroupBy,
    wrapPlotGroupByColors,
    wrapPlotScaleX,
    wrapPlotScaleY,
    wrapPlotType,
    wrapRegressionLine,
    wrapXAxis,
    wrapYAxis,
  ]);

  if (!plotTileActions || !granularTileActions) {
    return {
      plotTile,
      plotTileActions: null,
      loading: {
        plotType: false,
        plotScaleX: false,
        plotScaleY: false,
        xAxis: false,
        yAxis: false,
        plotGroupBy: false,
        plotGroupByColors: false,
        plotAggregate: false,
        binCount: false,
        regressionLine: false,
        any: false,
      },
      error: {
        plotType: null,
        plotScaleX: null,
        plotScaleY: null,
        xAxis: null,
        yAxis: null,
        plotGroupBy: null,
        plotGroupByColors: null,
        plotAggregate: null,
        binCount: null,
        regressionLine: null,
        any: false,
      },
      exists: false,
    };
  }

  // Prepare loading states
  const loading: PlotLoadingStates = {
    plotType: mutations.plotType.isPending,
    plotScaleX: mutations.plotScaleX.isPending,
    plotScaleY: mutations.plotScaleY.isPending,
    xAxis: mutations.xAxis.isPending,
    yAxis: mutations.yAxis.isPending,
    plotGroupBy: mutations.plotGroupBy.isPending,
    plotGroupByColors: mutations.plotGroupByColors.isPending,
    plotAggregate: mutations.plotAggregate.isPending,
    binCount: mutations.binCount.isPending,
    regressionLine: mutations.regressionLine.isPending,
    any: false,
  };

  // Check if any property is loading
  loading.any = Object.values(mutations).some((m) => m.isPending);

  // Prepare error states
  const error: PlotErrorStates = {
    plotType: mutations.plotType.error,
    plotScaleX: mutations.plotScaleX.error,
    plotScaleY: mutations.plotScaleY.error,
    xAxis: mutations.xAxis.error,
    yAxis: mutations.yAxis.error,
    plotGroupBy: mutations.plotGroupBy.error,
    plotGroupByColors: mutations.plotGroupByColors.error,
    plotAggregate: mutations.plotAggregate.error,
    binCount: mutations.binCount.error,
    regressionLine: mutations.regressionLine.error,
    any: false,
  };

  // Check if any property has error
  error.any = Object.values(mutations).some((m) => !!m.error);

  return {
    plotTile,
    plotTileActions: syncedActions,
    loading,
    error,
    exists,
  };
}
