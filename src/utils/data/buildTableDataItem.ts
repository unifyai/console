import { TableBoundaries, TableDataItem, TableMetrics, TileData } from "@/types/evals/grid";
import { GroupedLogProps, LogFieldsResponseProps, LogItemProps, LogProps, LogsResponseProps } from "@/types/evals/logs";
import { buildFilterExpression } from "@/utils/evals/filters";
import { getColumnMetrics, extractLogsData } from "@/utils/evals/common";
import { LogsActions } from "@/types/evals/grid";
import { processContext } from "@/utils/evals/columnOperations";
import { maybeFlattenGroupedLogs } from "../evals/grouping";
import { QueryClient } from "@tanstack/react-query";

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
 * Triggers metrics fetching in the background without blocking
 */
export async function buildTableMetricsQuery(
  projectId: string,
  tile: TileData,
  context: string | null,
  columnContext: string | null,
  columns: string[],
  filterExpression: string | null,
  metric: string,
  logsActions: LogsActions,
  queryClient: QueryClient,
) {
    // Set the query data in the background
    queryClient.fetchQuery({
      queryKey: ["tableMetrics", tile.id, tile.tab_id],
      queryFn: async () => {
        const tStart = performance.now();
        const result = await getColumnMetrics(
          projectId, context, columnContext, columns, filterExpression, null, metric, logsActions
        ) as TableMetrics;
        const tEnd = performance.now();
        perfLog(`[perf] background metrics fetch: ${(tEnd - tStart).toFixed(2)}ms`);
        return result;
      },
      staleTime: 5 * 60 * 1000,
    }).catch((error: unknown) => {
      console.error("Background metrics fetch failed:", error);
    });
}

/**
 * Triggers boundaries (min/max) fetching in the background without blocking
 */
export async function buildTableBoundariesQuery(
  projectId: string,
  tile: TileData,
  context: string | null,
  columnContext: string | null,
  columns: string[],
  logsActions: LogsActions,
  queryClient: QueryClient,
) {
    // Set the query data in the background
    queryClient.fetchQuery({
      queryKey: ["tableBoundaries", tile.id, tile.tab_id],
      queryFn: async () => {
        const tStart = performance.now();
        const [minimums, maximums] = await Promise.all([
          getColumnMetrics(
            projectId, context, columnContext, columns, null, null, "min", logsActions
          ) as Promise<TableMetrics>,
          getColumnMetrics(
            projectId, context, columnContext, columns, null, null, "max", logsActions
          ) as Promise<TableMetrics>
        ]);
        const tEnd = performance.now();
        perfLog(`[perf] background boundaries fetch: ${(tEnd - tStart).toFixed(2)}ms`);
        return { minimums, maximums } as TableBoundaries;
      },
      staleTime: 5 * 60 * 1000,
    }).catch((error: unknown) => {
      console.error("Background boundaries fetch failed:", error);
    });
}

/**
 * Builds a TableDataItem from logs data and other inputs
 * Can be used directly in client components instead of passing through a server component
 * Now optimized to load main table data fast while triggering metrics/boundaries in background
 */
export async function buildTableDataItem(
  tile: TileData,
  fields: LogFieldsResponseProps,
  logsData: LogsResponseProps,
  projectId: string,
  logsActions: LogsActions,
  queryClient: QueryClient,
  previousLogs?: LogProps[] | GroupedLogProps[]
): Promise<TableDataItem> {
  // // Build filter expression
  // const filterExpression = buildFilterExpression(
  //   tile.filters,
  //   tile.common_filter,
  //   tile.column_context,
  //   tile.freeze,
  //   fields
  // );

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

  // Get logs details WITHOUT metrics and boundaries for faster loading
  const textractLogsData = performance.now();
  const { entriesProperties, paramsProperties, logs, params } = extractLogsData(
    logsData,
    fields,
    tile.column_context || null,
    tile.table_tile?.sorting || null,
    tile.table_tile?.hidden_columns
  );
  const textractLogsDataExtract = performance.now();
  perfLog(`[perf] extractLogsData: ${(textractLogsDataExtract - textractLogsData).toFixed(2)} ms`);

  // Trigger background queries for metrics and boundaries if we have the necessary dependencies
  const columns = logs.length ? [...entriesProperties, ...paramsProperties] : [];
  if (columns.length > 0) {
    // // Don't await these - let them run in background
    // buildTableMetricsQuery(
    //   projectId,
    //   tile,
    //   tile.context || null,
    //   tile.column_context || null,
    //   columns,
    //   filterExpression,
    //   tile.metric ?? "mean",
    //   logsActions,
    //   queryClient,
    // );

    buildTableBoundariesQuery(
      projectId,
      tile,
      tile.context || null,
      tile.column_context || null,
      columns,
      logsActions,
      queryClient,
    );
  }

  const limit = 20; // Default page size

  let newCells: string[] = [];
  if (previousLogs) {
    newCells = getNewCells(previousLogs, logs);
  }

  // Construct table data item (without metrics and boundaries for now)
  const tableDataItem: TableDataItem = {
    columnContexts: columnContexts,
    fields,
    logsData,
    totalPages: Math.ceil(logsData.count / limit),
    entriesProperties,
    paramsProperties,
    logs,
    params,
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
  queryClient: QueryClient,
  previousLogs?: LogProps[] | GroupedLogProps[],
  signal?: AbortSignal
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
    null, 
    signal
  );
  const tGetLogsEnd = performance.now();
  perfLog(`[perf] getLogs: ${(tGetLogsEnd - tGetLogs).toFixed(2)} ms`);

  // Build table data item using the fetched logs data
  const tBuildTableDataItem = performance.now();
  const tableDataItem = await buildTableDataItem(tile, fields, logsData, projectId, logsActions, queryClient, previousLogs);
  const tBuildTableDataItemEnd = performance.now();
  perfLog(`[perf] buildTableDataItem: ${(tBuildTableDataItemEnd - tBuildTableDataItem).toFixed(2)} ms`);

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