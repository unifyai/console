import { LogFieldsResponseProps, LogsResponseProps } from "../../types/evals/logs";

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
    if (!sorting)
      logs = logs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

    let [paramsProperties, entriesProperties] = [
      Object.entries(fields).filter(entry => entry[1].param === true).map(entry => entry[0]),
      Object.entries(fields).filter(entry => entry[1].param === false).map(entry => entry[0])
    ]
    if (context){
      [paramsProperties, entriesProperties] = [
        paramsProperties.map(property => property.replace(context, "")),
        entriesProperties.map(property => property.replace(context, ""))
      ]
    }

    return { entriesProperties, paramsProperties, logs, params };
}

/* 
  Using the context argument of getLogs to update logs without refreshing the page.
  Note: The URLParam version should be used with URL-based state management and the 
        standard version should be used with the state management used with the 
        composable interfaces UI
*/
export const inplaceRefreshUsingContextURLParam = (context : string | null, setContext: (context: string | null) => void) => {
  if (context === null)
      setContext("")
  else if (context === "")
      setContext(null)
  else if (context[-1] === "/")
      setContext(context.slice(0, -1))
  else 
      setContext(context + "/")
}

export const inplaceRefreshUsingContext = (context : string | undefined, setContext: (context: string | undefined) => void) => {
  if (context === undefined)
      setContext("")
  else if (context === "")
      setContext(undefined)
  else if (context[-1] === "/")
      setContext(context.slice(0, -1))
  else 
      setContext(context + "/")
}
