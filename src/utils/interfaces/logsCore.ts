import {
  LogProps,
  GroupedLogProps,
  LogFieldsResponseProps,
  LogsResponseProps,
  LogItemProps,
} from '@/types/interfaces/logs';
import { LogsActions } from '@/types/interfaces/grid';
import {
  maybeConvertRawToGroupedLogs,
  getGroupingFilters,
  getUpdatedGroupingExpression,
  isGroupedLogs,
  getTargetGroupFilters,
} from './table/grouping';
import { getTotalCountFromLogsResponse } from '../data/buildTableDataItem';

/**
 * Core parameters for log fetching operations
 */
export interface CoreLogFetchParams {
  projectId: string;
  context: string | null;
  columnContext: string | null;
  filteression: string | null;
  sortingExpression: string | null;
  groupingExpression: string | null;
  groupSortingExpression: string | null;
  limit: number;
  offset?: number;
  groupLimit: number;
  groupOffset?: number;
  logsActions: LogsActions;
  // Optional group-specific parameters
  groupId?: string | null;
  groupingColumnId?: string | null;
  groupingValue?: string | null;
  parentId?: string | null;
  dataTypes?: { [key: string]: string };
  fields?: LogFieldsResponseProps;
  signal?: AbortSignal;
  // Optional headers for API calls (used in tests to pass API key)
  headers?: Record<string, string>;
}

/**
 * Response from core log fetching with computed metadata
 */
export interface CoreLogFetchResult {
  // Raw API response
  response: LogsResponseProps;

  // Processed logs
  convertedLogs: LogProps[] | GroupedLogProps[];

  // Pagination metadata
  totalCount: number;
  currentCount: number;
  hasMore: boolean;
  useGroupPagination: boolean;
  effectiveLimit: number;
  effectiveOffset: number;

  // Filter expressions (for group expansion scenarios)
  updatedFilterExpression?: string | null;
  updatedGroupingExpression?: string | null;
  targetGroupFilters?: [string, string][];
}

/**
 * Consolidated core function that handles all log fetching scenarios:
 * - Initial table data loading
 * - Infinite scroll pagination
 * - Group expansion
 * - Group-specific infinite scroll
 */
export async function fetchLogsCore(params: CoreLogFetchParams): Promise<CoreLogFetchResult> {
  const {
    projectId,
    context,
    columnContext,
    filteression,
    sortingExpression,
    groupingExpression,
    groupSortingExpression,
    limit,
    offset = 0,
    groupLimit,
    groupOffset = 0,
    logsActions,
    groupId,
    groupingColumnId,
    groupingValue,
    parentId,
    dataTypes,
    fields,
    signal,
    headers,
  } = params;

  let effectiveFilterExpression = filteression;
  let effectiveGroupingExpression = groupingExpression;
  let useGroupPagination = !!groupingExpression;
  let targetGroupFilters: [string, string][] = [];

  // Handle group-specific scenarios (expansion or group-specific infinite scroll)
  if (groupingColumnId && groupingValue && dataTypes && fields) {
    const groupingFilters = getGroupingFilters(
      filteression,
      groupingColumnId,
      groupingValue,
      parentId || null,
      dataTypes,
      fields
    );

    effectiveFilterExpression = groupingFilters.updatedFilterExpression;
    effectiveGroupingExpression = getUpdatedGroupingExpression(
      groupingExpression,
      groupingColumnId
    );
    useGroupPagination = !!effectiveGroupingExpression;

    targetGroupFilters = getTargetGroupFilters(groupingFilters.columnFilters);
  }

  // Call API route directly instead of server action to avoid POST /interfaces spam
  const queryParams = new URLSearchParams();
  queryParams.set('projectName', projectId);
  if (context) queryParams.set('context', context);
  if (columnContext) queryParams.set('columnContext', columnContext);
  if (effectiveFilterExpression) queryParams.set('filter', effectiveFilterExpression);
  if (sortingExpression) queryParams.set('sorting', sortingExpression);
  if (groupSortingExpression) queryParams.set('groupSorting', groupSortingExpression);

  // Handle grouping (can be multiple values)
  if (effectiveGroupingExpression) {
    effectiveGroupingExpression.split(',').forEach((expr) => {
      queryParams.append('groupBy', expr.trim());
    });
  }

  // Pagination params
  if (!useGroupPagination && limit !== null) queryParams.set('limit', limit.toString());
  if (!useGroupPagination && offset !== null) queryParams.set('offset', offset.toString());
  if (useGroupPagination && groupLimit !== null)
    queryParams.set('groupLimit', groupLimit.toString());
  if (useGroupPagination && groupOffset !== null)
    queryParams.set('groupOffset', groupOffset.toString());
  if (useGroupPagination) queryParams.set('groupDepth', '0');

  const logsRes = await fetch(`/api/logs?${queryParams.toString()}`, {
    method: 'GET',
    signal: signal as AbortSignal,
    cache: 'no-store',
    headers: headers || {},
  });

  if (!logsRes.ok) {
    const errorData = await logsRes.json().catch(() => ({ detail: `Logs ${logsRes.status}` }));
    throw new Error(errorData.detail || `Failed to fetch logs: ${logsRes.status}`);
  }

  const response: LogsResponseProps = await logsRes.json();

  // Convert raw logs to appropriate format (params support removed)
  const convertedLogs: LogProps[] | GroupedLogProps[] = maybeConvertRawToGroupedLogs(
    undefined,
    response.logs,
    groupId || null
  );

  // Calculate pagination metadata using utility functions
  const totalCount = getTotalCountFromLogsResponse(response);
  const currentCount = useGroupPagination
    ? getCurrentGroupCount(groupOffset, groupLimit, convertedLogs.length)
    : getCurrentCount(offset, limit, convertedLogs.length);
  const hasMore = hasNextPage(currentCount, totalCount);

  return {
    response,
    convertedLogs,
    totalCount,
    currentCount,
    hasMore,
    useGroupPagination,
    updatedFilterExpression: effectiveFilterExpression,
    updatedGroupingExpression: effectiveGroupingExpression,
    targetGroupFilters,
    effectiveLimit: useGroupPagination ? groupLimit : limit,
    effectiveOffset: useGroupPagination ? groupOffset : offset,
  };
}

