import { PlotDataItem } from "@/types/interfaces/grid";

// ( IMPORTANT )
// NOTE: When adding new fields here,
// make sure to update the PLOT_TILE_KEYS array in this file.
// Look at the tableTile and viewTile files for examples.

// Plot tile meta - metadata information
export interface PlotTileMeta {
}

// Plot tile data - business data 
export interface PlotTileData {
  // Core plot data properties
  
  // Plot-specific fields from TileProps
  plotType?: string | null;          // Used in addition to plotType for compatibility
  plotScaleX?: string | null;       // X-axis scale type (linear, log, etc.)
  plotScaleY?: string | null;       // Y-axis scale type
  plotAggregate?: string | null;     // Table grouped by property used to plot metrics for
  xAxis?: string | null;             // Used in addition to xAxis for compatibility
  yAxis?: string | null;             // Used in addition to yAxis for compatibility
  plotGroupBy?: string | null;      // Used in addition to groupBy for compatibility
  binCount?: string | null;          // Number of bins for histograms
  regressionLine?: string | null;    // Whether to show regression line
}

// Plot tile UI - UI-related state
export interface PlotTileUI {
  plotGroupByColors?: string | null; // Color scheme used for grouped plots. One of the schemes available at https://d3js.org/d3-scale-chromatic/categorical
}

// Combined Plot tile type
export type PlotTile = PlotTileMeta & PlotTileData & PlotTileUI;

// plotKeys: all keys that are used in `asTileItem` in `useTileItem` hook to convert
// a PlotTile into a TileProps
export const PLOT_TILE_PROPS_KEYS_AS_PLOT_TILE_KEYS: (keyof PlotTile)[] = [
  "plotType", "plotScaleX", "plotScaleY", "plotAggregate",
  "xAxis", "yAxis", "plotGroupBy", "plotGroupByColors", "binCount", "regressionLine"
];

// plotTileKeys: all fields for PlotTile
export const PLOT_TILE_KEYS: (keyof PlotTile)[] = [
  ...PLOT_TILE_PROPS_KEYS_AS_PLOT_TILE_KEYS
];

/**
 * Initialize a new plot tile
 */
export function initPlotTile(initialState: Partial<PlotTile> = {}): PlotTile {
  return {
    // Data
    plotType: initialState.plotType !== undefined ? initialState.plotType : null,
    plotScaleX: initialState.plotScaleX !== undefined ? initialState.plotScaleX : null,
    plotScaleY: initialState.plotScaleY !== undefined ? initialState.plotScaleY : null,
    plotAggregate: initialState.plotAggregate !== undefined ? initialState.plotAggregate : null,
    xAxis: initialState.xAxis !== undefined ? initialState.xAxis : null,
    yAxis: initialState.yAxis !== undefined ? initialState.yAxis : null,
    plotGroupBy: initialState.plotGroupBy !== undefined ? initialState.plotGroupBy : null,
    plotGroupByColors: initialState.plotGroupByColors !== undefined ? initialState.plotGroupByColors : null,
    binCount: initialState.binCount !== undefined ? initialState.binCount : null,
    regressionLine: initialState.regressionLine !== undefined ? initialState.regressionLine : null,

    ...initialState,
  } as PlotTile;
}

/**
 * Update an existing plot tile
 */
export function updatePlotTile(plotTile: PlotTile, updates: Partial<PlotTile>): PlotTile {
  return {
    ...plotTile,
    ...updates,
  };
}
