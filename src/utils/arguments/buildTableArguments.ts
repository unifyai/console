import { TileData } from "@/types/evals/grid";
import { TableArguments, LogFieldsResponseProps } from "@/types/evals/logs";
import { buildFilterExpression } from "@/utils/evals/filters";
import { processContext } from "@/utils/evals/columnOperations";

/**
 * Builds table arguments for a tile
 * Can be used by both TableWrapper and PlotWrapper
 */
export async function buildTableArgumentsForTile(
  tile: TileData,
  fields: LogFieldsResponseProps,
  existingArguments: TableArguments = {}
): Promise<TableArguments> {
  const tileName = tile.name;
  const tableArguments = { ...existingArguments };
  
  // Only process table tiles
  if (!tile.table_tile) {
    return tableArguments;
  }
  
  // Build filter expression
  const filterExpression = buildFilterExpression(
    tile.filters,
    tile.common_filter,
    tile.column_context,
    tile.freeze,
    fields
  );
  
  // Handle sorting
  const sortingObject = tile.table_tile?.sorting ? Object.fromEntries(
    tile.table_tile.sorting.split(",").map(value => [
      tile.column_context ? processContext("merge", tile.column_context, value.split("@")[0]) : value.split("@")[0],
      value.split("@")[1].replace("true", "descending").replace("false", "ascending")
    ])
  ) : "";
  const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null;
  
  // Handle grouping
  const groupingExpression = tile.grouping || null;
  
  // Handle group sorting
  const groupSortingObject = tile.table_tile?.group_sorting && tile.grouping ? Object.fromEntries(
    tile.table_tile.group_sorting.split(",").map(value => {
      const group = tile.column_context 
        ? processContext("merge", tile.column_context, tile.grouping!.split(",")[0]) 
        : tile.grouping!.split(",")[0];
      const field = tile.column_context 
        ? processContext("merge", tile.column_context, value.split("@")[0]) 
        : value.split("@")[0];
      const direction = value.split("@")[1].replace("true", "descending").replace("false", "ascending");
      const metric = tile.metric ?? "mean";
      return [group, {field, direction, metric}];
    })
  ) : "";
  const groupSortingExpression = groupSortingObject ? JSON.stringify(groupSortingObject) : null;
  
  // Create or update this tile's arguments
  tableArguments[tileName] = tableArguments[tileName] || {
    getLogs_parameters: { filter_expr: "" },
    available_fields: {}
  };
  
  // Set filter expression
  tableArguments[tileName].getLogs_parameters.filter_expr = filterExpression || "";
  
  // Add optional parameters
  if (tile.filters) tableArguments[tileName].getLogs_parameters["column_filters"] = tile.filters;
  if (tile.common_filter) tableArguments[tileName].getLogs_parameters["common_filter"] = tile.common_filter;
  if (tile.freeze) tableArguments[tileName].getLogs_parameters["freeze"] = tile.freeze;
  if (sortingExpression) tableArguments[tileName].getLogs_parameters["sorting"] = sortingExpression;
  if (groupingExpression) tableArguments[tileName].getLogs_parameters["grouping"] = groupingExpression;
  if (groupSortingExpression) tableArguments[tileName].getLogs_parameters["group_sorting"] = groupSortingExpression;
  if (tile.context) tableArguments[tileName].getLogs_parameters["context"] = tile.context;
  if (tile.column_context) tableArguments[tileName].getLogs_parameters["column_context"] = tile.column_context;
  
  return tableArguments;
}

/**
 * Builds table arguments for multiple tiles
 */
export async function buildTableArguments(
  tiles: TileData[],
  fieldsMap: Record<string, LogFieldsResponseProps>,
  existingArguments: TableArguments = {}
): Promise<TableArguments> {
  let tableArguments = { ...existingArguments };
  
  // Process each table tile
  for (const tile of tiles) {
    if (tile.table_tile) {
      const fields = fieldsMap[tile.context || ""] || {};
      tableArguments = await buildTableArgumentsForTile(tile, fields, tableArguments);
    }
  }
  
  return tableArguments;
} 