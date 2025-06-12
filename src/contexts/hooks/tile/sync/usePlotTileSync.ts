"use client";

import { useMemo } from "react";
import { ContextActions, FieldsActions, LogsActions, ProjectsActions, GranularTileActions } from "@/types/evals/grid";
import { usePlotTile, PlotActions } from "../usePlotTile";
import { useTileUI } from "../useTileUI";
import { useTileMeta } from "../useTileMeta";
import { usePatchSpecializedTileQueryOptimistic } from "@/hooks/Query/usePatchSpecializedTileQueryOptimistic";
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";

/**
 * Properties of the PlotTile that will be synced with the server
 */
export type SyncedPlotProperties = 'plot_type' | 'x_axis' | 'y_axis' | 'plot_group_by' | 'plot_group_by_colors' | 'plot_aggregate';

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
  const plotTypeMutation = usePatchSpecializedTileQueryOptimistic<"Plot">();
  const xAxisMutation = usePatchSpecializedTileQueryOptimistic<"Plot">();
  const yAxisMutation = usePatchSpecializedTileQueryOptimistic<"Plot">();
  const plotGroupByMutation = usePatchSpecializedTileQueryOptimistic<"Plot">();
  const plotGroupByColorsMutation = usePatchSpecializedTileQueryOptimistic<"Plot">();
  const plotAggregateMutation = usePatchSpecializedTileQueryOptimistic<"Plot">();

  // Create a mapping for the mutations to use in the loading and error states
  const mutations = {
    plot_type: plotTypeMutation,
    x_axis: xAxisMutation,
    y_axis: yAxisMutation,
    plot_group_by: plotGroupByMutation,
    plot_group_by_colors: plotGroupByColorsMutation,
    plot_aggregate: plotAggregateMutation,
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

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();

    // 2) Optimistic server update
    await plotTypeMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      tileType: "Plot",
      updateData: { plot_type: value ?? null },
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router and set the loading state
      console.log("[wrapPlotType] onSettled:", value);
      uiActions?.setLoading(false);
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
    await xAxisMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      tileType: "Plot",
      updateData: { x_axis: value ?? null },
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router and set the loading state
      console.log("[wrapXAxis] onSettled:", value);
      uiActions?.setLoading(false);
    });
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
    await yAxisMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      tileType: "Plot",
      updateData: { y_axis: value ?? null },
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router and set the loading state
      console.log("[wrapYAxis] onSettled:", value);
      uiActions?.setLoading(false);
    });
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
    await plotGroupByMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      tileType: "Plot",
      updateData: { plot_group_by: value ?? null },
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router and set the loading state
      console.log("[wrapPlotGroupBy] onSettled:", value);
      uiActions?.setLoading(false);
    });
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

    // Get fresh data from Zustand using the pure selectors
    const state = storeApi.getState();

    // 2) Optimistic server update
    await plotGroupByColorsMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      tileType: "Plot",
      updateData: { plot_group_by_colors: value ?? null },
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router and set the loading state
      console.log("[wrapPlotGroupByColors] onSettled:", value);
      uiActions?.setLoading(false);
    });
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
    await plotAggregateMutation.mutateAsync({
      tab_id: tabId,
      name: tileName,
      projectId: state.activeProjectId || "",
      tileType: "Plot",
      updateData: { plot_aggregate: value ?? "" },
      refetchProjects: true,
      refetchContexts: true,
      refetchFields: true,
      actions: granularTileActions,
      projectsActions: projectsActions as ProjectsActions,
      contextActions: contextActions as ContextActions,
      logsActions: logsActions as LogsActions,
      fieldsActions: fieldsActions as FieldsActions,
    }).then(() => {
      // 3. Refresh the router and set the loading state
      console.log("[wrapAggregateProperty] onSettled:", value);
      uiActions?.setLoading(false);
    });
  };

  // Create the enhanced actions object
  const syncedActions = useMemo(() => {
    if (!plotTileActions) return null;

    return {
      ...plotTileActions,
      // Use the specialized wrapper functions for each property
      setPlotType: wrapPlotType,
      setXAxis: wrapXAxis,
      setYAxis: wrapYAxis,
      setPlotGroupBy: wrapPlotGroupBy,
      setPlotGroupByColors: wrapPlotGroupByColors,
      setAggregateProperty: wrapAggregateProperty,
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
        x_axis: false,
        y_axis: false,
        plot_group_by: false,
        plot_group_by_colors: false,
        plot_aggregate: false,
        any: false
      },
      error: {
        plot_type: null,
        x_axis: null,
        y_axis: null,
        plot_group_by: null,
        plot_group_by_colors: null,
        plot_aggregate: null,
        any: false
      },
      exists: false
    };
  }

  // Prepare loading states
  const loading: PlotLoadingStates = {
    plot_type: mutations.plot_type.isPending,
    x_axis: mutations.x_axis.isPending,
    y_axis: mutations.y_axis.isPending,
    plot_group_by: mutations.plot_group_by.isPending,
    plot_group_by_colors: mutations.plot_group_by_colors.isPending,
    plot_aggregate: mutations.plot_aggregate.isPending,
    any: false
  };
  
  // Check if any property is loading
  loading.any = Object.values(mutations).some(m => m.isPending);

  // Prepare error states
  const error: PlotErrorStates = {
    plot_type: mutations.plot_type.error,
    x_axis: mutations.x_axis.error,
    y_axis: mutations.y_axis.error,
    plot_group_by: mutations.plot_group_by.error,
    plot_group_by_colors: mutations.plot_group_by_colors.error,
    plot_aggregate: mutations.plot_aggregate.error,
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