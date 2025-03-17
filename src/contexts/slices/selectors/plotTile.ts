import { PlotDataItem } from "@/types/evals/grid";

// Plot tile related types
export interface PlotTileData {
  // Core plot data properties
  lastUpdated: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Plot-specific fields from TileProps
  // ( IMPORTANT )
  // NOTE: When adding new fields here from TileProps in grid.ts,
  // make sure to update the PLOT_TILE_KEYS array in the useTile hook.
  // Look at the tableTile and viewTile files for examples.
  plot_type?: string;          // Used in addition to plotType for compatibility
  plot_scale_x?: string;       // X-axis scale type (linear, log, etc.)
  plot_scale_y?: string;       // Y-axis scale type
  is_aggregated?: string;      // Whether the plot data is aggregated
  x_axis?: string;             // Used in addition to xAxis for compatibility
  y_axis?: string;             // Used in addition to yAxis for compatibility
  plot_group_by?: string;      // Used in addition to groupBy for compatibility
  bin_count?: string;          // Number of bins for histograms
  regression_line?: string;    // Whether to show regression line

  // Plot data item
  plotDataItem?: PlotDataItem;
}

/**
 * Initialize a new plot tile
 */
export function initPlotTileData(initialState: Partial<PlotTileData> = {}): PlotTileData {
  return {
    // Core plot data properties
    lastUpdated: initialState.lastUpdated || null,
    createdAt: initialState.createdAt || new Date().toISOString(),
    updatedAt: initialState.updatedAt || new Date().toISOString(),
    
    // Plot-specific fields from TileProps
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
  } as PlotTileData;
}

/**
 * Update an existing plot tile
 */
export function updatePlotTile(plotTile: PlotTileData, updates: Partial<PlotTileData>): PlotTileData {
  return {
    ...plotTile,
    ...updates,
    updatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}
