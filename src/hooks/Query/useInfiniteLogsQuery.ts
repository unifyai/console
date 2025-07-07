import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { LogsActions, TableDataItem } from '@/types/evals/grid';
import { LogFieldsResponseProps, LogProps, GroupedLogProps, LogsResponseProps } from '@/types/evals/logs';
import { findGroupSubRows, getGroupingFilters, getTargetGroupFilters } from '@/utils/evals/grouping';
import { fetchLogsCore, buildLogQueryKey, CoreLogFetchParams } from '@/utils/evals/logsCore';
import { useTableTile } from '@/contexts/hooks/tile/useTableTile';

/**
 * Debug flag for infinite query performance logging
 * Set NEXT_PUBLIC_DEBUG_INFINITE_QUERIES=true to enable detailed infinite query performance logs
 */
const DEBUG_INFINITE_QUERIES = process.env.NEXT_PUBLIC_DEBUG_INFINITE_QUERIES === 'true';

/**
 * Debug flag for infinite query key tracking
 * Set NEXT_PUBLIC_DEBUG_QUERY_KEYS=true to enable detailed query key registration/removal logs
 */
const DEBUG_QUERY_KEYS = process.env.NEXT_PUBLIC_DEBUG_QUERY_KEYS === 'true';

/**
 * Conditional debug logger for infinite query performance metrics
 */
const perfLog = (...args: any[]) => {
  if (DEBUG_INFINITE_QUERIES) {
    console.log(...args);
  }
};

/**
 * Conditional debug logger for query key tracking
 */
const keyLog = (...args: any[]) => {
  if (DEBUG_QUERY_KEYS) {
    console.log(...args);
  }
};

interface InfiniteLogsParams {
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
  logsActions: LogsActions;
  updateLogs?: (
    logsData: LogsResponseProps,
    mode?: "replace" | "append",
    targetGroupId?: string | null,
    targetGroupFilters?: [string, string][],
    preConvertedLogs?: GroupedLogProps[] | LogProps[]
  ) => void;
  enabled?: boolean;
}

export interface InfiniteLogsPage {
  hasMore: boolean;
  totalCount: number;
  currentCount: number;
  pageIndex: number;
}

export interface InfiniteGroupSpecificPage {
  hasMore: boolean;
  totalCount: number;
  currentCount: number;
  pageIndex: number;
}

export function useInfiniteLogsQuery({
  tileId,
  tabId,
  projectId,
  context,
  columnContext,
  filterExpression,
  sortingExpression,
  groupingExpression,
  groupSortingExpression,
  limit,
  group_limit,
  logsActions,
  updateLogs,
  enabled = true,
}: InfiniteLogsParams) {
  const tHookStart = performance.now();
  const queryClient = useQueryClient();
  
  // Get table tile actions for offset management
  const { tableTileActions } = useTableTile(tileId, tabId);
  const useGroupPagination = !!groupingExpression;
  
  const queryKey = useMemo(() => buildLogQueryKey('infinite', {
    tileId,
    tabId,
    projectId,
    context,
    columnContext,
    filterExpression,
    sortingExpression,
    groupingExpression,
    groupSortingExpression,
    limit,
    group_limit
  }), [tileId, tabId, projectId, context, columnContext, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, limit, group_limit]);

  // Register this query key with the table tile for cleanup
  const queryKeyString = useMemo(() => JSON.stringify(queryKey), [queryKey]);

  useEffect(() => {
    if (tableTileActions?.addInfiniteQueryKey && enabled) {
      keyLog(`[queryKey] useInfiniteLogsQuery(${tileId}) – ADDING infinite query key:`, queryKeyString);
      tableTileActions.addInfiniteQueryKey(queryKeyString);
    } else {
      keyLog(`[queryKey] useInfiniteLogsQuery(${tileId}) – NOT adding query key (actions: ${!!tableTileActions?.addInfiniteQueryKey}, enabled: ${enabled})`);
    }
  }, [tableTileActions, queryKeyString, enabled, tileId]);

  const infiniteQuery = useInfiniteQuery<InfiniteLogsPage, Error, InfiniteLogsPage[], typeof queryKey, number>({
    queryKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }): Promise<InfiniteLogsPage> => {
      const tQueryFnStart = performance.now();
      
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      // Smart skip logic: Only skip page 0 on initial load, not on bidirectional scroll
      const existingInfiniteData = queryClient.getQueryData(queryKey) as { pages?: InfiniteLogsPage[] } | undefined;
      const hasExistingPages = existingInfiniteData?.pages && existingInfiniteData.pages.length > 0;
      const isBidirectionalScroll = hasExistingPages && pageParam === 0;
      const isInitialPageZero = pageParam === 0 && !isBidirectionalScroll;

      if (isInitialPageZero) {
        // Check if we have tableDataItem data to use (from fetchAndBuildTableDataItem calls)
        const existingTableData = queryClient.getQueryData<TableDataItem>(['tableDataItem', tileId]);
        
        if (existingTableData?.logs && existingTableData.logs.length > 0) {
          // Transform existing tableDataItem to infinite query result format
          const result = {
            hasMore: existingTableData.totalCount > existingTableData.logs.length,
            totalCount: existingTableData.totalCount,
            currentCount: existingTableData.logs.length,
            pageIndex: pageParam
          };
          perfLog(`[perf] useInfiniteLogsQuery(${tileId}) – page ${pageParam} served from cache (${existingTableData.logs.length} logs) – ${(performance.now() - tQueryFnStart).toFixed(2)}ms`);
          return result;
        }
      }

      // Calculate offsets based on pagination type
      const offset = pageParam * limit;
      const groupOffset = pageParam * group_limit;
      
      // // Update the tile offsets to keep them in sync
      // if (tableTileActions) {
      //   if (useGroupPagination) {
      //     tableTileActions.setGroupOffset(groupOffset);
      //   } else {
      //     tableTileActions.setOffset(offset);
      //   }
      // }

      // Use the consolidated core function
      const tCoreFetch = performance.now();
      const coreParams: CoreLogFetchParams = {
        projectId,
        context,
        columnContext,
        filterExpression,
        sortingExpression,
        groupingExpression,
        groupSortingExpression,
        limit,
        offset,
        group_limit,
        group_offset: groupOffset,
        logsActions
      };

      const result = await fetchLogsCore(coreParams);
      const fetchTime = performance.now() - tCoreFetch;

      // Update the table data item using updateLogs
      const tUpdateStart = performance.now();
      if (updateLogs) {
        const mode = pageParam === 0 ? "replace" : "append";
        updateLogs(result.response, mode, null, undefined, result.convertedLogs);
      }
      const updateTime = performance.now() - tUpdateStart;

      const finalResult = {
        hasMore: result.hasMore,
        totalCount: result.totalCount,
        currentCount: result.currentCount,
        pageIndex: pageParam
      };
      
      const totalTime = performance.now() - tQueryFnStart;
      perfLog(`[perf] useInfiniteLogsQuery(${tileId}) – page ${pageParam} fetched (${result.convertedLogs.length} logs processed, ${useGroupPagination ? 'grouped' : 'ungrouped'}) – fetch: ${fetchTime.toFixed(1)}ms, update: ${updateTime.toFixed(1)}ms, total: ${totalTime.toFixed(1)}ms`);
      return finalResult;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.pageIndex + 1 : undefined;
    },
    enabled: enabled && !!projectId && !!tileId && !!tabId,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,

  });
  
  const hookTime = performance.now() - tHookStart;
  perfLog(`[perf] useInfiniteLogsQuery(${tileId}) – completed (next: ${infiniteQuery.hasNextPage}, prev: ${infiniteQuery.hasPreviousPage}) – ${hookTime.toFixed(1)}ms`);
  return infiniteQuery;
}

