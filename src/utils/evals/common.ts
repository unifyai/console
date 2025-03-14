import { LogsResponseProps, GroupedLogProps, LogProps, LogFieldsResponseProps, GroupedLogPropsRaw } from "../../types/evals/logs";

import _ from "lodash";
import { formatNumber } from "../formatNumber";
import { processContext } from "./columnOperations";
import { LogsActions, TileProps } from "@/types/evals/grid";
import { Row } from "@tanstack/react-table";
import { getGroupingFilters, maybeConvertRawToGroupedLogs } from "./grouping";
import { TreeNode } from "@/types/common";

/* 
    Convert object / string inputs to their length value and return the value of numeric inputs. 
*/
export function toComputableValue(value: any) {
  const type = typeof value;
  switch (type) {
    case "number":
      return value;
    case "string":
      return value.length;
    case "boolean":
      return Number(value);
    case "object":
      if (value === null)
        return 0;
      else if (Array.isArray(value))
        return value.length
      else if (value instanceof Date)
        return value.getTime()
      else
        return Object.keys(value).length;
    default:
      0;
  }
}

/* 
    Compute reduction metrics from an array of numbers.
*/
export function computeStatistic(statistic: string, data: number[]): string {
  switch (statistic) {
    case "mean":
      return formatNumber(_.mean(data));
    case "var": {
      const variance = data.reduce((sum, value, index, array) => sum + Math.pow(value - array.reduce((sum, value) => sum + value, 0) / array.length, 2), 0) / data.length;
      return formatNumber(variance);
    }
    case "std": {
      const squaredDiffs = data.reduce((sum, value, index, array) => sum + Math.pow(value - array.reduce((sum, value) => sum + value, 0) / array.length, 2), 0) / data.length;
      const std = Math.sqrt(squaredDiffs);
      return formatNumber(std);
    }
    case "count":
      return formatNumber(data.length);
    case "sum":
      return formatNumber(_.sum(data));
    case "min":
      return formatNumber(Math.min(...data));
    case "max":
      return formatNumber(Math.max(...data));
    case "median": {
      const sortedArray = data.slice().sort((a: number, b: number) => a - b);
      const middleIndex = Math.floor(sortedArray.length / 2);
      const median = sortedArray.length % 2 === 0
        ? (sortedArray[middleIndex - 1] + sortedArray[middleIndex]) / 2
        : sortedArray[middleIndex];
      return formatNumber(median)
    }
    case "mode": {
      const counts: { [key: number]: number } = data.reduce((a: { [key: number]: number }, b) => (a[b] = (a[b] || 0) + 1, a), {});
      const maxCount = Math.max(...Object.values(counts));
      const modes = Object.keys(counts).filter(k => counts[+k] === maxCount).map(value => parseFloat(value));
      return modes.map((mode) => formatNumber(mode)).join(",");
    }
    default:
      throw new Error(`Unsupported statistic: ${statistic}`);
  }
}

/* 
  Extract logs, parameters, and their respective keys, accounting for context and sorting preferences.
*/
export function extractLogsData(logsResponse: LogsResponseProps, fields: LogFieldsResponseProps, column_context: string | null, sorting: string | null, hiddenColumns: string | undefined) {
    const params = logsResponse.params;
    const rawLogs = logsResponse.logs;

    // If logs is an array (non-grouped case), process it directly
    // If it's GroupedLogPropsRaw (grouped case), convert it first
    const logs = Array.isArray(rawLogs) 
        ? rawLogs.map(log => ({
            type: "ungrouped",
            id: log.id, 
            ts: log.ts, 
            params: log.params, 
            derived_entries: {}, 
            entries: {...log.entries, ...log.derived_entries},  // Bundle derived entries with entries
            clipped_fields: log.clipped_fields,
          }))
        : maybeConvertRawToGroupedLogs(params, rawLogs, null);

    let [paramsProperties, entriesProperties] = [
      Object.entries(fields).filter(entry => entry[1].field_type === "param").map(entry => entry[0]),
      Object.entries(fields).filter(entry => entry[1].field_type != "param").map(entry => entry[0])
    ]
    if (column_context){
      [paramsProperties, entriesProperties] = [
        paramsProperties.filter(property => property.includes(column_context)).map(property => processContext("split", column_context, property)),
        entriesProperties.filter(property => property.includes(column_context)).map(property => processContext("split", column_context, property))
      ]
    }
    if (hiddenColumns) {
      const hidden = hiddenColumns.split(",");
      [paramsProperties, entriesProperties] = [
        paramsProperties.filter(property => !hidden.includes(property)),
        entriesProperties.filter(property => !hidden.includes(property))
      ]
    }

  return { entriesProperties, paramsProperties, logs, params };
}

