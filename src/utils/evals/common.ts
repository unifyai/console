import { TableArguments, LogFieldsProps, LogFieldsResponseProps, LogsResponseProps } from "../../types/evals/logs";

import _ from "lodash";
import { formatNumber } from "../formatNumber";
import { processContext } from "./columnOperations";
import { TileProps } from "@/types/evals/grid";
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
export function extractLogsData(logsResponse: LogsResponseProps, fields: LogFieldsResponseProps, context: string | null, sorting: string | null) {

  const params = logsResponse.params;
  let logs = logsResponse.logs;
  logs = logs.map(log => ({ id: log.id, ts: log.ts, params: log.params, derived_entries: {}, entries: { ...log.entries, ...log.derived_entries } })) // Bundle derived entries with entries
  let [paramsProperties, entriesProperties] = [
    Object.entries(fields).filter(entry => entry[1].field_type === "param").map(entry => entry[0]),
    Object.entries(fields).filter(entry => entry[1].field_type != "param").map(entry => entry[0])
  ]
  if (context) {
    [paramsProperties, entriesProperties] = [
      paramsProperties.filter(property => property.includes(context)).map(property => processContext("split", context, property)),
      entriesProperties.filter(property => property.includes(context)).map(property => processContext("split", context, property))
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
  logsActions: {
    get: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number, _timestamp: string | null) => Promise<LogsResponseProps>,
    getLatest: (project: string, context: string | null, filterExpression: string | null, sortingExpression: string | null, from_fields: string | null, limit: number | null, offset: number) => Promise<string>,
    getMetrics: (
      project: string, filterExpression: string | null, metricName: string, keyName: string
    ) => Promise<number>,
    delete: (ids_and_fields: LogFieldsProps) => Promise<ResponseProps>,
    derive: (project: string, key: string, equation: string, referenced_logs: TableArguments) => Promise<ResponseProps>
  }
) => {
  // Unpack log data
  const { entriesProperties, paramsProperties, logs, params } = extractLogsData(
    logsData, fields, context, sorting
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
