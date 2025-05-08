"use client";

import { useMemo } from "react";
import { usePatchSpecializedTileQuery } from "@/hooks/Query/useTilesQuery";
import { GranularTileActions, } from "@/types/evals/grid";
import { usePlotTile, PlotActions } from "../usePlotTile";
import { useTileUI } from "../useTileUI";
import { useTileRouterRefresh } from "@/contexts/hooks/tile/sync/useTileRouterRefresh";

/**
 * Properties of the PlotTile that will be synced with the server
 */
export type SyncedPlotProperties = 'plot_type' | 'x_axis' | 'y_axis' | 'plot_group_by' | 'plot_aggregate';

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
  tileName: string | null,
  tabId: string | null,
  interfaceName: string | null,
  projectName?: string | null,
  granularTileActions?: GranularTileActions
): PlotTileSyncResult {
  // Get the original plot tile state and actions
  const { plotTile, plotTileActions, exists } = usePlotTile(
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
  const plotTypeMutation = usePatchSpecializedTileQuery<"Plot">();
  const xAxisMutation = usePatchSpecializedTileQuery<"Plot">();
  const yAxisMutation = usePatchSpecializedTileQuery<"Plot">();
  const plotGroupByMutation = usePatchSpecializedTileQuery<"Plot">();
  const plotAggregateMutation = usePatchSpecializedTileQuery<"Plot">();

  if (!plotTileActions || !granularTileActions) {
    return {
      plotTile,
      plotTileActions: null,
      loading: {
        plot_type: false,
        x_axis: false,
        y_axis: false,
        plot_group_by: false,
        plot_aggregate: false,
        any: false
      },
      error: {
        plot_type: null,
        x_axis: null,
        y_axis: null,
        plot_group_by: null,
        plot_aggregate: null,
        any: false
      },
      exists: false
    };
  }

  // Create a mapping for the mutations to use in the loading and error states
  const mutations = {
    plot_type: plotTypeMutation,
    x_axis: xAxisMutation,
    y_axis: yAxisMutation,
    plot_group_by: plotGroupByMutation,
    plot_aggregate: plotAggregateMutation,
  };

  // Helper function to create wrapped setters
  const wrapPlotType = (value: string | undefined) => {
    if (!plotTileActions) return;
    
    // 1) Update local state immediately
    plotTileActions.setPlotType(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    plotTypeMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Plot",
      updateData: { plot_type: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapXAxis = (value: string | undefined) => {
    if (!plotTileActions) return;
    
    // 1) Update local state immediately
    plotTileActions.setXAxis(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    xAxisMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Plot",
      updateData: { x_axis: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapYAxis = (value: string | undefined) => {
    if (!plotTileActions) return;
    
    // 1) Update local state immediately
    plotTileActions.setYAxis(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    yAxisMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Plot",
      updateData: { y_axis: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapPlotGroupBy = (value: string | undefined) => {
    if (!plotTileActions) return;
    
    // 1) Update local state immediately
    plotTileActions.setPlotGroupBy(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    plotGroupByMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Plot",
      updateData: { plot_group_by: value },
      actions: granularTileActions
    }, {
      onSettled: () => {
        // 3. Refresh the router and set the loading state
        refreshRouter({ withLoading: true });
      }
    });
  };

  const wrapAggregateProperty = (value: string | undefined) => {
    if (!plotTileActions) return;
    
    // 1) Update local state immediately
    plotTileActions.setAggregateProperty(value);
    
    // Don't attempt server update if we don't have required info
    if (!tileName || !tabId) return;

    // 2) Optimistic server update
    plotAggregateMutation.mutate({
      tab_id: tabId,
      name: tileName,
      tileType: "Plot",
      updateData: { plot_aggregate: value },
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
    if (!plotTileActions) return null;

    return {
      ...plotTileActions,
      // Use the specialized wrapper functions for each property
      setPlotType: wrapPlotType,
      setXAxis: wrapXAxis,
      setYAxis: wrapYAxis,
      setPlotGroupBy: wrapPlotGroupBy,
      setAggregateProperty: wrapAggregateProperty,
    } as PlotActions;
  }, [
    plotTileActions,
    tabId,
    tileName,
    granularTileActions,
    refreshRouter
  ]);

  // Prepare loading states
  const loading: PlotLoadingStates = {
    plot_type: mutations.plot_type.isPending,
    x_axis: mutations.x_axis.isPending,
    y_axis: mutations.y_axis.isPending,
    plot_group_by: mutations.plot_group_by.isPending,
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