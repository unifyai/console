import { LogProps, GroupedLogProps, LogFieldsResponseProps, LogsResponseProps, LogItemProps } from "@/types/interfaces/logs";
import { LogsActions } from "@/types/interfaces/grid";
import { maybeConvertRawToGroupedLogs, getGroupingFilters, getUpdatedGroupingExpression, isGroupedLogs, getTargetGroupFilters } from "./table/grouping";
import { getTotalCountFromLogsResponse } from "../data/buildTableDataItem";

/**
 * Core parameters for log fetching operations
 */
export interface CoreLogFetchParams {
  projectId: string;
  context: string | null;
  columnContext: string | null;
  filterExpression: string | null;
  sortingExpression: string | null;
  groupingExpression: string | null;
  groupSortingExpression: string | null;
  limit: number;
  offset?: number;
  group_limit: number;
  group_offset?: number;
  logsActions: LogsActions;
  // Optional group-specific parameters
  groupId?: string | null;
  groupingColumnId?: string | null;
  groupingValue?: string | null;
  parentId?: string | null;
  dataTypes?: { [key: string]: string };
  fields?: LogFieldsResponseProps;
  signal?: AbortSignal;
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
    filterExpression,
    sortingExpression,
    groupingExpression,
    groupSortingExpression,
    limit,
    offset = 0,
    group_limit,
    group_offset = 0,
    logsActions,
    groupId,
    groupingColumnId,
    groupingValue,
    parentId,
    dataTypes,
    fields,
    signal
  } = params;

  let effectiveFilterExpression = filterExpression;
  let effectiveGroupingExpression = groupingExpression;
  let useGroupPagination = !!groupingExpression;
  let targetGroupFilters: [string, string][] = [];

  // Handle group-specific scenarios (expansion or group-specific infinite scroll)
  if (groupingColumnId && groupingValue && dataTypes && fields) {
    const groupingFilters = getGroupingFilters(
      filterExpression,
      groupingColumnId,
      groupingValue,
      parentId || null,
      dataTypes,
      fields
    );
    
    effectiveFilterExpression = groupingFilters.updatedFilterExpression;
    effectiveGroupingExpression = getUpdatedGroupingExpression(groupingExpression, groupingColumnId);
    useGroupPagination = !!effectiveGroupingExpression;

    targetGroupFilters = getTargetGroupFilters(groupingFilters.columnFilters);
  }

  // Make the API call with appropriate parameters
  let response: LogsResponseProps = await logsActions.get(
    projectId,
    context,
    columnContext,
    effectiveFilterExpression,
    sortingExpression,
    effectiveGroupingExpression,
    groupSortingExpression,
    null, // from_ids
    null, // from_fields
    null, // exclude_fields
    useGroupPagination ? null : limit, // limit (not used for groups)
    useGroupPagination ? null : offset, // offset (not used for groups)
    useGroupPagination ? group_limit : null, // group_limit (used for groups)
    useGroupPagination ? group_offset : null, // group_offset (used for groups)
    useGroupPagination ? 0 : null, // group_depth (used for groups)
    null, // return_ids_only
    null, // randomize
    Date.now().toString(),
    signal as AbortSignal
  );

  // Convert raw logs to appropriate format
  const convertedLogs: LogProps[] | GroupedLogProps[] = maybeConvertRawToGroupedLogs(
    response.params,
    response.logs,
    groupId || null
  );

  // Calculate pagination metadata using utility functions
  const totalCount = getTotalCountFromLogsResponse(response);
  const currentCount = useGroupPagination 
    ? getCurrentGroupCount(group_offset, group_limit, convertedLogs.length)
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
    effectiveLimit: useGroupPagination ? group_limit : limit,
    effectiveOffset: useGroupPagination ? group_offset : offset
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
    filterExpression: string | null;
    sortingExpression: string | null;
    groupingExpression: string | null;
    groupSortingExpression: string | null;
    limit: number;
    group_limit: number;
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
    baseParams.filterExpression,
    baseParams.sortingExpression,
    baseParams.groupingExpression,
    baseParams.groupSortingExpression,
    baseParams.limit,
    baseParams.group_limit
  ];

  if (groupParams) {
    return [
      ...baseKey,
      'group-specific',
      groupParams.groupId,
      // Add stable keys for dataTypes and fields to avoid dependency issues
      Object.keys(groupParams.dataTypes).sort().join(','),
      Object.keys(groupParams.fields).sort().join(',')
    ];
  }

  return baseKey;
}

/**
 * Pagination utilities for checking if there are more pages available
 */
export function hasNextPage(
  currentCount: number,
  totalCount: number
): boolean {
  return currentCount < totalCount;
}

export function hasPreviousPage(
  currentOffset: number
): boolean {
  return currentOffset > 0;
}

/**
 * Calculate current count for pagination state
 */
export function getCurrentCount(
  offset: number,
  limit: number,
  fetchedCount: number
): number {
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
