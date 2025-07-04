import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { LogsActions, TableDataItem } from '@/types/evals/grid';
import { LogFieldsResponseProps, LogProps, GroupedLogProps, LogItemProps, LogsResponseProps, GroupedLogPropsRaw } from '@/types/evals/logs';
import { appendToGroupedLogs } from '@/utils/evals/grouping';
import { fetchLogsCore, buildLogQueryKey, CoreLogFetchParams, checkHasPreviousPage } from '@/utils/evals/logsCore';
import { useTableTileSync } from '@/contexts/hooks/tile/sync';

/**
 * Debug flag for infinite query performance logging
 * Set NEXT_PUBLIC_DEBUG_INFINITE_QUERIES=true to enable detailed infinite query performance logs
 */
const DEBUG_INFINITE_QUERIES = process.env.NEXT_PUBLIC_DEBUG_INFINITE_QUERIES === 'true';

/**
 * Conditional debug logger for infinite query performance metrics
 */
const perfLog = (...args: any[]) => {
  if (DEBUG_INFINITE_QUERIES) {
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
  logs: LogProps[] | GroupedLogProps[];
  params: LogItemProps;
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
  const { tableTileActions } = useTableTileSync(tileId, tabId);
  const useGroupPagination = !!groupingExpression;
  
  const queryKey = buildLogQueryKey('infinite', {
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
  });

  const infiniteQuery = useInfiniteQuery<InfiniteLogsPage, Error, {
    pages: InfiniteLogsPage[];
    pageParams: number[];
    logs: LogProps[] | GroupedLogProps[];
    totalLoadedCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    totalCount: number;
    params: LogItemProps;
  }, typeof queryKey, number>({
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
            logs: existingTableData.logs,
            params: existingTableData.params || {},
            hasMore: existingTableData.totalCount > existingTableData.logs.length,
            totalCount: existingTableData.totalCount || 0,
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
      
      // Update the tile offsets to keep them in sync
      if (tableTileActions) {
        if (useGroupPagination) {
          tableTileActions.setGroupOffset(groupOffset);
        } else {
          tableTileActions.setOffset(offset);
        }
      }

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
        logs: result.convertedLogs,
        params: result.response.params,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
        currentCount: result.currentCount,
        pageIndex: pageParam
      };
      
      const totalTime = performance.now() - tQueryFnStart;
      perfLog(`[perf] useInfiniteLogsQuery(${tileId}) – page ${pageParam} fetched (${result.convertedLogs.length} logs, ${useGroupPagination ? 'grouped' : 'ungrouped'}) – fetch: ${fetchTime.toFixed(1)}ms, update: ${updateTime.toFixed(1)}ms, total: ${totalTime.toFixed(1)}ms`);
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
    select: (data) => {
      const tSelectStart = performance.now();
      
      // Process and merge all pages into a single array
      const allLogs: LogProps[] | GroupedLogProps[] = data.pages.reduce<LogProps[] | GroupedLogProps[]>((acc, page) => {
        if (useGroupPagination) {
          // For grouped logs, merge properly to avoid duplicates
          return appendToGroupedLogs(acc as GroupedLogProps[], page.logs) as GroupedLogProps[];
        } else {
          // For regular logs, just concatenate
          return [...(acc as LogProps[]), ...(page.logs as LogProps[])] as LogProps[];
        }
      }, []);

      const lastPage = data.pages[data.pages.length - 1];
      const firstPage = data.pages[0];
      const totalCount = firstPage?.totalCount || 0;
      
      // Calculate pagination states
      const currentOffset = useGroupPagination ? 
        (data.pageParams[data.pageParams.length - 1] || 0) * group_limit : 
        (data.pageParams[data.pageParams.length - 1] || 0) * limit;
      
      const hasPreviousPage = checkHasPreviousPage({
        offset: useGroupPagination ? 0 : currentOffset,
        groupOffset: useGroupPagination ? currentOffset : 0,
      });
      
      const result = {
        pages: data.pages,
        pageParams: data.pageParams,
        // Consolidated data for easy access
        logs: allLogs,
        totalLoadedCount: allLogs.length,
        hasNextPage: lastPage?.hasMore || false,
        hasPreviousPage,
        totalCount,
        params: firstPage?.params || {},
      };
      
      const selectTime = performance.now() - tSelectStart;
      if (selectTime > 10) { // Only log if significant processing time
        perfLog(`[perf] useInfiniteLogsQuery(${tileId}) – merged ${data.pages.length} pages into ${allLogs.length} logs – ${selectTime.toFixed(1)}ms`);
      }
      return result;
    }
  });

  // Fallback to tableDataItem when infinite query has no data yet
  const fallbackTableData = queryClient.getQueryData<TableDataItem>(['tableDataItem', tileId]);
  const hasInfiniteData = infiniteQuery.data?.logs && infiniteQuery.data.logs.length > 0;
  const hasFallbackData = fallbackTableData?.logs && fallbackTableData.logs.length > 0;

  const result = {
    ...infiniteQuery,
    // Expose the consolidated data directly with fallback support
    logs: hasInfiniteData ? infiniteQuery.data!.logs : (hasFallbackData ? fallbackTableData.logs : []),
    totalLoadedCount: hasInfiniteData ? infiniteQuery.data!.totalLoadedCount : (hasFallbackData ? fallbackTableData.logs.length : 0),
    hasNextPage: hasInfiniteData ? infiniteQuery.data!.hasNextPage : (hasFallbackData ? fallbackTableData.totalCount > fallbackTableData.logs.length : false),
    hasPreviousPage: hasInfiniteData ? infiniteQuery.data!.hasPreviousPage : false, // Fallback doesn't support previous page
    totalCount: hasInfiniteData ? infiniteQuery.data!.totalCount : (hasFallbackData ? fallbackTableData.totalCount : 0),
    params: hasInfiniteData ? infiniteQuery.data!.params : (hasFallbackData ? fallbackTableData.params : {}),
  };
  
  const hookTime = performance.now() - tHookStart;
  const dataSource = hasInfiniteData ? 'infinite' : (hasFallbackData ? 'fallback' : 'empty');
  perfLog(`[perf] useInfiniteLogsQuery(${tileId}) – completed (${result.logs.length} logs from ${dataSource}, next: ${result.hasNextPage}, prev: ${result.hasPreviousPage}) – ${hookTime.toFixed(1)}ms`);
  return result;
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
  const { tableTileActions } = useTableTileSync(tileId, tabId);
  // For group-specific queries, we always use group pagination
  const useGroupPagination = true;
  
  const queryKey = buildLogQueryKey('group-specific', {
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
  });

  const groupInfiniteQuery = useInfiniteQuery<InfiniteLogsPage, Error, {
    pages: InfiniteLogsPage[];
    pageParams: number[];
    logs: LogProps[] | GroupedLogProps[];
    totalLoadedCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    totalCount: number;
    params: LogItemProps;
  }, typeof queryKey, number>({
    queryKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam }: { pageParam: number }): Promise<InfiniteLogsPage> => {
      const tGroupQueryFnStart = performance.now();
      
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      // Smart skip logic: Only skip page 0 on initial load, not on bidirectional scroll
      const existingInfiniteData = queryClient.getQueryData(queryKey) as { pages?: InfiniteLogsPage[] } | undefined;
      const hasExistingPages = existingInfiniteData?.pages && existingInfiniteData.pages.length > 0;
      const isBidirectionalScroll = hasExistingPages && pageParam === 0;
      const isInitialPageZero = pageParam === 0 && !isBidirectionalScroll;

      if (isInitialPageZero) {
        // Check if we have tableDataItem data to use (from onGroupExpand calls)
        const existingTableData = queryClient.getQueryData<TableDataItem>(['tableDataItem', tileId]);
        
        if (existingTableData?.logs && existingTableData.logs.length > 0) {
          // For group-specific queries, we need to extract the relevant subRows
          // This is more complex, so for now we'll let it fetch, but this could be optimized
          // by traversing the grouped structure to find the specific group's data
          perfLog(`[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – could optimize cache extraction for group data`);
        }
      }

      // Parse groupId to get the last group info
      const groupParts = groupId.split('>');
      const lastGroup = groupParts[groupParts.length - 1];
      const [groupingColumnId, groupingValue] = lastGroup.split(':');
      const parentId = groupParts.length > 1 ? groupParts.slice(0, -1).join('>') : null;

      // Calculate offsets for group-specific queries
      const offset = pageParam * limit;
      const groupOffset = pageParam * group_limit;
      
      // Update the tile group offset to keep it in sync
      if (tableTileActions) {
        tableTileActions.setGroupOffset(groupOffset);
      }

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
        logs: result.convertedLogs,
        params: result.response.params,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
        currentCount: result.currentCount,
        pageIndex: pageParam
      };
      
      const totalTime = performance.now() - tGroupQueryFnStart;
      const groupPath = groupId.split('>').length;
      perfLog(`[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – page ${pageParam} fetched (${result.convertedLogs.length} logs, depth ${groupPath}) – fetch: ${fetchTime.toFixed(1)}ms, update: ${updateTime.toFixed(1)}ms, total: ${totalTime.toFixed(1)}ms`);
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
    select: (data) => {
      const tGroupSelectStart = performance.now();
      
      // Process and merge all pages into a single array
      const allLogs: LogProps[] | GroupedLogProps[] = data.pages.reduce<LogProps[] | GroupedLogProps[]>((acc, page) => {
        if (useGroupPagination) {
          // For grouped logs, merge properly to avoid duplicates
          return appendToGroupedLogs(acc as GroupedLogProps[], page.logs) as GroupedLogProps[];
        } else {
          // For regular logs, just concatenate
          return [...(acc as LogProps[]), ...(page.logs as LogProps[])] as LogProps[];
        }
      }, []);

      const lastPage = data.pages[data.pages.length - 1];
      const firstPage = data.pages[0];
      const totalCount = firstPage?.totalCount || 0;
      
      // Calculate pagination states for group-specific query
      const currentGroupOffset = (data.pageParams[data.pageParams.length - 1] || 0) * group_limit;
      
      const hasPreviousPage = checkHasPreviousPage({
        groupOffset: currentGroupOffset,
      });
      
      const result = {
        pages: data.pages,
        pageParams: data.pageParams,
        // Consolidated data for easy access
        logs: allLogs,
        totalLoadedCount: allLogs.length,
        hasNextPage: lastPage?.hasMore || false,
        hasPreviousPage,
        totalCount,
        params: firstPage?.params || {},
      };
      
      const selectTime = performance.now() - tGroupSelectStart;
      if (selectTime > 10) { // Only log if significant processing time
        perfLog(`[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – merged ${data.pages.length} pages into ${allLogs.length} logs – ${selectTime.toFixed(1)}ms`);
      }
      return result;
    }
  });
  
  // Enhanced return with fallback support similar to main query
  const result = {
    ...groupInfiniteQuery,
    // Expose the consolidated data directly
    logs: groupInfiniteQuery.data?.logs || [],
    totalLoadedCount: groupInfiniteQuery.data?.totalLoadedCount || 0,
    hasNextPage: groupInfiniteQuery.data?.hasNextPage || false,
    hasPreviousPage: groupInfiniteQuery.data?.hasPreviousPage || false,
    totalCount: groupInfiniteQuery.data?.totalCount || 0,
    params: groupInfiniteQuery.data?.params || {},
  };
  
  const groupHookTime = performance.now() - tGroupHookStart;
  const groupDepth = groupId.split('>').length;
  perfLog(`[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – completed (${result.logs.length} logs, depth ${groupDepth}, next: ${result.hasNextPage}, prev: ${result.hasPreviousPage}) – ${groupHookTime.toFixed(1)}ms`);
  return result;
}

 