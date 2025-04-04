import { GroupedMetrics, GroupedMetricNode, GroupedMetricLeaf, LogItemProps, LogsResponseProps, GroupedLogProps, LogProps, LogFieldsResponseProps } from "../../types/evals/logs";
import _ from "lodash";
import { formatNumber } from "../formatNumber";
import { processContext } from "./columnOperations";
import { LogsActions, TileProps } from "@/types/evals/grid";
import { Row } from "@tanstack/react-table";
import { maybeConvertRawToGroupedLogs } from "./grouping";
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
    boundaries
  }
}

export const getGroupedMetrics = async (
  project: string | null,
  context: string | null,
  column_context: string | null,
  columns: string[],
  filterExpression: string | null,
  groupingExpression: string | null,
  metric: string | undefined,
  fields: LogFieldsResponseProps,
  logsActions: LogsActions
) => {
  let groupedMetrics: { [key: string]: { [key: string]: { [key: string]: { [key: string]: number | string } } } } = {};
  if (groupingExpression) {
    const numericColumns = columns.filter(col => ["int", "float", "timestamp", "time", "date", "timedelta", "bool"].includes(fields?.[col]?.data_type));
    const groupingColumnId = (groupingExpression as string).split(",")[0];
    const metric_ = metric ?? "mean";
    const metricsData = await getColumnMetrics(
      project, context, column_context, columns, filterExpression, groupingColumnId, metric_, logsActions
    ) as { [key: string]: { [key: string]: { [key: string]: number | string }}};
    const metrics = Object.fromEntries(
      Object.entries(metricsData).filter(([col, _]) => numericColumns.includes(col)).map(
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
  return groupedMetrics;
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


/**
 * Replaces parameter indices within log entries with their corresponding actual values
 * from a central parameter map.
 *
 * @param {LogsResponseProps} data - The input log response object from get_logs.
 * @returns {LogsResponseProps} The modified `data` object. The `logs` array within
 *   this object will contain log entries where the `params` object now holds the actual
 *   resolved values instead of indices.
 *   If the initial `data.logs` or `data.params` is empty (or evaluates to empty via
 *   Object.entries), the original `data` object is returned unmodified.
 */
export const replaceParamsIndicesWithValues = (data: LogsResponseProps) => {
  const params = data.params
  const logs = data.logs as LogProps[]
  if (!Object.entries(logs).length || !Object.entries(params).length) return data;
  data.logs = logs.map(log => {
      const logParams: LogItemProps = {};
      Object.entries(log.params).map(([key, value]) => logParams[key] = params[key][value]);
      return {...log, params: logParams}
  })
  return data
}


/**
 * Helper function to retrieve nested metric data from grouped metrics for a given combination of grouping.
 */
const getGroupedMetricNode = (
    columnData: GroupedMetricNode | undefined,
    groupKeys: string[],
    metric:string,
    combination: { [key: string]: string }
): GroupedMetricLeaf | undefined => {
    let currentLevel: GroupedMetricNode | GroupedMetricLeaf | undefined = columnData;
    for (const key of groupKeys) {
        const value = combination[key];
        // Check if currentLevel is an object and has the key before descending
        if (typeof currentLevel !== 'object' || currentLevel === null || !(value in currentLevel)) {
            return undefined; // Path does not exist for this combination
        }
        currentLevel = (currentLevel as GroupedMetricNode)[value];
    }
    // After iterating through all group keys, currentLevel should be the GroupedMetricLeaf object
    // Add a check to ensure it looks like metric data (e.g., has [metric], or 'shared_value')
    if (typeof currentLevel === 'object' && currentLevel !== null && !Array.isArray(currentLevel)) {
        // A simple check - could be more robust based on expected metric names
         const keys = Object.keys(currentLevel);
         if (keys.length > 0 && (keys.includes('shared_value') || keys.includes(metric))) {
            return currentLevel as GroupedMetricLeaf;
         }
    }
    return undefined; // Did not find a valid metric object at the end of the path
};

/**
 * Helper function to recursively find all unique group value combinations.
 */
const findGroupCombinations = (
    levelData: GroupedMetricNode | GroupedMetricLeaf | undefined,
    groupKeys: string[],
    metric: string,
    currentCombination: { [key: string]: string } = {}
): { [key: string]: string }[] => {
    if (groupKeys.length === 0) {
        // Base case: we've processed all group keys for this path.
        // Return the combination found. We assume the caller provides data
        // that has reached the level *just before* the metric values.
        return [currentCombination];
    }

    if (typeof levelData !== 'object' || levelData === null) {
        // Not an object, cannot descend further along this path
        return [];
    }

    const currentGroupKey = groupKeys[0];
    const remainingGroupKeys = groupKeys.slice(1);
    const combinations: { [key: string]: string }[] = [];

    Object.keys(levelData).forEach(groupValue => {
        // Avoid recursing into the actual metric values (like 'mean', 'count')
        const nextLevelData = levelData[groupValue];
        if (typeof nextLevelData === 'object' && nextLevelData !== null) {
             // Check if it looks like the next level of grouping or the final metric values
             const looksLikeGroupedMetricLeaf = remainingGroupKeys.length === 0 && (typeof nextLevelData['shared_value'] !== 'undefined' || typeof nextLevelData[metric] !== 'undefined'); // Add other common metrics

             if (!looksLikeGroupedMetricLeaf || remainingGroupKeys.length > 0) {
                const nextCombination = { ...currentCombination, [currentGroupKey]: groupValue };
                const deeperCombinations = findGroupCombinations(
                    nextLevelData as GroupedMetricNode,
                    remainingGroupKeys,
                    metric,
                    nextCombination
                );
                combinations.push(...deeperCombinations);
             } else if (looksLikeGroupedMetricLeaf && remainingGroupKeys.length === 0) {
                 // Reached the end of groupKeys and found metric-like data
                 const finalCombination = { ...currentCombination, [currentGroupKey]: groupValue };
                 combinations.push(finalCombination);
             }
        }
        // If nextLevelData is not an object, it's likely a metric value itself, ignore.
    });

    return combinations;
};


/**
 * Converts potentially nested aggregated metric data into an array of artificial log entries.
 *
 * This function takes pre-computed metrics, potentially grouped by multiple fields
 * in a nested structure, and transforms them into LogProps items. Each resulting
 * "log" represents one unique combination of group values across all nesting levels
 * and contains the specified metric values for various columns. The placement of
 * these values within the log structure (params, derived_entries, entries) is
 * determined by the field_type provided in the `fields` object.
 *
 * @param groupKeys - An array of field names representing the nesting order used to group the metrics.
 * @param metric - The specific metric to extract from the aggregated data (e.g., 'mean', 'count', 'median').
 * @param fields - An object containing the metadata for all the project's fields. Dictates where each field's value should be placed.
 * @param columnMetrics - A potentially nested object containing the aggregated metric values.
 *                        Structure: { columnName -> { group1Value -> { group2Value -> ... -> { metricName -> value, shared_value? -> value } } } }
 * @returns An array of `LogProps` objects, where each object simulates a log entry
 *          representing one unique group combination and its associated metric data.
 */
export const convertMetricsToLogs = (
    groupKeys: string[],
    metric: string,
    fields: LogFieldsResponseProps,
    columnMetrics: GroupedMetrics
): LogProps[] => {
    const columns = Object.keys(columnMetrics);
    if (columns.length === 0) {
        return [];
    }

    // Use the structure of the first column to find all unique group combinations
    // Assumes all columns share the same grouping structure/keys
    const firstColumnData = columnMetrics[columns[0]];
    const groupCombinations = findGroupCombinations(firstColumnData, groupKeys, metric);

    // Construct an artificial log entry for each unique combination
    const metricLogs: LogProps[] = groupCombinations.map((combination) => {

        // Generate a unique ID based on the combination
        const combinationValuesString = groupKeys.map(key => combination[key] || 'null').join('-');
        const logId = `${groupKeys.join('@')}-${metric}-${combinationValuesString}`;

        const metricLog: LogProps = { id: logId, ts: Date.now().toString(), type: "ungrouped", params: {}, derived_entries: {}, clipped_fields: {}, entries: {} };

        // 1. Add the group fields and their values from the current combination
        groupKeys.forEach(groupKey => {
            const groupValue = combination[groupKey];
            if (fields[groupKey]) {
                 const fieldMeta = fields[groupKey];
                 if (fieldMeta.field_type === "param") metricLog.params[groupKey] = groupValue;
                 else if (fieldMeta.field_type === "derived_entry") metricLog.derived_entries[groupKey] = groupValue;
                 else metricLog.entries[groupKey] = groupValue;
            } else {
                metricLog.entries[groupKey] = groupValue;
            }
        });

        // 2. Add the column fields and their respective metric values
        columns.forEach(column => {
            // Find the metric data for this specific column and combination
            const metricData = getGroupedMetricNode(columnMetrics[column], groupKeys, metric, combination);

            if (metricData) {
                // Use shared_value if present, otherwise use the specified metric
                const fieldValue = metricData.shared_value !== null ? metricData.shared_value : metricData[metric];

                // Add the field value if it's defined (or null)
                if (fieldValue !== undefined) {
                    if (fields[column]) {
                        const fieldMeta = fields[column];
                        if (fieldMeta.field_type === "param") metricLog.params[column] = fieldValue;
                        else if (fieldMeta.field_type === "derived_entry") metricLog.derived_entries[column] = fieldValue;
                        else metricLog.entries[column] = fieldValue;
                    } else {
                        metricLog.entries[column] = fieldValue;
                    }
                }
            }
        });

        return metricLog;
    });

    return metricLogs;
};