/**
 * Comprehensive hook for group-specific infinite queries at any depth
 * Handles LoadMore functionality for nested subRows in grouped scenarios
 */
export function useInfiniteGroupSpecificLogsQuery({
  tileId,
  tabId,
  projectId,
  context,
  columnContext,
  filterExpression,
  sortingExpression,
  groupingExpression,
  groupSortingExpression,
  limit,
  group_limit,
  logsActions,
  updateLogs,
  groupId,
  dataTypes,
  fields,
  enabled = true,
}: {
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
  logsActions: LogsActions;
  updateLogs?: (
    logsData: LogsResponseProps,
    mode?: "replace" | "append",
    targetGroupId?: string | null,
    targetGroupFilters?: [string, string][],
    preConvertedLogs?: GroupedLogProps[] | LogProps[]
  ) => void;
  groupId: string; // Full group path like "column1:value1>column2:value2"
  dataTypes: { [key: string]: string };
  fields: LogFieldsResponseProps;
  enabled?: boolean;
}) {
  const tGroupHookStart = performance.now();
  const queryClient = useQueryClient();
  
  // Get table tile actions for offset management
  const { tableTileActions } = useTableTile(tileId, tabId);

  // For group-specific queries, we always use group pagination
  const useGroupPagination = true;
  
  const queryKey = useMemo(() => buildLogQueryKey('group-specific', {
    tileId,
    tabId,
    projectId,
    context,
    columnContext,
    filterExpression,
    sortingExpression,
    groupingExpression,
    groupSortingExpression,
    limit,
    group_limit
  }, {
    groupId,
    dataTypes,
    fields
  }), [tileId, tabId, projectId, context, columnContext, filterExpression, sortingExpression, groupingExpression, groupSortingExpression, limit, group_limit, groupId, dataTypes, fields]);

  // Register this query key with the table tile for cleanup
  const queryKeyString = useMemo(() => JSON.stringify(queryKey), [queryKey]);

  useEffect(() => {
    if (tableTileActions?.addInfiniteQueryKey && enabled) {
      keyLog(`[queryKey] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – ADDING infinite query key:`, queryKeyString);
      tableTileActions.addInfiniteQueryKey(queryKeyString);
    } else {
      keyLog(`[queryKey] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – NOT adding query key (actions: ${!!tableTileActions?.addInfiniteQueryKey}, enabled: ${enabled})`);
    }
    
  }, [tableTileActions, queryKeyString, enabled, tileId, groupId]);

  const groupInfiniteQuery = useInfiniteQuery<InfiniteGroupSpecificPage, Error, InfiniteGroupSpecificPage[], typeof queryKey, number>({
    queryKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }): Promise<InfiniteGroupSpecificPage> => {
      const tGroupQueryFnStart = performance.now();
      
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      // Smart skip logic: Only skip page 0 on initial load, not on bidirectional scroll
      const existingInfiniteData = queryClient.getQueryData(queryKey) as { pages?: InfiniteGroupSpecificPage[] } | undefined;
      const hasExistingPages = existingInfiniteData?.pages && existingInfiniteData.pages.length > 0;
      const isBidirectionalScroll = hasExistingPages && pageParam === 0;
      const isInitialPageZero = pageParam === 0 && !isBidirectionalScroll;

      // Parse groupId to get the last group info
      const groupParts = groupId.split('>');
      const lastGroup = groupParts[groupParts.length - 1];
      const [groupingColumnId, groupingValue] = lastGroup.split(':');
      const parentId = groupParts.length > 1 ? groupParts.slice(0, -1).join('>') : null;

      if (isInitialPageZero) {
        // Check if we have tableDataItem data to use (from onGroupExpand calls)
        const existingTableData = queryClient.getQueryData<TableDataItem>(['tableDataItem', tileId]);
        if (existingTableData?.logs && existingTableData.logs.length > 0) {
          // Build the target group filters
          const groupingFilters = getGroupingFilters(
            filterExpression,
            groupingColumnId,
            groupingValue,
            parentId || null,
            dataTypes,
            fields
          );
          const targetGroupFilters = getTargetGroupFilters(groupingFilters.columnFilters);

          // Use utility to find the specific group's subrows
          const groupData = findGroupSubRows(existingTableData.logs, targetGroupFilters);
          if (groupData) {
            const result = {
              hasMore: groupData.currentCount < groupData.totalCount,
              totalCount: groupData.totalCount,
              currentCount: groupData.currentCount,
              pageIndex: pageParam
            };
            perfLog(`[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – page ${pageParam} served from cache (${groupData.currentCount} subrows, hasMore: ${result.hasMore}) – ${(performance.now() - tGroupQueryFnStart).toFixed(2)}ms`);
            return result;
          }
          else {
            // If no group data is found, return an empty result
            perfLog(`[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – page ${pageParam} served from cache (no group data found) – ${(performance.now() - tGroupQueryFnStart).toFixed(2)}ms`);
            return {
              hasMore: false,
              totalCount: 0,
              currentCount: 0,
              pageIndex: pageParam
            };
          }
        }
      }

      // Calculate offsets for group-specific queries
      const offset = pageParam * limit;
      const groupOffset = pageParam * group_limit;
      
      // // Update the tile group offset to keep it in sync
      // if (tableTileActions) {
      //   tableTileActions.setGroupOffset(groupOffset);
      // }

      // Use the consolidated core function
      const tGroupCoreFetch = performance.now();
      const coreParams: CoreLogFetchParams = {
        projectId,
        context,
        columnContext,
        filterExpression,
        sortingExpression,
        groupingExpression,
        groupSortingExpression,
        limit,
        offset,
        group_limit,
        group_offset: groupOffset,
        logsActions,
        groupId,
        groupingColumnId,
        groupingValue,
        parentId,
        dataTypes,
        fields
      };

      const result = await fetchLogsCore(coreParams);
      const fetchTime = performance.now() - tGroupCoreFetch;

      // Update the table data using updateLogs with group context
      const tGroupUpdateStart = performance.now();
      if (updateLogs) {
        const mode = pageParam === 0 ? "replace" : "append";
        updateLogs(result.response, mode, groupId, result.targetGroupFilters, result.convertedLogs);
      }
      const updateTime = performance.now() - tGroupUpdateStart;

      const finalResult = {
        hasMore: result.hasMore,
        totalCount: result.totalCount,
        currentCount: result.currentCount,
        pageIndex: pageParam
      };
      
      const totalTime = performance.now() - tGroupQueryFnStart;
      const groupPath = groupId.split('>').length;
      perfLog(`[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – page ${pageParam} fetched (${result.convertedLogs.length} logs processed, depth ${groupPath}) – fetch: ${fetchTime.toFixed(1)}ms, update: ${updateTime.toFixed(1)}ms, total: ${totalTime.toFixed(1)}ms`);
      return finalResult;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.pageIndex + 1 : undefined;
    },
    enabled: enabled && !!projectId && !!tileId && !!tabId && !!groupId && !!dataTypes && !!fields,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,

  });
  
  const groupHookTime = performance.now() - tGroupHookStart;
  const groupDepth = groupId.split('>').length;
  perfLog(`[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – completed (depth ${groupDepth}, next: ${groupInfiniteQuery.hasNextPage}, prev: ${groupInfiniteQuery.hasPreviousPage}) – ${groupHookTime.toFixed(1)}ms`);
  return groupInfiniteQuery;
}

 