"use client";

import { useMemo } from "react";
import { ContextActions, FieldsActions, LogsActions, ProjectsActions, GranularTileActions } from "@/types/evals/grid";
import { usePlotTile, PlotActions } from "../usePlotTile";
import { useTileUI } from "../useTileUI";
import { useTileMeta } from "../useTileMeta";
import { usePatchSpecializedTileQueryOptimistic } from "@/hooks/Query/usePatchSpecializedTileQueryOptimistic";
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";
import { usePatchSpecializedTileQuery } from "@/hooks/Query/useTilesQuery";
import { showErrorToast } from "@/components/notifications";
import { withLoadingToast } from "@/components/notifications";

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
export type SyncedPlotProperties = 'plot_type' | 'plot_scale_x' | 'plot_scale_y' | 'x_axis' | 'y_axis' | 'plot_group_by' | 'plot_group_by_colors' | 'plot_aggregate' | 'bin_count' | 'regression_line';

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
  const plotScaleXMutation = usePatchSpecializedTileQuery<"Plot">();
  const plotScaleYMutation = usePatchSpecializedTileQuery<"Plot">();
  const plotTypeMutation = usePatchSpecializedTileQuery<"Plot">();
  const xAxisMutation = usePatchSpecializedTileQueryOptimistic<"Plot">();
  const yAxisMutation = usePatchSpecializedTileQueryOptimistic<"Plot">();
  const plotGroupByMutation = usePatchSpecializedTileQueryOptimistic<"Plot">();
  const plotGroupByColorsMutation = usePatchSpecializedTileQuery<"Plot">();
  const plotAggregateMutation = usePatchSpecializedTileQueryOptimistic<"Plot">();
  const binCountMutation = usePatchSpecializedTileQuery<"Plot">();
  const regressionLineMutation = usePatchSpecializedTileQuery<"Plot">();

  // Create a mapping for the mutations to use in the loading and error states
  const mutations = {
    plot_type: plotTypeMutation,
    plot_scale_x: plotScaleXMutation,
    plot_scale_y: plotScaleYMutation,
    x_axis: xAxisMutation,
    y_axis: yAxisMutation,
    plot_group_by: plotGroupByMutation,
    plot_group_by_colors: plotGroupByColorsMutation,
    plot_aggregate: plotAggregateMutation,
    bin_count: binCountMutation,
    regression_line: regressionLineMutation,
  };

  // Helper function to create wrapped setters
  const wrapPlotType = async (value: string | undefined) => {
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
      await withLoadingToast(
        () => plotTypeMutation.mutateAsync({
          tab_id: tabId,
          name: tileName,
          tileType: "Plot",
          updateData: { plot_type: value ?? null },
          actions: granularTileActions,
        }),
        {
          loading: "Updating plot type...",
          success: "Plot type updated!",
          error: `Failed to set plot type for ${tileName}`,
        }
      );
    } catch (error) {
      // Error is already handled by withLoadingToast, just re-throwing
      throw error;
    } finally {
      // 3. Refresh the router and set the loading state
      debugLog("[wrapPlotType] onSettled:", value);
      uiActions?.setLoading(false);
    }
  };

  const wrapPlotScaleX = async (value: string | undefined) => {
    if (!plotTileActions || !granularTileActions) return;

    // 1) Update local state immediately
    plotTileActions.setPlotScaleX(value);

    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    await plotScaleXMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      tileType: "Plot",
      updateData: { plot_scale_x: value ?? null },
      actions: granularTileActions as GranularTileActions,
    }).then(() => { 
      // 3. Refresh the router and set the loading state
      debugLog("[wrapPlotScaleX] onSettled:", value);
    });
  };

  const wrapPlotScaleY = async (value: string | undefined) => {
    if (!plotTileActions || !granularTileActions) return;
    // 1) Update local state immediately
    plotTileActions.setPlotScaleY(value);

    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    await plotScaleYMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      tileType: "Plot",
      updateData: { plot_scale_y: value ?? null },
      actions: granularTileActions as GranularTileActions,
    }).then(() => { 
      // 3. Refresh the router and set the loading state
      debugLog("[wrapPlotScaleY] onSettled:", value);
    });
  };

  const wrapXAxis = async (value: string | undefined) => {
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
      await withLoadingToast(
        () => xAxisMutation.mutateAsync({
          tab_id: tabId,
          name: tileName,
          projectId: state.activeProjectId || "",
          tileType: "Plot",
          updateData: { x_axis: value ?? null },
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
          loading: "Updating X-axis...",
          success: "X-axis updated!",
          error: `Failed to set X-axis for ${tileName}`,
        }
      );
    } catch (error) {
      // Error is already handled by withLoadingToast, just re-throwing
      throw error;
    } finally {
      // 3. Refresh the router and set the loading state
      debugLog("[wrapXAxis] onSettled:", value);
      uiActions?.setLoading(false);
    }
  };

  const wrapYAxis = async (value: string | undefined) => {
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
      await withLoadingToast(
        () => yAxisMutation.mutateAsync({
          tab_id: tabId,
          name: tileName,
          projectId: state.activeProjectId || "",
          tileType: "Plot",
          updateData: { y_axis: value ?? null },
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
          loading: "Updating Y-axis...",
          success: "Y-axis updated!",
          error: `Failed to set Y-axis for ${tileName}`,
        }
      );
    } catch (error) {
      // Error is already handled by withLoadingToast, just re-throwing
      throw error;
    } finally {
      // 3. Refresh the router and set the loading state
      debugLog("[wrapYAxis] onSettled:", value);
      uiActions?.setLoading(false);
    }
  };

  const wrapPlotGroupBy = async (value: string | undefined) => {
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
      await withLoadingToast(
        () => plotGroupByMutation.mutateAsync({
          tab_id: tabId,
          name: tileName,
          projectId: state.activeProjectId || "",
          tileType: "Plot",
          updateData: { plot_group_by: value ?? null },
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
          loading: "Updating group by...",
          success: "Group by updated!",
          error: `Failed to set group-by for ${tileName}`,
        }
      );
    } catch (error) {
      // Error is already handled by withLoadingToast, just re-throwing
      throw error;
    } finally {
      // 3. Refresh the router and set the loading state
      debugLog("[wrapPlotGroupBy] onSettled:", value);
      uiActions?.setLoading(false);
    }
  };

  const wrapPlotGroupByColors = async (value: string | undefined) => {
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
      await withLoadingToast(
        () => plotGroupByColorsMutation.mutateAsync({
          tab_id: tabId,
          name: tileName,
          tileType: "Plot",
          updateData: { plot_group_by_colors: value ?? null },
          actions: granularTileActions,
        }),
        {
          loading: "Updating colors...",
          success: "Colors updated!",
          error: `Failed to set group-by colors for ${tileName}`,
        }
      );
    } catch (error) {
      // Error is already handled by withLoadingToast, just re-throwing
      throw error;
    } finally {
      // 3. Refresh the router and set the loading state
      debugLog("[wrapPlotGroupByColors] onSettled:", value);
      uiActions?.setLoading(false);
    }
  };

  const wrapAggregateProperty = async (value: string | undefined) => {
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
      await withLoadingToast(
        () => plotAggregateMutation.mutateAsync({
          tab_id: tabId,
          name: tileName,
          projectId: state.activeProjectId || "",
          tileType: "Plot",
          updateData: { plot_aggregate: value ?? "" },
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
          loading: "Updating aggregate...",
          success: "Aggregate updated!",
          error: `Failed to set aggregate property for ${tileName}`,
        }
      );
    } catch (error) {
      // Error is already handled by withLoadingToast, just re-throwing
      throw error;
    } finally {
      // 3. Refresh the router and set the loading state
      debugLog("[wrapAggregateProperty] onSettled:", value);
      uiActions?.setLoading(false);
    }
  };

  const wrapBinCount = async (value: string | undefined) => {
    if (!plotTileActions || !granularTileActions) return;
    // 1) Update local state immediately
    plotTileActions.setBinCount(value);

    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    await binCountMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      tileType: "Plot",
      updateData: { bin_count: value ?? null },
      actions: granularTileActions as GranularTileActions,
    }).then(() => { 
      // 3. Refresh the router and set the loading state
      debugLog("[wrapBinCount] onSettled:", value);
    });
  };

  const wrapRegressionLine = async (value: string | undefined) => {
    if (!plotTileActions || !granularTileActions) return;
    // 1) Update local state immediately
    plotTileActions.setRegressionLine(value);

    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    await regressionLineMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      tileType: "Plot",
      updateData: { regression_line: value ?? null },
      actions: granularTileActions as GranularTileActions,
    }).then(() => { 
      // 3. Refresh the router and set the loading state
      debugLog("[wrapRegressionLine] onSettled:", value);
    });
  };

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
    tabId,
    tileName,
    granularTileActions,
  ]);

  if (!plotTileActions || !granularTileActions) {
    return {
      plotTile,
      plotTileActions: null,
      loading: {
        plot_type: false,
        plot_scale_x: false,
        plot_scale_y: false,
        x_axis: false,
        y_axis: false,
        plot_group_by: false,
        plot_group_by_colors: false,
        plot_aggregate: false,
        bin_count: false,
        regression_line: false,
        any: false
      },
      error: {
        plot_type: null,
        plot_scale_x: null,
        plot_scale_y: null,
        x_axis: null,
        y_axis: null,
        plot_group_by: null,
        plot_group_by_colors: null,
        plot_aggregate: null,
        bin_count: null,
        regression_line: null,
        any: false
      },
      exists: false
    };
  }

  // Prepare loading states
  const loading: PlotLoadingStates = {
    plot_type: mutations.plot_type.isPending,
    plot_scale_x: mutations.plot_scale_x.isPending,
    plot_scale_y: mutations.plot_scale_y.isPending,
    x_axis: mutations.x_axis.isPending,
    y_axis: mutations.y_axis.isPending,
    plot_group_by: mutations.plot_group_by.isPending,
    plot_group_by_colors: mutations.plot_group_by_colors.isPending,
    plot_aggregate: mutations.plot_aggregate.isPending,
    bin_count: mutations.bin_count.isPending,
    regression_line: mutations.regression_line.isPending,
    any: false
  };
  
  // Check if any property is loading
  loading.any = Object.values(mutations).some(m => m.isPending);

  // Prepare error states
  const error: PlotErrorStates = {
    plot_type: mutations.plot_type.error,
    plot_scale_x: mutations.plot_scale_x.error,
    plot_scale_y: mutations.plot_scale_y.error,
    x_axis: mutations.x_axis.error,
    y_axis: mutations.y_axis.error,
    plot_group_by: mutations.plot_group_by.error,
    plot_group_by_colors: mutations.plot_group_by_colors.error,
    plot_aggregate: mutations.plot_aggregate.error,
    bin_count: mutations.bin_count.error,
    regression_line: mutations.regression_line.error,
    any: false
  };
  
  // Check if any property has error
  error.any = Object.values(mutations).some(m => !!m.error);

  return {
    plotTile,
    plotTileActions: syncedActions,
    loading,
    error,
    exists
  };
} 