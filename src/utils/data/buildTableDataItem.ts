import { TableDataItem, TileData } from "@/types/evals/grid";
import { LogFieldsResponseProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import { buildFilterExpression } from "@/utils/evals/filters";
import { getLogsDetails } from "@/utils/evals/common";
import { LogsActions } from "@/types/evals/grid";
import { processContext } from "@/utils/evals/columnOperations";

/**
 * Builds a TableDataItem from logs data and other inputs
 * Can be used directly in client components instead of passing through a server component
 */
export async function buildTableDataItem(
  tile: TileData,
  fields: LogFieldsResponseProps,
  logsData: LogsResponseProps,
  projectId: string,
  logsActions: LogsActions
): Promise<TableDataItem> {
  // Build filter expression
  const filterExpression = buildFilterExpression(
    tile.filters,
    tile.common_filter,
    tile.column_context,
    tile.freeze,
    fields
  );

  // Process column contexts
  const prefixes = Object.keys(fields).map(
    key => key.includes("/") ? key.split("/").slice(0, -1).join("/") : null
  ).filter(key => key != null);

  const columnContexts = Array.from(
    new Set(prefixes.map(prefix => {
      const parts = prefix!.split("/");
      let context = "";
      return parts.map(part => {
        context += part + "/";
        return context;
      });    
    }).flat().sort())
  );

  // Get logs details
  const { entriesProperties, paramsProperties, logs, params, metrics, boundaries } = await getLogsDetails(
    logsData,
    fields,
    tile.context || null,
    tile.column_context || null,
    projectId,
    filterExpression,
    tile.grouping || null,
    tile.metric,
    tile.table_tile?.sorting || null,
    tile.table_tile?.hidden_columns,
    logsActions
  );

  const limit = 20; // Default page size

  // Construct table data item
  const tableDataItem: TableDataItem = {
    columnContexts: columnContexts,
    baseIndex: tile.table_tile?.selected,
    hiddenColumns: tile.table_tile?.hidden_columns,
    columnOrdering: tile.table_tile?.column_order,
    selection: tile.table_tile?.selected,
    fields,
    logsData,
    totalPages: Math.ceil(logsData.count / limit),
    entriesProperties,
    paramsProperties,
    logs,
    params,
    metrics,
    boundaries,
    metric: tile.metric ?? "mean"
  };

  return tableDataItem;
}

/**
 * Fetches logs data and then builds a TableDataItem
 * Useful for server components or client components that need to fetch fresh data
 */
export async function fetchAndBuildTableDataItem(
  tile: TileData,
  fields: LogFieldsResponseProps,
  projectId: string,
  logsActions: LogsActions
): Promise<TableDataItem> {
  // Build filter expression
  const filterExpression = buildFilterExpression(
    tile.filters,
    tile.common_filter,
    tile.column_context,
    tile.freeze,
    fields
  );

  // Handle sorting
  const sortingObject = tile.table_tile?.sorting ? getSortingObject(tile) : "";
  const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null;

  // Handle grouping
  const groupingExpression = tile.grouping || null;

  // Handle group sorting
  const groupSortingObject = tile.table_tile?.group_sorting && tile.grouping ? 
    getGroupSortingObject(tile) : "";
  const groupSortingExpression = groupSortingObject ? JSON.stringify(groupSortingObject) : null;

  // Fetch logs data
  const limit = 20;
  const offset = tile.table_tile?.page_number ? parseInt(tile.table_tile.page_number) * limit : 0;
  
  const logsData = await logsActions.get(
    projectId,
    tile.context || null,
    tile.column_context || null,
    filterExpression,
    sortingExpression,
    groupingExpression,
    groupSortingExpression,
    null,
    null,
    null,
    limit,
    offset,
    groupingExpression ? 0 : null,
    null,
    Date.now().toString()
  );

  // Build table data item using the fetched logs data
  return buildTableDataItem(tile, fields, logsData, projectId, logsActions);
}

/**
 * Helper function to get sorting object from tile
 */
export function getSortingObject(tile: TileData) {
  if (!tile.table_tile?.sorting) return "";
  
  const { column_context, table_tile } = tile;
  const sorting = table_tile?.sorting || "";
  
  return Object.fromEntries(
    sorting.split(",").map(value => {
      const fieldName = value.split("@")[0];
      const processedField = column_context
        ? processContext("merge", column_context, fieldName) 
        : fieldName;
      const direction = value.split("@")[1].replace("true", "descending").replace("false", "ascending");
      return [processedField, direction];
    })
  );
}

/**
 * Helper function to get group sorting object from tile
 */
export function getGroupSortingObject(tile: TileData) {
  if (!tile.table_tile?.group_sorting || !tile.grouping) return "";
  
  const { column_context, table_tile, grouping, metric } = tile;
  const groupSorting = table_tile?.group_sorting || "";
  
  return Object.fromEntries(
    groupSorting.split(",").map(value => {
      const group = column_context && grouping
        ? processContext("merge", column_context, grouping.split(",")[0]) 
        : grouping!.split(",")[0];
      
      const field = column_context && value.split("@")[0]
        ? processContext("merge", column_context, value.split("@")[0]) 
        : value.split("@")[0];
      
      const direction = value.split("@")[1].replace("true", "descending").replace("false", "ascending");
      return [group, {field, direction, metric: metric ?? "mean"}];
    })
  );
} 