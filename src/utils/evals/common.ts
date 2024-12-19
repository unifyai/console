import { LogColumnsProps, LogsResponseProps } from "../../types/evals/logs";

import _ from "lodash";
import { formatNumber } from "../formatNumber";

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
export function computeStatistic(statistic: string, data: number[]): number | string {
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
      return data.length;
    case "sum":
      return _.sum(data);
    case "min":
      return Math.min(...data);
    case "max":
      return Math.max(...data);
    case "median": {
      const sortedArray = data.slice().sort((a: number, b: number) => a - b);
      const middleIndex = Math.floor(sortedArray.length / 2);
      return sortedArray.length % 2 === 0
        ? (sortedArray[middleIndex - 1] + sortedArray[middleIndex]) / 2
        : sortedArray[middleIndex];
    }
    case "mode": {
      const counts: { [key: number]: number } = data.reduce((a: { [key: number]: number }, b) => (a[b] = (a[b] || 0) + 1, a), {});
      const maxCount = Math.max(...Object.values(counts));
      const modes = Object.keys(counts).filter(k => counts[+k] === maxCount);
      return modes.length > 1 ? modes.join(", ") : modes[0];
    }
    default:
      throw new Error(`Unsupported statistic: ${statistic}`);
  }
}

/* 
    Sort logs by timestamp and separate logs from parameters.
*/
export function extractLogsData(logsResponse: LogsResponseProps, logColumns: LogColumnsProps) {
  
    const params = logsResponse.params;
    const rawLogs = logsResponse.logs;
    const logs = rawLogs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    const entriesProperties = (
      logs.length
        ? Array.from(new Set(rawLogs.flatMap((log) => Object.keys(log.entries))))
        : "entries" in logColumns
        ? Object.keys(logColumns.entries)
        : []
    );
    const paramsProperties = (
      logs.length
        ? Array.from(new Set(rawLogs.flatMap((log) => Object.keys(log.params!))))
        : "params" in logColumns
          ? Object.keys(logColumns.params)
          : []
    );
  
    return { entriesProperties, paramsProperties, logs, params };
}
