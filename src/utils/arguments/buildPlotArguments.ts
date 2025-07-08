import { TileData } from "@/types/interfaces/grid";
import { PlotArguments, TableArguments } from "@/types/interfaces/logs";

/**
 * Builds plot arguments based on table arguments
 * Can be used by PlotWrapper
 */
export function buildPlotArguments(
  tableArguments: TableArguments,
  existingPlotArguments: PlotArguments = {}
): PlotArguments {
  // Initialize with existing plot arguments or an empty object
  let plotArguments = { ...existingPlotArguments };
  
  // If plotArguments is empty, initialize from tableArguments
  if (Object.keys(plotArguments).length === 0) {
    plotArguments = Object.fromEntries(
      Object.entries(tableArguments).map(([tableName, args]) => 
        [tableName, { ...args.getLogs_parameters }]
      )
    );
  }
  
  return plotArguments;
}

/**
 * Updates plot arguments for specific tables used by a plot
 */
export function updatePlotArgumentsForUsedTables(
  plotTile: TileData,
  tableTiles: TileData[],
  plotArguments: PlotArguments
): PlotArguments {
  // Initialize with existing plot arguments
  const updatedPlotArguments = { ...plotArguments };
  
  // Identify which tables are used in this plot by name
  const usedTableNames: string[] = [];
  
  // Check x-axis
  if (plotTile.plot_tile?.x_axis && plotTile.plot_tile?.x_axis?.includes(".")) {
    const tableName = plotTile.plot_tile?.x_axis?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }
  
  // Check y-axis
  if (plotTile.plot_tile?.y_axis && plotTile.plot_tile?.y_axis?.includes(".")) {
    const tableName = plotTile.plot_tile?.y_axis?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }
  
  // Check plot-group-by
  if (plotTile.plot_tile?.plot_group_by && plotTile.plot_tile?.plot_group_by?.includes(".")) {
    const tableName = plotTile.plot_tile?.plot_group_by?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }
  
  // For tables actually used in this plot, update arguments
  usedTableNames.forEach(tableName => {
    // Find the table tile for this name
    const tableTile = tableTiles.find(t => t.name === tableName);
    
    // Skip if table not found
    if (!tableTile) {
      return;
    }
    
    // Ensure the table has an entry in plotArguments
    if (!updatedPlotArguments[tableName]) {
      updatedPlotArguments[tableName] = { filter_expr: "" };
    }
    
    // Update plot arguments with the table parameters - exactly as in Main.tsx
    if (tableTile.metric) updatedPlotArguments[tableName].metric = tableTile.metric;
    if (tableTile.grouping) updatedPlotArguments[tableName].grouping = tableTile.grouping;
    if (tableTile.filters) updatedPlotArguments[tableName].column_filters = tableTile.filters;
    if (tableTile.common_filter) updatedPlotArguments[tableName].common_filter = tableTile.common_filter;
    if (tableTile.freeze) updatedPlotArguments[tableName].freeze = tableTile.freeze;
    if (tableTile.context) updatedPlotArguments[tableName].context = tableTile.context;
    if (tableTile.column_context) updatedPlotArguments[tableName].column_context = tableTile.column_context;
  });
  
  return updatedPlotArguments;
} 