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
        [tableName, { ...args.getLogsParameters }]
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
  if (plotTile.plotTile?.xAxis && plotTile.plotTile?.xAxis?.includes(".")) {
    const tableName = plotTile.plotTile?.xAxis?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }
  
  // Check y-axis
  if (plotTile.plotTile?.yAxis && plotTile.plotTile?.yAxis?.includes(".")) {
    const tableName = plotTile.plotTile?.yAxis?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }
  
  // Check plot-group-by
  if (plotTile.plotTile?.plotGroupBy && plotTile.plotTile?.plotGroupBy?.includes(".")) {
    const tableName = plotTile.plotTile?.plotGroupBy?.split(".")[0];
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
      updatedPlotArguments[tableName] = { filterExpr: "" };
    }
    
    // Update plot arguments with the table parameters - exactly as in Main.tsx
    if (tableTile.metric) updatedPlotArguments[tableName].metric = tableTile.metric;
    if (tableTile.grouping) updatedPlotArguments[tableName].grouping = tableTile.grouping;
    if (tableTile.filters) updatedPlotArguments[tableName].column_filters = tableTile.filters;
    if (tableTile.commonFilter) updatedPlotArguments[tableName].commonFilter = tableTile.commonFilter;
    if (tableTile.freeze) updatedPlotArguments[tableName].freeze = tableTile.freeze;
    if (tableTile.context) updatedPlotArguments[tableName].context = tableTile.context;
    if (tableTile.columnContext) updatedPlotArguments[tableName].columnContext = tableTile.columnContext;
  });
  
  return updatedPlotArguments;
} 