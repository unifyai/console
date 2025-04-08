import { useMemo } from "react";
import { useStoreContext } from "../../providers/StoreProvider";
import { useTileMeta } from "./useTileMeta";
import { PlotTile, PlotTileMeta, PlotTileData, PlotTileUI } from '../../slices/selectors/plotTile';
import { PlotDataItem } from '@/types/evals/grid';
import { useShallow } from "zustand/react/shallow";

/**
 * Default return value when no tile is specified or tile doesn't exist
 */
export const DEFAULT_USE_PLOT_TILE_RETURN = {
  plotTile: null,
  plotTileActions: null,
  exists: false
};

// Default plot tile meta
export const DEFAULT_PLOT_TILE_META: PlotTileMeta = {};

// Default plot tile UI
export const DEFAULT_PLOT_TILE_UI: PlotTileUI = {};

// Default plot tile meta actions
export const DEFAULT_PLOT_TILE_META_ACTIONS: PlotTileMetaActions = {};

// Default plot tile UI actions
export const DEFAULT_PLOT_TILE_UI_ACTIONS: PlotTileUIActions = {};

/**
 * Interface for plot tile meta actions
 */
export interface PlotTileMetaActions {
  // Meta actions will be empty as per PlotTileMeta
}

/**
 * Interface for plot tile data actions
 */
export interface PlotTileDataActions {
  setPlotType: (plotType: string | undefined) => void;
  setPlotScaleX: (plotScaleX: string | undefined) => void;
  setPlotScaleY: (plotScaleY: string | undefined) => void;
  setAggregateProperty: (aggregateProperty: string | undefined) => void;
  setXAxis: (xAxis: string | undefined) => void;
  setYAxis: (yAxis: string | undefined) => void;
  setPlotGroupBy: (plotGroupBy: string | undefined) => void;
  setBinCount: (binCount: string | undefined) => void;
  setRegressionLine: (regressionLine: string | undefined) => void;
  setPlotDataItem: (plotDataItem: PlotDataItem | undefined) => void;
}

/**
 * Interface for plot tile UI actions
 */
export interface PlotTileUIActions {
  // UI actions will be empty as per PlotTileUI
}

/**
 * Interface for plot-specific actions
 */
export interface PlotActions extends
  PlotTileMetaActions,
  PlotTileDataActions,
  PlotTileUIActions {}

/**
 * Custom hook to access plot-specific tile state and actions
 * @param tileName The name of the tile to access
 * @param tabName Optional name of the tab containing the tile
 * @param interfaceName Optional name of the interface containing the tab
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing plot-specific tile state, actions, and existence flag
 */
