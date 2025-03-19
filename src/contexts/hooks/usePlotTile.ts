import { useMemo } from "react";
import { TileActions, TileDataActions, useTile } from "./useTile";
import { PlotTile, PlotTileMeta, PlotTileData, PlotTileUI } from "../slices/selectors/plotTile";

// Define the default return value for the usePlotTile hook
const DEFAULT_USE_PLOT_TILE_RETURN = {
  plotTile: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  actions: null,
  exists: false,
};

/**
 * Interface for plot tile meta-related actions
 */
export interface PlotTileMetaActions {
  // Add plot-specific meta actions here
}

/**
 * Interface for plot tile data-related actions
 */
export interface PlotTileDataActions {
  setPlotType: (plotType: string | undefined) => void;
  setPlotScaleX: (scaleX: string | undefined) => void;
  setPlotScaleY: (scaleY: string | undefined) => void;
  setIsAggregated: (isAggregated: string | undefined) => void;
  setXAxis: (xAxis: string | undefined) => void;
  setYAxis: (yAxis: string | undefined) => void;
  setPlotGroupBy: (groupBy: string | undefined) => void;
  setBinCount: (binCount: string | undefined) => void;
  setRegressionLine: (regressionLine: string | undefined) => void;
}

/**
 * Interface for plot tile UI-related actions
 */
export interface PlotTileUIActions {
  // Add plot-specific UI actions here
}

/**
 * Interface for all plot tile-related actions
 */
export interface PlotTileActions extends TileActions {
  // Plot-specific actions grouped by category
  plotMeta: PlotTileMetaActions;
  plotData: PlotTileDataActions;
  plotUI: PlotTileUIActions;
}

/**
 * Custom hook to access plot tile data and actions
 * @param tileName The name of the plot tile to access
 * @param tabName Optional tab name
 * @param interfaceName Optional interface name
 * @param projectName Optional project name
 * @returns Object containing tile state, actions, and existence flag
 */
export function usePlotTile(
  tileName: string | null,
  tabName?: string | null,
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Always call hooks at the top level, unconditionally
  const {
    tile: baseTile,
    dataActions: baseTileActions,
    exists,
  } = useTile(tileName, tabName, interfaceName, projectName);

  // Check if this tile is a plot tile
  const hasPlotTile = useMemo(() => {
    if (!baseTile || baseTile.type !== 'Plot') return false;
    return true;
  }, [baseTile]);
  
  // Extract plot-specific meta, data, and UI
  const plotMeta = useMemo<PlotTileMeta | null>(() => {
    if (!hasPlotTile || !baseTile || !baseTile.plotTile) return null;
    return baseTile.plotTile as PlotTileMeta;
  }, [hasPlotTile, baseTile]);
  
  const plotData = useMemo<PlotTileData | null>(() => {
    if (!hasPlotTile || !baseTile || !baseTile.plotTile) return null;
    return baseTile.plotTile as PlotTileData;
  }, [hasPlotTile, baseTile]);
  
  const plotUI = useMemo<PlotTileUI | null>(() => {
    if (!hasPlotTile || !baseTile || !baseTile.plotTile) return null;
    return baseTile.plotTile as PlotTileUI;
  }, [hasPlotTile, baseTile]);
  
  // Create plot-specific meta actions
  const plotMetaActions = useMemo<PlotTileMetaActions>(() => {
    return {
      // Add plot-specific meta actions here
    };
  }, []);
  
  // Create plot-specific data actions
  const plotDataActions = useMemo<PlotTileDataActions>(() => {
    return {
      setPlotType: (plotType) => {
        if (baseTileActions && hasPlotTile) {
          (baseTileActions as unknown as TileDataActions).updatePlotTile({ 
            plot_type: plotType 
          });
        }
      },
      setPlotScaleX: (scaleX) => {
        if (baseTileActions && hasPlotTile) {
          (baseTileActions as unknown as TileDataActions).updatePlotTile({ 
            plot_scale_x: scaleX 
          });
        }
      },
      setPlotScaleY: (scaleY) => {
        if (baseTileActions && hasPlotTile) {
          (baseTileActions as unknown as TileDataActions).updatePlotTile({ 
            plot_scale_y: scaleY 
          });
        }
      },
      setIsAggregated: (isAggregated) => {
        if (baseTileActions && hasPlotTile) {
          (baseTileActions as unknown as TileDataActions).updatePlotTile({ 
            is_aggregated: isAggregated 
          });
        }
      },
      setXAxis: (xAxis) => {
        if (baseTileActions && hasPlotTile) {
          (baseTileActions as unknown as TileDataActions).updatePlotTile({ 
            x_axis: xAxis 
          });
        }
      },
      setYAxis: (yAxis) => {
        if (baseTileActions && hasPlotTile) {
          (baseTileActions as unknown as TileDataActions).updatePlotTile({ 
            y_axis: yAxis 
          });
        }
      },
      setPlotGroupBy: (groupBy) => {
        if (baseTileActions && hasPlotTile) {
          (baseTileActions as unknown as TileDataActions).updatePlotTile({ 
            plot_group_by: groupBy 
          });
        }
      },
      setBinCount: (binCount) => {
        if (baseTileActions && hasPlotTile) {
          (baseTileActions as unknown as TileDataActions).updatePlotTile({ 
            bin_count: binCount 
          });
        }
      },
      setRegressionLine: (regressionLine) => {
        if (baseTileActions && hasPlotTile) {
          (baseTileActions as unknown as TileDataActions).updatePlotTile({ 
            regression_line: regressionLine 
          });
        }
      }
    };
  }, [baseTileActions, hasPlotTile]);
  
  // Create plot-specific UI actions
  const plotUIActions = useMemo<PlotTileUIActions>(() => {
    return {
      // Add plot-specific UI actions here
    };
  }, []);
  
  // Combine all actions
  const plotActions = useMemo<PlotTileActions>(() => {
    return {
      ...(baseTileActions as unknown as PlotTileActions),
      plotMeta: plotMetaActions,
      plotData: plotDataActions,
      plotUI: plotUIActions
    };
  }, [baseTileActions, plotMetaActions, plotDataActions, plotUIActions]);

  // Return null if no tileId provided
  if (tileName === null) {
    return DEFAULT_USE_PLOT_TILE_RETURN;
  }

  return {
    plotTile: hasPlotTile ? baseTile?.plotTile : null,
    meta: plotMeta,
    data: plotData,
    ui: plotUI,
    metaActions: plotMetaActions,
    dataActions: plotDataActions,
    uiActions: plotUIActions,
    actions: plotActions,
    exists: exists && hasPlotTile,
  };
}