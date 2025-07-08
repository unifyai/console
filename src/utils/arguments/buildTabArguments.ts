import { TileData } from "@/types/interfaces/grid";
import { TableArguments, PlotArguments, LogFieldsResponseProps } from "@/types/interfaces/logs";
import { buildTableArguments } from "./buildTableArguments";
import { buildPlotArguments, updatePlotArgumentsForUsedTables } from "./buildPlotArguments";

/**
 * Debug flag for performance logging
 * Set NEXT_PUBLIC_DEBUG_PERFORMANCE=true to enable detailed performance timing logs
 */
const DEBUG_PERFORMANCE = process.env.NEXT_PUBLIC_DEBUG_PERFORMANCE === 'true';

/**
 * Conditional debug logger for performance metrics
 */
const perfLog = (...args: any[]) => {
  if (DEBUG_PERFORMANCE) {
    console.log(...args);
  }
};

/**
 * Builds both TableArguments and PlotArguments for all tiles in a tab
 * This centralizes the arguments creation logic at the tab level
 * 
 * @param tiles All tiles from a specific tab
 * @param fieldsMap Map of context to fields for all needed contexts
 * @param existingTableArgs Optional existing TableArguments to update
 * @param existingPlotArgs Optional existing PlotArguments to update
 * @returns Object containing both TableArguments and PlotArguments
 */
export function buildTabArguments(
  tiles: TileData[],
  fields: LogFieldsResponseProps[],
  existingTableArgs: TableArguments = {},
  existingPlotArgs: PlotArguments = {}
): {
  tableArguments: TableArguments,
  plotArguments: PlotArguments
} {
  // Filter to get just the table and plot tiles
  const tableTiles = tiles.filter(t => t.type === "Table");
  const plotTiles = tiles.filter(t => t.type === "Plot");
  
  // Step 1: Build all TableArguments for every table tile
  const tBuildTableArgs = performance.now();
  let tableArguments = buildTableArguments(tableTiles, fields, existingTableArgs);
  const tBuildTableArgsEnd = performance.now();
  perfLog(`[perf] buildTableArguments: ${(tBuildTableArgsEnd - tBuildTableArgs).toFixed(2)} ms`);
    
  // Step 2: Build base PlotArguments from TableArguments
  const tBuildPlotArgs = performance.now();
  let plotArguments = buildPlotArguments(tableArguments, existingPlotArgs);
  const tBuildPlotArgsEnd = performance.now();
  perfLog(`[perf] buildPlotArguments: ${(tBuildPlotArgsEnd - tBuildPlotArgs).toFixed(2)} ms`);
  
  // Step 3: Update PlotArguments for each plot tile's specific needs
  const tUpdatePlotArgs = performance.now();
  for (const plotTile of plotTiles) {
    plotArguments = updatePlotArgumentsForUsedTables(plotTile, tableTiles, plotArguments);
  }
  const tUpdatePlotArgsEnd = performance.now();
  perfLog(`[perf] updatePlotArgumentsForUsedTables: ${(tUpdatePlotArgsEnd - tUpdatePlotArgs).toFixed(2)} ms`);

  return { tableArguments, plotArguments };
} 