export function usePlotTile(
  tileName: string | null,
  tabName?: string | null,
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Get tile meta information using the useTileMeta hook
  const { tileId, tileExists } = useTileMeta(tileName, tabName || null, interfaceName || null, projectName || null);
  
  // Get the tile type to check if it's a plot
  const tileType = useStoreContext(
    useShallow(state => {
      if (!tileId) return null;
      return state.tilesById[tileId]?.type;
    })
  );
  
  // Check if the tile exists and is a plot
  const isPlotTile = tileExists && tileType === 'Plot';

  const plotTile = useStoreContext(
    useShallow(state => {
      if (!isPlotTile || !tileId) return null;
      return state.tilesById[tileId]?.plotTile as PlotTile;
    })
  );

  // Access store for plot-specific meta data
  const plotMeta = useMemo(() => {
    // Return empty object as per PlotTileMeta interface
    return DEFAULT_PLOT_TILE_META as PlotTileMeta;
  }, []);

  // Access store for plot-specific data
  const plotData = useMemo(() => {
    if (!isPlotTile || !tileId || !plotTile) return null;
    
    return {
      plot_type: plotTile.plot_type,
      plot_scale_x: plotTile.plot_scale_x,
      plot_scale_y: plotTile.plot_scale_y,
      plot_aggregate: plotTile.plot_aggregate,
      x_axis: plotTile.x_axis,
      y_axis: plotTile.y_axis,
      plot_group_by: plotTile.plot_group_by,
      bin_count: plotTile.bin_count,
      regression_line: plotTile.regression_line,
      plotDataItem: plotTile.plotDataItem
    } as PlotTileData;
  }, [
    isPlotTile,
    tileId,
    plotTile?.plot_type,
    plotTile?.plot_scale_x,
    plotTile?.plot_scale_y,
    plotTile?.plot_aggregate,
    plotTile?.x_axis,
    plotTile?.y_axis,
    plotTile?.plot_group_by,
    plotTile?.bin_count,
    plotTile?.regression_line,
    plotTile?.plotDataItem,
  ]);

  // Access store for plot-specific UI state
  const plotUI = useMemo(() => {
    if (!isPlotTile || !tileId) return null;
    // Return empty object as per PlotTileUI interface
    return DEFAULT_PLOT_TILE_UI as PlotTileUI;
  }, [isPlotTile, tileId]);

  // Get store update functions
  const storeUpdatePlotTile = useStoreContext(state => state.updatePlotTile);

  // Create memoized meta actions
  const plotMetaActions = useMemo<PlotTileMetaActions | null>(() => {
    if (!isPlotTile || !tileId) return null;
    
    // Return empty object as per PlotTileMeta interface
    return DEFAULT_PLOT_TILE_META_ACTIONS as PlotTileMetaActions;
  }, [isPlotTile, tileId]);

  // Create memoized data actions
  const plotDataActions = useMemo<PlotTileDataActions | null>(() => {
    if (!isPlotTile || !tileId) return null;
    
    return {
      setPlotType: (plotType) => {
        const update: Partial<PlotTile> = { 
          plot_type: plotType 
        };
        storeUpdatePlotTile(tileId, update);
      },
      
      setPlotScaleX: (plotScaleX) => {
        const update: Partial<PlotTile> = { 
          plot_scale_x: plotScaleX 
        };
        storeUpdatePlotTile(tileId, update);
      },
      
      setPlotScaleY: (plotScaleY) => {
        const update: Partial<PlotTile> = { 
          plot_scale_y: plotScaleY 
        };
        storeUpdatePlotTile(tileId, update);
      },
      
      setAggregateProperty: (aggregateProperty) => {
        const update: Partial<PlotTile> = { 
          plot_aggregate: aggregateProperty 
        };
        storeUpdatePlotTile(tileId, update);
      },
      
      setXAxis: (xAxis) => {
        const update: Partial<PlotTile> = { 
          x_axis: xAxis 
        };
        storeUpdatePlotTile(tileId, update);
      },
      
      setYAxis: (yAxis) => {
        const update: Partial<PlotTile> = { 
          y_axis: yAxis 
        };
        storeUpdatePlotTile(tileId, update);
      },
      
      setPlotGroupBy: (plotGroupBy) => {
        const update: Partial<PlotTile> = { 
          plot_group_by: plotGroupBy 
        };
        storeUpdatePlotTile(tileId, update);
      },
      
      setBinCount: (binCount) => {
        const update: Partial<PlotTile> = { 
          bin_count: binCount 
        };
        storeUpdatePlotTile(tileId, update);
      },
      
      setRegressionLine: (regressionLine) => {
        const update: Partial<PlotTile> = { 
          regression_line: regressionLine 
        };
        storeUpdatePlotTile(tileId, update);
      },

      setPlotDataItem: (plotDataItem) => {
        const update: Partial<PlotTile> = { 
          plotDataItem: plotDataItem 
        };
        storeUpdatePlotTile(tileId, update);
      }
    };
  }, [isPlotTile, tileId, storeUpdatePlotTile]);

  // Create memoized UI actions
  const plotUIActions = useMemo<PlotTileUIActions | null>(() => {
    if (!isPlotTile || !tileId) return null;
    
    // Return empty object as per PlotTileUI interface
    return DEFAULT_PLOT_TILE_UI_ACTIONS as PlotTileUIActions;
  }, [isPlotTile, tileId]);

  // Build a final `plotTile` object from the separate meta, data, and UI objects
  const combinedPlotTile = useMemo(() => {
    if (!plotMeta || !plotData || !plotUI) return null;
    
    return {
      ...plotMeta,
      ...plotData,
      ...plotUI
    };
  }, [plotMeta, plotData, plotUI]);

  // Build a final `plotTileActions` object from the separate meta, data, and UI actions
  const combinedPlotTileActions = useMemo(() => {
    if (!plotMetaActions || !plotDataActions || !plotUIActions) return null;
    
    return {
      ...plotMetaActions,
      ...plotDataActions,
      ...plotUIActions
    };
  }, [plotMetaActions, plotDataActions, plotUIActions]);

  // If no tile name is provided or tile doesn't exist, return default
  if (!tileName || !isPlotTile) {
    return DEFAULT_USE_PLOT_TILE_RETURN;
  }

  return {
    plotTile: combinedPlotTile as PlotTile,
    plotTileActions: combinedPlotTileActions as PlotActions,
    exists: isPlotTile
  };
}