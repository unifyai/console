import { getLogsParameters, TableArguments, LogFieldsProps, LogFieldsResponseProps, LogsResponseProps, GroupedLogProps, LogProps, GroupedLogPropsRaw } from "../../types/evals/logs";

import _ from "lodash";
import { formatNumber } from "../formatNumber";
import { processContext, sanitizeId } from "./columnOperations";
import { LogsActions, TileProps } from "@/types/evals/grid";
import { ResponseProps } from "@/types/common";
import { Row } from "@tanstack/react-table";

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
export function extractLogsData(logsResponse: LogsResponseProps, fields: LogFieldsResponseProps, context: string | null, sorting: string | null, hiddenColumns: string | undefined) {
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
        : maybeConvertRawToGroupedLogs(rawLogs, [], null);  // Pass empty array for groupBy when no grouping is active

    let [paramsProperties, entriesProperties] = [
      Object.entries(fields).filter(entry => entry[1].field_type === "param").map(entry => entry[0]),
      Object.entries(fields).filter(entry => entry[1].field_type != "param").map(entry => entry[0])
    ]
    if (context){
      [paramsProperties, entriesProperties] = [
        paramsProperties.filter(property => property.includes(context)).map(property => processContext("split", context, property)),
        entriesProperties.filter(property => property.includes(context)).map(property => processContext("split", context, property))
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

export const getLogsDetails = async (
  item: TileProps,
  logsData: LogsResponseProps,
  fields: LogFieldsResponseProps,
  context: string | null,
  project: string | null,
  filterExpression: string | null,
  sorting: string | null,
  hiddenColumns: string | undefined,
  logsActions: LogsActions
) => {
  // Unpack log data
  const { entriesProperties, paramsProperties, logs, params } = extractLogsData(
    logsData, fields, context, sorting, hiddenColumns
  );

  /* Handle column metrics */
  // Getting metrics for filtered logs, and min / max values for full logs.
  // Min / max bounds are used to set the filtering range for numeric columns
  const columns = logs.length ? [...entriesProperties, ...paramsProperties] : [];
  const getColumnMetrics = async (expression: string | null, metric: string | undefined) => {
    let fullColumns = columns
    if (context)
      fullColumns = fullColumns.map(column => processContext("merge", context, column))
    const metricValues = await Promise.all(
      fullColumns.map(async (key) => {
        try {
          const result = await logsActions.getMetrics(
            project!,
            expression,
            metric ? metric : "mean",
            key
          );
          return result;
        } catch (error) {
          console.error(`Error fetching metric for key ${key}`);
          return "";
        }
      })
    );
    const metrics_: { [key: string]: any } = columns.length
      ? columns
        .map((key, index) => ({ [key]: metricValues[index] }))
        .reduce((acc, curr) => ({ ...acc, ...curr }))
      : {};
    return metrics_
  }
  const [metrics, minimums, maximums] = await Promise.all([
    getColumnMetrics(filterExpression, item.metric),
    getColumnMetrics(null, "min"),
    getColumnMetrics(null, "max")
  ]);

  // Min-max boundaries for numeric and time-like column filters
  const boundaries = { minimums, maximums }

  return {
    entriesProperties,
    paramsProperties,
    logs,
    params,
    metrics,
    boundaries
  }
}

/*
  Utility functions to check grouping types
*/
function isEntriesGroup(groupingColumnId: string): boolean {
  return groupingColumnId.startsWith("Entries");
}

function isParamsGroup(groupingColumnId: string): boolean {
  return groupingColumnId.startsWith("Parameters");
}

/*
  Convert a GroupedLogPropsRaw object into an array of GroupedLogProps. This is needed for the 
  table to render manually grouped logs.

  Each top-level key in `raw` is treated as a "grouping column."
  The value under that key is an object whose keys are grouping values
  (like "0", "1", "hello"), each mapping either to:
    - an array of final logs (LogProps[]), or
    - a deeper grouping object (another GroupedLogPropsRaw).

  If there's only one grouping column, you'll get a single GroupedLogProps
  in the returned array. If there are multiple grouping columns at the 
  top level, you'll get multiple siblings in the array.
*/
export function maybeConvertRawToGroupedLogs(
    raw: GroupedLogPropsRaw | LogProps[],
    groupBy: string[],
    parentId: string | null = null
): GroupedLogProps[] | LogProps[] {

    // If raw is an array of LogProps (no more grouping needed), return it with type "ungrouped"
    if (Array.isArray(raw)) {
        return raw.map(log => ({
            ...log,
            type: "ungrouped",
        }));
    }

    // Find the first grouping column in the raw data
    const groupingColumnId = Object.keys(raw).find(key => 
        key !== 'group_count' && key !== 'count'
    );

    if (!groupingColumnId) {
        return [];
    }

    const groupValues = raw[groupingColumnId] as { [groupValue: string]: number };

    let groupingIndex = 0;

    return Object.entries(groupValues)
        .filter(([value]) => value !== 'group_count' && value !== 'count')
        .map(([groupValue, count]) => {
            let id = `${groupingColumnId}:${groupValue}`;
            if (parentId)
              id = `${parentId}>${id}`;
            const remainingGroupBy = groupBy.slice(1);
            const isEntries = isEntriesGroup(groupingColumnId);
            const isParams = isParamsGroup(groupingColumnId);
            
            // Assign groupingIndex for entries/params groups
            const currentGroupingIndex = (isEntries || isParams) ? groupingIndex++ : undefined;

            const groupNode = {
                type: "grouped",
                id,
                groupingColumnId,
                groupingIndex: currentGroupingIndex,
                [groupingColumnId]: groupValue,
                subRows: [],  // Initially empty, will be populated when expanded
                isPopulated: false,
                groupCount: count,
                remainingGroupBy
            } as GroupedLogProps;

            return groupNode;
        });
}

/*
  Efficiently updates the subRows of a specific group in a nested grouping structure with new data.

 @param existingLogs - The current nested group structure (GroupedLogProps[])
 @param newLogs - The newly fetched group data to insert as subRows
 @param groupFilters - Array of [column, value] pairs identifying the target group
                        (e.g., [["gender", "female"]] to identify the "female" gender group)
 @returns Updated group structure with the new subRows inserted at the correct location
*/
export function updateGroupedSubRows(
  existingLogs: GroupedLogProps[],
  newLogs: GroupedLogProps[] | LogProps[],
  groupFilters: [string, string][]
): GroupedLogProps[] {
  /*
    Recursive function to find and update the target group without deep cloning the entire structure.
    It immutably updates only the affected nodes.
   
    @param logs - Current level of grouped logs
    @param filters - Remaining filters to identify the nested group
    @returns Updated logs with modifications applied
  */
  function findAndReplaceSubRows(
    logs: GroupedLogProps[],
    filters: [string, string][]
  ): GroupedLogProps[] {
    if (filters.length === 0) return logs;

    let [currentColumn, currentValue] = filters[0];

    if (currentValue.startsWith('"') && currentValue.endsWith('"')) {
      // Trim the outer quotes if they exist
      currentValue = currentValue.slice(1, -1);
    }

    return logs.map((log) => {
      // Check if this log matches the current filter condition
      if (sanitizeId(log.groupingColumnId) === currentColumn && log[log.groupingColumnId] === currentValue) {
        if (filters.length === 1) {
          // Target group found - immutably update subRows if not already populated
          if (!log.isPopulated) {
            return {
              ...log,
              subRows: Array.isArray(newLogs) && newLogs.length > 0 && newLogs[0].type === "ungrouped" 
                ? (newLogs as LogProps[]) // 🆕 Handle case when newLogs are LogProps[]
                : (newLogs as GroupedLogProps[]), // Existing behavior for GroupedLogProps[]
              isPopulated: true
            };
          }
        } else if (Array.isArray(log.subRows)) {
          // Recursively update subRows for deeper levels
          return {
            ...log,
            subRows: findAndReplaceSubRows(log.subRows as GroupedLogProps[], filters.slice(1))
          };
        }
      }
      return log; // Return unchanged if not matched
    });
  }

  return findAndReplaceSubRows(existingLogs, groupFilters);
}

/*
  Type guards to distinguish between LogProps and GroupedLogProps using the type field.
*/
function isLogProps(item: LogProps | GroupedLogProps): item is LogProps {
  return item.type === "ungrouped";
}

function isGroupedLogProps(item: LogProps | GroupedLogProps): item is GroupedLogProps {
  return item.type === "grouped";
}

/*
  Takes an array that could be either LogProps[] or GroupedLogProps[] and returns LogProps[].
  If the input is already LogProps[], returns it as is.
  If it's GroupedLogProps[], flattens it recursively into LogProps[].
*/
export function maybeFlattenGroupedLogs(
  items: LogProps[] | GroupedLogProps[]
): LogProps[] {
  const flattened: LogProps[] = [];

  for (const item of items) {
    if (isLogProps(item)) {
      // Item is a LogProps; add it directly.
      flattened.push(item);
    } else if (isGroupedLogProps(item)) {
      // Item is a GroupedLogProps; recursively flatten its subRows if they have been populated.
      if (item.isPopulated) {
        flattened.push(...maybeFlattenGroupedLogs(item.subRows));
      }
    } else {
      // The item did not match any expected type.
      console.warn('Encountered an item that is neither LogProps nor GroupedLogProps:', item);
    }
  }
  return flattened;
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