/**
 * Helper to build query key for log fetching scenarios
 */
export function buildLogQueryKey(
  type: 'infinite' | 'group-specific',
  baseParams: {
    tileId: string | null;
    tabId: string | null;
    projectId: string | null;
    context: string | null;
    columnContext: string | null;
    filteression: string | null;
    sortingExpression: string | null;
    groupingExpression: string | null;
    groupSortingExpression: string | null;
    limit: number;
    groupLimit: number;
  },
  groupParams?: {
    groupId: string;
    dataTypes: { [key: string]: string };
    fields: LogFieldsResponseProps;
  }
): (string | number | null)[] {
  const baseKey = [
    'logs',
    type,
    baseParams.tileId,
    baseParams.tabId,
    baseParams.projectId,
    baseParams.context,
    baseParams.columnContext,
    baseParams.filteression,
    baseParams.sortingExpression,
    baseParams.groupingExpression,
    baseParams.groupSortingExpression,
    baseParams.limit,
    baseParams.groupLimit,
  ];

  if (groupParams) {
    return [
      ...baseKey,
      'group-specific',
      groupParams.groupId,
      // Add stable keys for dataTypes and fields to avoid dependency issues
      Object.keys(groupParams.dataTypes).sort().join(','),
      Object.keys(groupParams.fields).sort().join(','),
    ];
  }

  return baseKey;
}

/**
 * Pagination utilities for checking if there are more pages available
 */
export function hasNextPage(currentCount: number, totalCount: number): boolean {
  return currentCount < totalCount;
}

export function hasPreviousPage(currentOffset: number): boolean {
  return currentOffset > 0;
}

/**
 * Calculate current count for pagination state
 */
export function getCurrentCount(offset: number, limit: number, fetchedCount: number): number {
  return offset + fetchedCount;
}

/**
 * Calculate current count for group pagination state
 */
export function getCurrentGroupCount(
  groupOffset: number,
  groupLimit: number,
  fetchedGroupCount: number
): number {
  return groupOffset + fetchedGroupCount;
}

/**
 * Unified utility to check if there are more pages for any pagination scenario
 */
export function checkHasNextPage(params: {
  currentLogs: LogProps[] | GroupedLogProps[];
  totalCount: number;
  effectiveOffset?: number;
  effectiveLimit?: number;
}): boolean {
  const { currentLogs, totalCount, effectiveOffset = 0, effectiveLimit = 20 } = params;
  const isGrouped = isGroupedLogs(currentLogs);

  if (!currentLogs.length) return false;

  if (isGrouped) {
    const currentCount = getCurrentGroupCount(effectiveOffset, effectiveLimit, currentLogs.length);
    return hasNextPage(currentCount, totalCount);
  } else {
    const currentCount = getCurrentCount(effectiveOffset, effectiveLimit, currentLogs.length);
    return hasNextPage(currentCount, totalCount);
  }
}
