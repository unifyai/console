import {
  GroupedMetrics,
  GroupedMetricNode,
  GroupedMetricLeaf,
  LogItemProps,
  LogsResponseProps,
  GroupedLogProps,
  LogProps,
  LogFieldsResponseProps,
  GroupedLogPropsRaw,
} from '../../types/interfaces/logs';
import { formatNumber } from './formatNumber';
import { processContext } from './table/columnOperations';
import { LogsActions, TableGroupedMetrics } from '@/types/interfaces/grid';
import { sanitizeKey } from '@/app/(home)/(app-shell)/interfaces/utils';
import { Row } from '@tanstack/react-table';
import { maybeConvertRawToGroupedLogs } from './table/grouping';
import { TreeNode } from '@/types/common';
import { showErrorToast } from '@/components/Common/Toasts/notifications';

// Short-lived, in-process caches for metrics requests (dedupe + TTL)
declare global {
  // eslint-disable-next-line no-var
  var __metricsCache: Map<string, { ts: number; data: any }> | undefined;
  // eslint-disable-next-line no-var
  var __metricsPending: Map<string, Promise<any>> | undefined;
}

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

/* 
    Convert object / string inputs to their length value and return the value of numeric inputs. 
*/
export function toComputableValue(value: any) {
  const type = typeof value;
  switch (type) {
    case 'number':
      return value;
    case 'string':
      return value.length;
    case 'boolean':
      return Number(value);
    case 'object':
      if (value === null) return 0;
      else if (Array.isArray(value)) return value.length;
      else if (value instanceof Date) return value.getTime();
      else return Object.keys(value).length;
    default:
      0;
  }
}

/* 
    Compute reduction metrics from an array of numbers.
*/
export function computeStatistic(statistic: string, data: number[]): string {
  switch (statistic) {
    case 'mean':
      return formatNumber(data.reduce((a, b) => a + b, 0) / data.length);
    case 'var': {
      const variance =
        data.reduce(
          (sum, value, index, array) =>
            sum + Math.pow(value - array.reduce((sum, value) => sum + value, 0) / array.length, 2),
          0
        ) / data.length;
      return formatNumber(variance);
    }
    case 'std': {
      const squaredDiffs =
        data.reduce(
          (sum, value, index, array) =>
            sum + Math.pow(value - array.reduce((sum, value) => sum + value, 0) / array.length, 2),
          0
        ) / data.length;
      const std = Math.sqrt(squaredDiffs);
      return formatNumber(std);
    }
    case 'count':
      return formatNumber(data.length);
    case 'sum':
      return formatNumber(data.reduce((a, b) => a + b, 0));
    case 'min':
      return formatNumber(Math.min(...data));
    case 'max':
      return formatNumber(Math.max(...data));
    case 'median': {
      const sortedArray = data.slice().sort((a: number, b: number) => a - b);
      const middleIndex = Math.floor(sortedArray.length / 2);
      const median =
        sortedArray.length % 2 === 0
          ? (sortedArray[middleIndex - 1] + sortedArray[middleIndex]) / 2
          : sortedArray[middleIndex];
      return formatNumber(median);
    }
    case 'mode': {
      const counts: { [key: number]: number } = data.reduce(
        (a: { [key: number]: number }, b) => ((a[b] = (a[b] || 0) + 1), a),
        {}
      );
      const maxCount = Math.max(...Object.values(counts));
      const modes = Object.keys(counts)
        .filter((k) => counts[+k] === maxCount)
        .map((value) => parseFloat(value));
      return modes.map((mode) => formatNumber(mode)).join(',');
    }
    default:
      throw new Error(`Unsupported statistic: ${statistic}`);
  }
}

/*
  Extract logs from a logs response.
  Note: params support has been removed, kept for API compatibility
*/
export function extractLogs(
  params: LogItemProps | undefined,
  rawLogs: LogProps[] | GroupedLogPropsRaw
) {
  // If logs is an array (non-grouped case), process it directly
  // If it's GroupedLogPropsRaw (grouped case), convert it first
  const logs = Array.isArray(rawLogs)
    ? rawLogs.map(
        (log) =>
          ({
            type: 'ungrouped',
            id: log.id,
            ts: log.ts,
            derivedEntries: {},
            entries: { ...log.entries, ...log.derivedEntries }, // Bundle derived entries with entries
            clippedFields: log.clippedFields,
          }) as LogProps
      )
    : maybeConvertRawToGroupedLogs(undefined, rawLogs, null);

  return logs;
}

