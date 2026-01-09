import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { useTileMeta } from './useTileMeta';
import { PlotTile, PlotTileMeta, PlotTileData, PlotTileUI } from '../../slices/selectors/plotTile';
import { useShallow } from 'zustand/react/shallow';

/**
 * Default return value when no tile is specified or tile doesn't exist
 */
export const DEFAULT_USE_PLOT_TILE_RETURN = {
  plotTile: null,
  plotTileActions: null,
  exists: false,
};

// Default plot tile meta
export const DEFAULT_PLOT_TILE_META: PlotTileMeta = {};

// Default plot tile UI
export const DEFAULT_PLOT_TILE_UI: PlotTileUI = {};

// Default plot tile meta actions
export const DEFAULT_PLOT_TILE_META_ACTIONS: PlotTileMetaActions = {};

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
}

/**
 * Interface for plot tile UI actions
 */
export interface PlotTileUIActions {
  // UI actions will be empty as per PlotTileUI
  setPlotGroupByColors: (plotGroupByColors: string | undefined) => void;
}

/**
 * Interface for plot-specific actions
 */
export interface PlotActions extends PlotTileMetaActions, PlotTileDataActions, PlotTileUIActions {}

/**
 * Custom hook to access plot-specific tile state and actions
 * @param tileIdOrName The ID or name of the tile to access
 * @param tabIdOrName Optional ID or name of the tab containing the tile
 * @returns Object containing plot-specific tile state, actions, and existence flag
 */
export function usePlotTile(tileIdOrName: string | null, tabIdOrName?: string | null) {
  // Get tile meta information using the useTileMeta hook
  const { tileId, tileExists } = useTileMeta(tileIdOrName, tabIdOrName || null);

  // Get the tile type to check if it's a plot
  const tileType = useStoreContext(
    useShallow((state) => {
      if (!tileId) return null;
      return state.tilesById[tileId]?.type;
    })
  );

  // Check if the tile exists and is a plot
  const isPlotTile = tileExists && tileType === 'Plot';

  const plotTile = useStoreContext(
    useShallow((state) => {
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
      plotType: plotTile.plotType,
      plotScaleX: plotTile.plotScaleX,
      plotScaleY: plotTile.plotScaleY,
      plotAggregate: plotTile.plotAggregate,
      xAxis: plotTile.xAxis,
      yAxis: plotTile.yAxis,
      plotGroupBy: plotTile.plotGroupBy,
      binCount: plotTile.binCount,
      regressionLine: plotTile.regressionLine,
    } as PlotTileData;
  }, [isPlotTile, tileId, plotTile]);

  // Access store for plot-specific UI state
  const plotUI = useMemo(() => {
    if (!isPlotTile || !tileId || !plotTile) return null;
    // Return empty object as per PlotTileUI interface
    return {
      plotGroupByColors: plotTile.plotGroupByColors,
    } as PlotTileUI;
  }, [isPlotTile, tileId, plotTile]);

  // Get store update functions
  const storeUpdatePlotTile = useStoreContext((state) => state.updatePlotTile);

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
          plotType: plotType,
        };
        storeUpdatePlotTile(tileId, update);
      },

      setPlotScaleX: (plotScaleX) => {
        const update: Partial<PlotTile> = {
          plotScaleX: plotScaleX,
        };
        storeUpdatePlotTile(tileId, update);
      },

      setPlotScaleY: (plotScaleY) => {
        const update: Partial<PlotTile> = {
          plotScaleY: plotScaleY,
        };
        storeUpdatePlotTile(tileId, update);
      },

      setAggregateProperty: (aggregateProperty) => {
        const update: Partial<PlotTile> = {
          plotAggregate: aggregateProperty,
        };
        storeUpdatePlotTile(tileId, update);
      },

      setXAxis: (xAxis) => {
        const update: Partial<PlotTile> = {
          xAxis: xAxis,
        };
        storeUpdatePlotTile(tileId, update);
      },

      setYAxis: (yAxis) => {
        const update: Partial<PlotTile> = {
          yAxis: yAxis,
        };
        storeUpdatePlotTile(tileId, update);
      },

      setPlotGroupBy: (plotGroupBy) => {
        const update: Partial<PlotTile> = {
          plotGroupBy: plotGroupBy,
        };
        storeUpdatePlotTile(tileId, update);
      },

      setBinCount: (binCount) => {
        const update: Partial<PlotTile> = {
          binCount: binCount,
        };
        storeUpdatePlotTile(tileId, update);
      },

      setRegressionLine: (regressionLine) => {
        const update: Partial<PlotTile> = {
          regressionLine: regressionLine,
        };
        storeUpdatePlotTile(tileId, update);
      },
    };
  }, [isPlotTile, tileId, storeUpdatePlotTile]);

  // Create memoized UI actions
  const plotUIActions = useMemo<PlotTileUIActions | null>(() => {
    if (!isPlotTile || !tileId) return null;

    // Return empty object as per PlotTileUI interface
    return {
      setPlotGroupByColors: (plotGroupByColors) => {
        const update: Partial<PlotTile> = {
          plotGroupByColors: plotGroupByColors,
        };
        storeUpdatePlotTile(tileId, update);
      },
    } as PlotTileUIActions;
  }, [isPlotTile, tileId, storeUpdatePlotTile]);

  // Build a final `plotTile` object from the separate meta, data, and UI objects
  const combinedPlotTile = useMemo(() => {
    if (!plotMeta || !plotData || !plotUI) return null;

    return {
      ...plotMeta,
      ...plotData,
      ...plotUI,
    };
  }, [plotMeta, plotData, plotUI]);

  // Build a final `plotTileActions` object from the separate meta, data, and UI actions
  const combinedPlotTileActions = useMemo(() => {
    if (!plotMetaActions || !plotDataActions || !plotUIActions) return null;

    return {
      ...plotMetaActions,
      ...plotDataActions,
      ...plotUIActions,
    };
  }, [plotMetaActions, plotDataActions, plotUIActions]);

  // If no tile name is provided or tile doesn't exist, return default
  if (!tileIdOrName || !isPlotTile) {
    return DEFAULT_USE_PLOT_TILE_RETURN;
  }

  return {
    plotTile: combinedPlotTile as PlotTile,
    plotTileActions: combinedPlotTileActions as PlotActions,
    exists: isPlotTile,
  };
}