export const getColumnMetrics = async (
  project: string | null,
  context: string | null,
  column_context: string | null,
  columns: string[],
  filterExpression: string | null,
  groupingExpression: string | null,
  metric: string | undefined,
  logsActions: LogsActions
) => {
  let fullColumns = columns
  if (column_context)
    fullColumns = fullColumns.map(column => processContext("merge", column_context, column))
  return await logsActions.getMetrics(
    project!, context!, filterExpression, groupingExpression, metric ? metric : "mean", fullColumns
  );
}

export const getLogsDetails = async (
  item: TileProps,
  logsData: LogsResponseProps,
  fields: LogFieldsResponseProps,
  context: string | null,
  column_context: string | null,
  project: string | null,
  filterExpression: string | null,
  groupingExpression: string | null,
  metric: string | undefined,
  sorting: string | null,
  hiddenColumns: string | undefined,
  logsActions: LogsActions
) => {
  // Unpack log data
  const { entriesProperties, paramsProperties, logs, params } = extractLogsData(
    logsData, fields, column_context, sorting, hiddenColumns
  );

  const columns = logs.length ? [...entriesProperties, ...paramsProperties] : [];

  let groupedMetrics: { [key: string]: { [key: string]: { [key: string]: { [key: string]: number | string } } } } = {};
  if (groupingExpression) {
    const numericColumns = columns.filter(col => ["int", "float", "timestamp", "time", "date", "timedelta", "bool"].includes(fields?.[col]?.data_type));
    const groupingColumnId = (groupingExpression as string).split(",")[0];
    const metric_ = metric ?? "mean";
    const metricsData = await getColumnMetrics(
      project, context, column_context, numericColumns, filterExpression, groupingColumnId, metric_, logsActions
    ) as { [key: string]: { [key: string]: { [key: string]: number | string }}};
    const metrics = Object.fromEntries(
      Object.entries(metricsData).map(
        ([col, groups]) => [col, Object.fromEntries(Object.entries(groups).map(
          ([groupingValue, results]) => [groupingValue, results[metric_]]
        ))]
    ));
    const sharedValues = Object.fromEntries(
      Object.entries(metricsData).map(
        ([col, groups]) => [col, Object.fromEntries(Object.entries(groups).map(
          ([groupingValue, results]) => [groupingValue, results["shared_value"]]
        ))]
    ));
    groupedMetrics[groupingColumnId] = {
      [metric_]: metrics,
      shared_value: sharedValues
    };
  }

  /* Handle column metrics */
  // Getting metrics for filtered logs, and min / max values for full logs.
  // Min / max bounds are used to set the filtering range for numeric columns
  const [metrics, minimums, maximums] = await Promise.all([
    getColumnMetrics(
      project, context, column_context, columns, filterExpression, null, item.metric, logsActions
    ) as Promise<{ [key: string]: number }>,
    getColumnMetrics(
      project, context, column_context, columns, null, null, "min", logsActions
    ) as Promise<{ [key: string]: number }>,
    getColumnMetrics(
      project, context, column_context, columns, null, null, "max", logsActions
    ) as Promise<{ [key: string]: number }>
  ]);

  // Min-max boundaries for numeric and time-like column filters
  const boundaries = { minimums, maximums }

  return {
    entriesProperties,
    paramsProperties,
    logs,
    params,
    metrics,
    groupedMetrics,
    boundaries
  }
}

/*
  Extracts leaf rows (LogProps) from a given row, handling multi-level grouping.

  row: The parent row which may contain nested subRows.
  returns An array of LogProps representing the leaf rows.
*/
export function getLeafRows(row: Row<GroupedLogProps | LogProps>): Row<LogProps>[] {
  const result: Row<LogProps>[] = [];

  function traverse(currentRow: Row<GroupedLogProps | LogProps>) {
    const { type } = currentRow.original;

    // If it's a grouped row
    if (type === "grouped") {
      const groupedRow = currentRow as Row<GroupedLogProps>;

      // Check if the grouped row is populated
      if (!groupedRow.original.isPopulated) {
        // Skip traversal for unpopulated rows
        return;
      }

      // Recursively traverse each subRow
      for (const subRow of groupedRow.subRows) {
        traverse(subRow as Row<GroupedLogProps | LogProps>);
      }
    } else {
      // It's a leaf node (LogProps), add to the result
      result.push(currentRow as Row<LogProps>);
    }
  }

  traverse(row);
  return result;
}

export const buildNestedDropdownTree = (paths: string[]) => {
  const root: TreeNode = { path: '', children: {}, isComplete: false };

  paths.forEach(path => {
      let current = root;
      const parts = path.split('/').filter(Boolean);

      let currentPath = '';
      parts.forEach((part, index) => {
          currentPath += part + '/';
          if (!current.children[part]) {
              current.children[part] = {
                  path: currentPath,
                  children: {},
                  isComplete: index === parts.length - 1
              };
          }
          current = current.children[part];
      });
  });

  return root;
};