/* 
  Extract logs, parameters, and their respective keys, accounting for context and sorting preferences.
*/
export function extractLogsData(
  logsResponse: LogsResponseProps,
  fields: LogFieldsResponseProps,
  columnContext: string | null,
  sorting: string | null,
  hiddenColumns: string | undefined
) {
  const rawLogs = logsResponse.logs;
  const logs = extractLogs(undefined, rawLogs);

  // Helper: recursively collect nested keys as slash paths
  const collectKeys = (obj: any, prefix = ''): string[] => {
    if (!obj || typeof obj !== 'object') return [];
    const keys: string[] = [];
    for (const k of Object.keys(obj)) {
      const v = (obj as any)[k];
      const next = prefix ? `${prefix}/${k}` : k;
      keys.push(next);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        keys.push(...collectKeys(v, next));
      }
    }
    return keys;
  };

  let entriesProperties: string[];

  if (!fields || Object.keys(fields).length === 0) {
    // Fallback: derive columns from the first log if fields are unavailable
    const first = Array.isArray(logs) && logs.length > 0 ? logs[0] : null;
    const rawEntriesKeys = first?.entries ? collectKeys(first.entries) : [];
    // Build absolute keys with context
    let absEntries = rawEntriesKeys.map((k) =>
      columnContext ? processContext('merge', columnContext, k) : k
    );
    // Apply hidden filtering on relative keys
    if (hiddenColumns) {
      const hidden = new Set(hiddenColumns.split(','));
      const relEntries = absEntries.map((k) =>
        columnContext ? processContext('split', columnContext, k) : k
      );
      entriesProperties = relEntries.filter((p) => !hidden.has(p));
    } else {
      // Return relative keys
      entriesProperties = absEntries.map((k) =>
        columnContext ? processContext('split', columnContext, k) : k
      );
    }
  } else {
    // Normal path using fields metadata - only entries (no params)
    entriesProperties = Object.entries(fields).map((entry) => entry[0]);
    if (columnContext) {
      entriesProperties = entriesProperties
        .filter((property) => property.includes(columnContext))
        .map((property) => processContext('split', columnContext, property));
    }
    if (hiddenColumns) {
      const hidden = hiddenColumns.split(',');
      entriesProperties = entriesProperties.filter((property) => !hidden.includes(property));
    }
  }

  return { entriesProperties, logs };
}

