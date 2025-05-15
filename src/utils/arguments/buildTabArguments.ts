import { TileData } from "@/types/evals/grid";
import { TableArguments, PlotArguments, LogFieldsResponseProps } from "@/types/evals/logs";
import { buildTableArguments } from "./buildTableArguments";
import { buildPlotArguments, updatePlotArgumentsForUsedTables } from "./buildPlotArguments";

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
  let tableArguments = buildTableArguments(tableTiles, fields, existingTableArgs);
    
  // Step 2: Build base PlotArguments from TableArguments
  let plotArguments = buildPlotArguments(tableArguments, existingPlotArgs);
  
  // Step 3: Update PlotArguments for each plot tile's specific needs
  for (const plotTile of plotTiles) {
    plotArguments = updatePlotArgumentsForUsedTables(plotTile, tableTiles, plotArguments);
  }
  
  return { tableArguments, plotArguments };
} 