import { TableDataItem, TileData } from "@/types/evals/grid";
import { GroupedLogProps, LogFieldsResponseProps, LogItemProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import { buildFilterExpression } from "@/utils/evals/filters";
import { getLogsDetails } from "@/utils/evals/common";
import { LogsActions } from "@/types/evals/grid";
import { processContext } from "@/utils/evals/columnOperations";
import { maybeFlattenGroupedLogs } from "../evals/grouping";

/**
 * Builds a TableDataItem from logs data and other inputs
 * Can be used directly in client components instead of passing through a server component
 */
export async function buildTableDataItem(
  tile: TileData,
  fields: LogFieldsResponseProps,
  logsData: LogsResponseProps,
  projectId: string,
  logsActions: LogsActions,
  previousLogs?: LogProps[] | GroupedLogProps[]
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
  const tGetLogsDetails = performance.now();
  const { entriesProperties, paramsProperties, logs, params, metrics, boundaries } = await getLogsDetails(
    logsData,
    fields,
    tile.context || null,
    tile.column_context || null,
    projectId,
    filterExpression,
    tile.metric,
    tile.table_tile?.sorting || null,
    tile.table_tile?.hidden_columns,
    logsActions
  );
  const tGetLogsDetailsEnd = performance.now();
  console.log(`[perf] getLogsDetails: ${(tGetLogsDetailsEnd - tGetLogsDetails).toFixed(2)} ms`);

  const limit = 20; // Default page size

  let newCells: string[] = [];
  if (previousLogs) {
    newCells = getNewCells(previousLogs, logs);
  }

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
    metric: tile.metric ?? "mean",
    newCells: newCells
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
  logsActions: LogsActions,
  previousLogs?: LogProps[] | GroupedLogProps[]
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
  const limit = tile.table_tile?.limit ?? 20;
  const offset = tile.table_tile?.offset ?? 0;
  
  const tGetLogs = performance.now();
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
    null,
    null
  );
  const tGetLogsEnd = performance.now();
  console.log(`[perf] getLogs: ${(tGetLogsEnd - tGetLogs).toFixed(2)} ms`);

  // Build table data item using the fetched logs data
  const tBuildTableDataItem = performance.now();
  const tableDataItem = await buildTableDataItem(tile, fields, logsData, projectId, logsActions, previousLogs);
  const tBuildTableDataItemEnd = performance.now();
  console.log(`[perf] buildTableDataItem: ${(tBuildTableDataItemEnd - tBuildTableDataItem).toFixed(2)} ms`);

  return tableDataItem;
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

/**
 * Helper function to identify new cells in the table
 */
export function getNewCells(previousLogs: LogProps[] | GroupedLogProps[], logs: LogProps[] | GroupedLogProps[]) {
  let newCells: string[] = [];
    const flattenedLogs = maybeFlattenGroupedLogs(logs);
    if (flattenedLogs.length) {
        const flattenedTableLogs = maybeFlattenGroupedLogs(previousLogs)
        const previousCells = flattenedTableLogs.flatMap(log => {
            const entryCells = Object.keys(log.entries as LogItemProps).map(key => `${log.id}_${key}`);
            const paramCells = Object.keys(log.params as LogItemProps).map(key => `${log.id}_${key}`);
            return entryCells.concat(paramCells);
        });
        newCells = flattenedLogs.flatMap(log => {
            const entryCells = Object.keys(log.entries as LogItemProps).map(key => `${log.id}_${key}`);
            const paramCells = Object.keys(log.params as LogItemProps).map(key => `${log.id}_${key}`);
            return entryCells.concat(paramCells);
        });
        newCells = newCells.filter(id => !previousCells.includes(id));
    }
    return newCells;
}