export const getColumnMetrics = async (
  project: string | null,
  context: string | null,
  columnContext: string | null,
  columns: string[],
  filteression: string | null,
  groupingExpression: string | null,
  metric: string | undefined,
  logsActions: LogsActions
) => {
  // Simple in-memory dedupe + TTL cache to avoid duplicate analytics calls
  const METRICS_TTL_MS = 10_000;
  if (!globalThis.__metricsCache) {
    globalThis.__metricsCache = new Map<string, { ts: number; data: any }>();
  }
  if (!globalThis.__metricsPending) {
    globalThis.__metricsPending = new Map<string, Promise<any>>();
  }
  const metricsCache = globalThis.__metricsCache!;
  const metricsPending = globalThis.__metricsPending!;
  const keyObj = {
    project,
    context,
    columnContext,
    columns,
    filteression,
    groupingExpression,
    metric,
  };
  const key = JSON.stringify(keyObj);
  const now = Date.now();
  const cached = metricsCache.get(key);
  if (cached && now - cached.ts < METRICS_TTL_MS) {
    return cached.data;
  }
  const inflight = metricsPending.get(key);
  if (inflight) {
    return inflight;
  }

  let fullColumns = columns;
  if (columnContext)
    fullColumns = fullColumns.map((column) => processContext('merge', columnContext, column));

  // Call API route directly instead of server action
  const metricName = metric ? metric : 'mean';
  const sanitizedColumns = fullColumns.map(sanitizeKey);
  const params = new URLSearchParams();
  params.set('projectName', project!);
  if (context) params.set('context', context);
  params.set('key', JSON.stringify(sanitizedColumns));
  if (filteression) params.set('filter', filteression);
  if (groupingExpression) params.set('groupBy', JSON.stringify(groupingExpression.split(',')));
  const fetchPromise = fetch(`/api/logs/${metricName}?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })
    .then(async (res) => {
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: `Metrics ${res.status}` }));
        throw new Error(errorData.detail || `Failed to fetch metrics: ${res.status}`);
      }
      const data = await res.json();
      metricsCache.set(key, { ts: Date.now(), data });
      return data;
    })
    .finally(() => {
      metricsPending.delete(key);
    });
  metricsPending.set(key, fetchPromise);
  return fetchPromise;
};

export const getLogsDetails = async (
  logsData: LogsResponseProps,
  fields: LogFieldsResponseProps,
  context: string | null,
  columnContext: string | null,
  project: string | null,
  filteression: string | null,
  metric: string | undefined,
  sorting: string | null,
  hiddenColumns: string | undefined,
  logsActions: LogsActions
) => {
  // Unpack log data
  const { entriesProperties, logs } = extractLogsData(
    logsData,
    fields,
    columnContext,
    sorting,
    hiddenColumns
  );

  const columns = logs.length ? entriesProperties : [];

  /* Handle column metrics */
  // Getting metrics for filtered logs, and min / max values for full logs.
  // Min / max bounds are used to set the filtering range for numeric columns
  try {
    const totalStart = performance.now();

    const [metrics, minimums, maximums] = await Promise.all([
      (async () => {
        const start = performance.now();
        const result = (await getColumnMetrics(
          project,
          context,
          columnContext,
          columns,
          filteression,
          null,
          metric,
          logsActions
        )) as { [key: string]: number };
        const end = performance.now();
        perfLog(`[perf] getColumnMetrics (filtered metrics) took ${(end - start).toFixed(2)}ms`);
        return result;
      })(),
      (async () => {
        const start = performance.now();
        const result = (await getColumnMetrics(
          project,
          context,
          columnContext,
          columns,
          null,
          null,
          'min',
          logsActions
        )) as { [key: string]: number };
        const end = performance.now();
        perfLog(`[perf] getColumnMetrics (minimums) took ${(end - start).toFixed(2)}ms`);
        return result;
      })(),
      (async () => {
        const start = performance.now();
        const result = (await getColumnMetrics(
          project,
          context,
          columnContext,
          columns,
          null,
          null,
          'max',
          logsActions
        )) as { [key: string]: number };
        const end = performance.now();
        perfLog(`[perf] getColumnMetrics (maximums) took ${(end - start).toFixed(2)}ms`);
        return result;
      })(),
    ]);

    const totalEnd = performance.now();
    perfLog(
      `[perf] All three getColumnMetrics calls completed in parallel, total time: ${(totalEnd - totalStart).toFixed(2)}ms`
    );

    // Min-max boundaries for numeric and time-like column filters
    const boundaries = { minimums, maximums };

    return {
      entriesProperties,
      logs,
      metrics,
      boundaries,
    };
  } catch (error) {
    showErrorToast(error, 'Failed to get log details.');
    // Return a default/empty state on error
    return {
      entriesProperties: [],
      logs: [],
      metrics: {},
      boundaries: { minimums: {}, maximums: {} },
    };
  }
};

export const getGroupedMetrics = async (
  project: string | null,
  context: string | null,
  columnContext: string | null,
  columns: string[],
  filteression: string | null,
  groupingExpression: string | null,
  metric: string | undefined,
  fields: LogFieldsResponseProps,
  logsActions: LogsActions
) => {
  let groupedMetrics: TableGroupedMetrics = {};
  if (groupingExpression) {
    try {
      const numericColumns = columns.filter((col) =>
        ['int', 'float', 'timestamp', 'time', 'date', 'timedelta', 'bool'].includes(
          fields?.[col]?.dataType
        )
      );
      const groupingColumnId = (groupingExpression as string).split(',')[0];
      const metricValue = metric ?? 'mean';
      const metricsData = (await getColumnMetrics(
        project,
        context,
        columnContext,
        numericColumns,
        filteression,
        groupingColumnId,
        metricValue,
        logsActions
      )) as { [key: string]: { [key: string]: { [key: string]: number | string } } };
      const metrics = Object.fromEntries(
        Object.entries(metricsData)
          .filter(([col]) => numericColumns.includes(col))
          .map(([col, groups]) => [
            col,
            Object.fromEntries(
              Object.entries(groups).map(([groupingValue, results]) => [
                groupingValue,
                results[metricValue],
              ])
            ),
          ])
      );
      const sharedValues = Object.fromEntries(
        Object.entries(metricsData).map(([col, groups]) => [
          col,
          Object.fromEntries(
            Object.entries(groups).map(([groupingValue, results]) => [
              groupingValue,
              results['sharedValue'],
            ])
          ),
        ])
      );
      groupedMetrics[groupingColumnId] = {
        [metricValue]: metrics,
        sharedValue: sharedValues,
      };
    } catch (error) {
      showErrorToast(error, 'Failed to get grouped metrics.');
    }
  }
  return groupedMetrics;
};

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
    if (type === 'grouped') {
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

  paths.forEach((path) => {
    let current = root;
    const parts = path.split('/').filter(Boolean);

    let currentPath = '';
    parts.forEach((part, index) => {
      currentPath += part + '/';
      if (!current.children[part]) {
        current.children[part] = {
          path: currentPath,
          children: {},
          isComplete: index === parts.length - 1,
        };
      }
      current = current.children[part];
    });
  });

  return root;
};

/**
 * Previously replaced parameter indices within log entries with actual values.
 * Params support has been removed - this function now returns data unchanged.
 *
 * @param {LogsResponseProps} data - The input log response object from get_logs.
 * @returns {LogsResponseProps} The original `data` object unmodified.
 */
export const replaceParamsIndicesWithValues = (data: LogsResponseProps) => {
  return data;
};

/**
 * Helper function to retrieve nested metric data from grouped metrics for a given combination of grouping.
 */
const getGroupedMetricNode = (
  columnData: GroupedMetricNode | undefined,
  groupKeys: string[],
  metric: string,
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
  // Add a check to ensure it looks like metric data (e.g., has [metric], or 'sharedValue')
  if (typeof currentLevel === 'object' && currentLevel !== null && !Array.isArray(currentLevel)) {
    // A simple check - could be more robust based on expected metric names
    const keys = Object.keys(currentLevel);
    if (keys.length > 0 && (keys.includes('sharedValue') || keys.includes(metric))) {
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

  Object.keys(levelData).forEach((groupValue) => {
    // Avoid recursing into the actual metric values (like 'mean', 'count')
    const nextLevelData = levelData[groupValue];
    if (typeof nextLevelData === 'object' && nextLevelData !== null) {
      // Check if it looks like the next level of grouping or the final metric values
      const looksLikeGroupedMetricLeaf =
        remainingGroupKeys.length === 0 &&
        (typeof nextLevelData['sharedValue'] !== 'undefined' ||
          typeof nextLevelData[metric] !== 'undefined'); // Add other common metrics

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
 * these values within the log structure (params, derivedEntries, entries) is
 * determined by the fieldType provided in the `fields` object.
 *
 * @param groupKeys - An array of field names representing the nesting order used to group the metrics.
 * @param metric - The specific metric to extract from the aggregated data (e.g., 'mean', 'count', 'median').
 * @param fields - An object containing the metadata for all the project's fields. Dictates where each field's value should be placed.
 * @param columnMetrics - A potentially nested object containing the aggregated metric values.
 *                        Structure: { columnName -> { group1Value -> { group2Value -> ... -> { metricName -> value, sharedValue? -> value } } } }
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
    const combinationValuesString = groupKeys.map((key) => combination[key] || 'null').join('-');
    const logId = `${groupKeys.join('@')}-${metric}-${combinationValuesString}`;

    const metricLog: LogProps = {
      id: logId,
      ts: Date.now().toString(),
      type: 'ungrouped',
      params: {},
      derivedEntries: {},
      clippedFields: {},
      entries: {},
    };

    // 1. Add the group fields and their values from the current combination
    groupKeys.forEach((groupKey) => {
      const groupValue = combination[groupKey];
      if (fields[groupKey]) {
        const fieldMeta = fields[groupKey];
        if (fieldMeta.fieldType === 'derived_entry')
          metricLog.derivedEntries[groupKey] = groupValue;
        else metricLog.entries[groupKey] = groupValue;
      } else {
        metricLog.entries[groupKey] = groupValue;
      }
    });

    // 2. Add the column fields and their respective metric values
    columns.forEach((column) => {
      // Find the metric data for this specific column and combination
      const metricData = getGroupedMetricNode(
        columnMetrics[column],
        groupKeys,
        metric,
        combination
      );

      if (metricData) {
        // Use sharedValue if present, otherwise use the specified metric
        const fieldValue =
          metricData.sharedValue !== null ? metricData.sharedValue : metricData[metric];

        // Add the field value if it's defined (or null)
        if (fieldValue !== undefined) {
          if (fields[column]) {
            const fieldMeta = fields[column];
            if (fieldMeta.fieldType === 'derived_entry')
              metricLog.derivedEntries[column] = fieldValue;
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

/**
 * Returns an array of field names that start with the given "column context".
 * For example, if columnContext = "question", it returns all keys like "question/something".
 *
 * @param fields LogFieldsResponseProps
 * @param columnContext A prefix like "question" or "question/" or "student"
 * @returns string[] of matching field names (e.g. ["question/subject", "question/paper_id", ...])
 */
export function getFieldsByColumnContext(
  fields: LogFieldsResponseProps,
  columnContext: string
): string[] {
  if (!columnContext) {
    // If no context is provided, return all keys (or empty array, up to you)
    return [];
  }

  // Ensure we have a trailing slash, so "question" => "question/"
  // If the user already includes a slash, we preserve that
  const normalizedContext = columnContext.endsWith('/') ? columnContext : columnContext + '/';

  // Filter all fields to those whose key starts with e.g. "question/"
  return Object.keys(fields).filter((key) => key.startsWith(normalizedContext));
}
