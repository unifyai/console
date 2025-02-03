import { getLogsParameters, TableArguments, LogFieldsProps, LogFieldsResponseProps, LogsResponseProps, GroupedLogProps, LogProps, GroupedLogPropsRaw } from "../../types/evals/logs";

import _ from "lodash";
import { formatNumber } from "../formatNumber";
import { processContext } from "./columnOperations";
import { LogsActions, TileProps } from "@/types/evals/grid";
import { ResponseProps } from "@/types/common";

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
        : convertRawToGroupedLogs(rawLogs);

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
export function convertRawToGroupedLogs(raw: GroupedLogPropsRaw, parentId: string | null = null): GroupedLogProps[] {  
  // We ignore numeric metadata like "count" or "group_count" at this level
  const topLevelGroupingColumns = Object.keys(raw).filter(
    (k) => typeof raw[k] === "object" && !Array.isArray(raw[k]) && raw[k] !== null
  );

  // There will always be exactly one top-level grouping column (e.g. "Traffic/student/gender")
  const groupingColumnId = topLevelGroupingColumns[0];
  const groupingObj = raw[groupingColumnId] as GroupedLogPropsRaw;
  
  // Get all values for this grouping column (e.g. "male", "female"), excluding metadata
  const groupValues = Object.keys(groupingObj).filter(
    (k) => k !== "count" && k !== "group_count"
  );

  // Build an array of GroupedLogProps for each distinct grouping value
  // If this is an entries group, we'll assign ascending indices
  const isEntriesGrouping = isEntriesGroup(groupingColumnId);
  let currentIndex = 1; // Start index from 1

  return groupValues.map((groupingValue) => {
    // Generate the ID for this group - matching TanStack's format
    let id = `${groupingColumnId}:${groupingValue}`;
    id = parentId ? `${parentId}>${id}` : id;

    const child = groupingObj[groupingValue];
    if (Array.isArray(child)) {
      // child is final logs => produce a grouping node with subRows = these logs
      return {
        type: "grouped",
        id,
        groupingColumnId,
        index: isEntriesGrouping ? currentIndex++ : undefined,
        [groupingColumnId]: groupingValue,
        subRows: child.map(log => ({
          ...log,
          type: "ungrouped",
        }))
      } as GroupedLogProps;
    } else if (typeof child === "object" && child !== null) {
      // child is another nested RawGroupingLevel => recurse
      const nested = convertRawToGroupedLogs(child, id);
      return {
        type: "grouped",
        id,
        groupingColumnId,
        groupingIndex: isEntriesGrouping ? currentIndex++ : undefined,
        [groupingColumnId]: groupingValue,
        subRows: nested.map(row => ({
          ...row,
        }))
      } as GroupedLogProps;
    } else {
      // child might be a number or undefined (like "count", "group_count") => skip or make an empty group
      return {
        type: "grouped",
        id,
        groupingColumnId,
        groupingIndex: isEntriesGrouping ? currentIndex++ : undefined,
        [groupingColumnId]: groupingValue,
        subRows: []
      } as GroupedLogProps;
    }
  });
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
      // Item is a GroupedLogProps; recursively flatten its subRows.
      flattened.push(...maybeFlattenGroupedLogs(item.subRows));
    } else {
      // The item did not match any expected type.
      console.warn('Encountered an item that is neither LogProps nor GroupedLogProps:', item);
    }
  }
  return flattened;
}
