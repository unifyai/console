import { PlotDataItem } from "@/types/evals/grid";

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
  plot_type?: string | null;          // Used in addition to plotType for compatibility
  plot_scale_x?: string | null;       // X-axis scale type (linear, log, etc.)
  plot_scale_y?: string | null;       // Y-axis scale type
  is_aggregated?: string | null;      // Whether the plot data is aggregated
  x_axis?: string | null;             // Used in addition to xAxis for compatibility
  y_axis?: string | null;             // Used in addition to yAxis for compatibility
  plot_group_by?: string | null;      // Used in addition to groupBy for compatibility
  bin_count?: string | null;          // Number of bins for histograms
  regression_line?: string | null;    // Whether to show regression line

  // Plot data item
  plotDataItem?: PlotDataItem;
}

// Plot tile UI - UI-related state
export interface PlotTileUI {
}

// Combined Plot tile type
export type PlotTile = PlotTileMeta & PlotTileData & PlotTileUI;

// plotKeys: all keys that are used in `asTileItem` in `useTileItem` hook to convert
// a PlotTile into a TileProps
export const PLOT_TILE_PROPS_KEYS_AS_PLOT_TILE_KEYS: (keyof PlotTile)[] = [
  "plot_type", "plot_scale_x", "plot_scale_y", "is_aggregated",
  "x_axis", "y_axis", "plot_group_by", "bin_count", "regression_line"
];

// plotTileKeys: all fields for PlotTile
export const PLOT_TILE_KEYS: (keyof PlotTile)[] = [
  ...PLOT_TILE_PROPS_KEYS_AS_PLOT_TILE_KEYS,
  "plotDataItem"
];

/**
 * Initialize a new plot tile
 */
export function initPlotTile(initialState: Partial<PlotTile> = {}): PlotTile {
  return {
    // Data
    plot_type: initialState.plot_type,
    plot_scale_x: initialState.plot_scale_x,
    plot_scale_y: initialState.plot_scale_y,
    is_aggregated: initialState.is_aggregated,
    x_axis: initialState.x_axis,
    y_axis: initialState.y_axis,
    plot_group_by: initialState.plot_group_by,
    bin_count: initialState.bin_count,
    regression_line: initialState.regression_line,

    // Fields from PlotDataItem
    plotDataItem: {
      plotLogs: initialState.plotDataItem?.plotLogs || [],
      plotArguments: initialState.plotDataItem?.plotArguments || {},
      plotFields: initialState.plotDataItem?.plotFields || {},
    } as PlotDataItem,

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
