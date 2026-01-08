import { useInfiniteQuery, useQueryClient, InfiniteData } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useCallback } from 'react';
import { LogsActions, TableDataItem } from '@/types/interfaces/grid';
import {
  LogFieldsResponseProps,
  LogProps,
  GroupedLogProps,
  LogsResponseProps,
} from '@/types/interfaces/logs';
import {
  decomposeGroupId,
  findGroupSubRows,
  getGroupingFilters,
  getTargetGroupFilters,
} from '@/utils/interfaces/table/grouping';
import { fetchLogsCore, buildLogQueryKey, CoreLogFetchParams } from '@/utils/interfaces/logsCore';
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

/**
 * Configuration for bidirectional infinite loading
 */
interface BidirectionalConfig {
  enabled: boolean;
  maxPagesInMemory: number; // Default: 5
  enableBackwardLoading: boolean;
  enableForwardLoading: boolean;
}

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
  groupLimit: number;
  logsActions: LogsActions;
  updateLogs?: (
    logsData: LogsResponseProps,
    mode: 'replace' | 'append' | 'prepend',
    targetGroupId?: string | null,
    targetGroupFilters?: [string, string][],
    preConvertedLogs?: GroupedLogProps[] | LogProps[],
    windowConfig?: {
      maxPagesInMemory: number;
      pageSize: number;
      currentPageCount: number;
    },
    currentOffsets?: { globalOffset: number; groupOffset: number }
  ) => { globalOffset: number; groupOffset: number };
  enabled?: boolean;
  bidirectional?: BidirectionalConfig;
}

export interface InfiniteLogsPage {
  hasMore: boolean;
  totalCount: number;
  currentCount: number;
  pageIndex: number;
  direction?: 'forward' | 'backward';
  data?: LogProps[] | GroupedLogProps[];
}

export interface InfiniteGroupSpecificPage {
  hasMore: boolean;
  totalCount: number;
  currentCount: number;
  pageIndex: number;
  direction?: 'forward' | 'backward';
  data?: LogProps[] | GroupedLogProps[];
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
  groupLimit,
  logsActions,
  updateLogs,
  enabled = true,
  bidirectional = {
    enabled: false,
    maxPagesInMemory: 5,
    enableBackwardLoading: true,
    enableForwardLoading: true,
  },
}: InfiniteLogsParams) {
  const tHookStart = performance.now();
  const queryClient = useQueryClient();

  // Get table tile actions for offset management
  const { tableTileActions } = useTableTile(tileId, tabId);
  const useGroupPagination = !!groupingExpression;

  const queryKey = useMemo(
    () =>
      buildLogQueryKey('infinite', {
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
        groupLimit,
      }),
    [
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
      groupLimit,
    ]
  );

  // Register this query key with the table tile for cleanup
  const queryKeyString = useMemo(() => JSON.stringify(queryKey), [queryKey]);

  useEffect(() => {
    if (tableTileActions?.addInfiniteQueryKey && enabled) {
      keyLog(
        `[queryKey] useInfiniteLogsQuery(${tileId}) – ADDING infinite query key:`,
        queryKeyString
      );
      tableTileActions.addInfiniteQueryKey(queryKeyString);
    } else {
      keyLog(
        `[queryKey] useInfiniteLogsQuery(${tileId}) – NOT adding query key (actions: ${!!tableTileActions?.addInfiniteQueryKey}, enabled: ${enabled})`
      );
    }
  }, [tableTileActions, queryKeyString, enabled, tileId]);

  // Bidirectional page management state
  const slidingWindowRef = useRef({
    windowStart: 0,
    windowEnd: 0,
    totalPagesLoaded: 0,
    globalOffset: 0, // Store the calculated offset here
  });

  // Reset sliding window bookkeeping whenever the parent disables the query
  // (e.g. while fetchAndBuildTableDataItem is rebuilding fresh table data).
  // This prevents stale offsets leaking into the next query run.
  useEffect(() => {
    if (!enabled) {
      slidingWindowRef.current = {
        windowStart: 0,
        windowEnd: 0,
        totalPagesLoaded: 0,
        globalOffset: 0,
      };
    }
  }, [enabled]);

  const infiniteQuery = useInfiniteQuery<
    InfiniteLogsPage,
    Error,
    InfiniteData<InfiniteLogsPage>,
    typeof queryKey,
    number
  >({
    queryKey,
    initialPageParam: 0,
    queryFn: async ({
      pageParam,
      direction = 'forward',
    }: {
      pageParam: number;
      direction?: 'forward' | 'backward';
    }): Promise<InfiniteLogsPage> => {
      const tQueryFnStart = performance.now();

      if (!projectId) {
        throw new Error('Project ID is required');
      }

      // Smart skip logic: Only skip page 0 on initial load, not on bidirectional scroll
      const existingInfiniteData = queryClient.getQueryData(queryKey) as
        | { pages?: InfiniteLogsPage[] }
        | undefined;
      const hasExistingPages = existingInfiniteData?.pages && existingInfiniteData.pages.length > 0;
      const isBidirectionalScroll = hasExistingPages && pageParam === 0;
      const isInitialPageZero = pageParam === 0 && !isBidirectionalScroll;

      if (isInitialPageZero) {
        // Check if we have tableDataItem data to use (from fetchAndBuildTableDataItem calls)
        const existingTableData = queryClient.getQueryData<TableDataItem>([
          'tableDataItem',
          tileId,
        ]);

        if (existingTableData?.logs && existingTableData.logs.length > 0) {
          // Transform existing tableDataItem to infinite query result format
          const result = {
            hasMore: existingTableData.totalCount > existingTableData.logs.length,
            totalCount: existingTableData.totalCount,
            currentCount: existingTableData.logs.length,
            pageIndex: pageParam,
            direction,
            data: existingTableData.logs,
          };
          perfLog(
            `[perf] useInfiniteLogsQuery(${tileId}) – page ${pageParam} served from cache (${existingTableData.logs.length} logs) – ${(performance.now() - tQueryFnStart).toFixed(2)}ms`
          );
          return result;
        }
      }

      // Calculate offsets based on pagination type and direction
      let offset: number;
      let groupOffset: number;

      if (direction === 'backward') {
        // For backward loading, we need to calculate offset from the beginning
        // pageParam for backward will be negative
        const absolutePageParam = Math.abs(pageParam);
        offset = Math.max(0, absolutePageParam * limit);
        groupOffset = Math.max(0, absolutePageParam * groupLimit);
      } else {
        // Forward loading (existing logic)
        offset = pageParam * limit;
        groupOffset = pageParam * groupLimit;
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
        groupLimit,
        groupOffset: groupOffset,
        logsActions,
      };

      const result = await fetchLogsCore(coreParams);
      const fetchTime = performance.now() - tCoreFetch;

      // Update the table data item using updateLogs
      const tUpdateStart = performance.now();
      if (updateLogs) {
        let mode: 'append' | 'prepend';
        if (direction === 'backward') {
          mode = 'prepend';
        } else {
          mode = 'append';
        }

        // Get current pages count for window management
        const currentPages = queryClient.getQueryData(queryKey) as
          | { pages?: InfiniteLogsPage[] }
          | undefined;
        const currentPageCount = currentPages?.pages?.length || 0;

        // Configure sliding window for bidirectional loading
        const windowConfig = bidirectional.enabled
          ? {
              maxPagesInMemory: bidirectional.maxPagesInMemory,
              pageSize: result.effectiveLimit,
              currentPageCount: currentPageCount + 1, // +1 because we're adding a new page
            }
          : undefined;

        // Update logs and get calculated offsets
        const currentGlobalOffset = bidirectional.enabled
          ? slidingWindowRef.current.globalOffset
          : 0;
        const { globalOffset: calculatedGlobalOffset } = updateLogs(
          result.response,
          mode,
          null,
          undefined,
          result.convertedLogs,
          windowConfig,
          { globalOffset: currentGlobalOffset, groupOffset: 0 }
        );

        // Store the calculated global offset for row indexing
        if (bidirectional.enabled) {
          slidingWindowRef.current.globalOffset = calculatedGlobalOffset;
        }
      }
      const updateTime = performance.now() - tUpdateStart;

      const finalResult = {
        hasMore: result.hasMore,
        totalCount: result.totalCount,
        currentCount: result.currentCount,
        pageIndex: pageParam,
        direction,
        data: result.convertedLogs,
      };

      const totalTime = performance.now() - tQueryFnStart;
      perfLog(
        `[perf] useInfiniteLogsQuery(${tileId}) – page ${pageParam} (${direction}) fetched (${result.convertedLogs.length} logs processed, ${useGroupPagination ? 'grouped' : 'ungrouped'}) – fetch: ${fetchTime.toFixed(1)}ms, update: ${updateTime.toFixed(1)}ms, total: ${totalTime.toFixed(1)}ms`
      );
      return finalResult;
    },
    getNextPageParam: (lastPage) => {
      if (!bidirectional.enabled || !bidirectional.enableForwardLoading) return undefined;
      return lastPage.hasMore ? lastPage.pageIndex + 1 : undefined;
    },
    getPreviousPageParam:
      bidirectional.enabled && bidirectional.enableBackwardLoading
        ? (firstPage) => {
            // Only allow backward loading if we're not at the very beginning
            return firstPage.pageIndex > 0 ? firstPage.pageIndex - 1 : undefined;
          }
        : undefined,
    maxPages: bidirectional.enabled ? bidirectional.maxPagesInMemory : undefined,
    enabled: enabled && !!projectId && !!tileId && !!tabId,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  // Custom hooks for bidirectional loading
  const fetchNextPageBidirectional = useCallback(async () => {
    if (!bidirectional.enabled || !bidirectional.enableForwardLoading) {
      return infiniteQuery.fetchNextPage();
    }

    // Let TanStack Query handle the sliding window via maxPages
    // The actual log removal is handled by updateLogs with windowConfig
    const result = await infiniteQuery.fetchNextPage();

    // Update window tracking
    if (result.data?.pages) {
      slidingWindowRef.current.windowEnd =
        slidingWindowRef.current.windowStart + result.data.pages.length - 1;
      slidingWindowRef.current.totalPagesLoaded = Math.max(
        slidingWindowRef.current.totalPagesLoaded,
        slidingWindowRef.current.windowEnd + 1
      );
    }

    return result;
  }, [infiniteQuery, bidirectional]);

  const fetchPreviousPageBidirectional = useCallback(async () => {
    if (!bidirectional.enabled || !bidirectional.enableBackwardLoading) {
      return Promise.resolve();
    }

    // Let TanStack Query handle the sliding window via maxPages
    // The actual log removal is handled by updateLogs with windowConfig
    const result = await infiniteQuery.fetchPreviousPage();

    // Update window tracking
    if (result.data?.pages) {
      slidingWindowRef.current.windowStart = Math.max(0, slidingWindowRef.current.windowStart - 1);
      slidingWindowRef.current.windowEnd =
        slidingWindowRef.current.windowStart + result.data.pages.length - 1;
    }

    return result;
  }, [infiniteQuery, bidirectional]);

  // Calculate actual page availability based on window position and total data
  const actualHasNextPage = useMemo(() => {
    if (!bidirectional.enabled) return infiniteQuery.hasNextPage;

    const currentPages = infiniteQuery.data?.pages || [];
    if (currentPages.length === 0) return false;

    // Check if the last page in our window has more data
    const lastPage = currentPages[currentPages.length - 1];
    return lastPage ? lastPage.hasMore : false;
  }, [infiniteQuery.hasNextPage, infiniteQuery.data?.pages, bidirectional.enabled]);

  const actualHasPreviousPage = useMemo(() => {
    if (!bidirectional.enabled) return infiniteQuery.hasPreviousPage;

    const currentPages = infiniteQuery.data?.pages || [];
    if (currentPages.length === 0) return false;

    // Check if we can load previous pages (not at the very beginning)
    const firstPage = currentPages[0];
    return firstPage ? firstPage.pageIndex > 0 : false;
  }, [infiniteQuery.hasPreviousPage, infiniteQuery.data?.pages, bidirectional.enabled]);

  // Get stored global offset for row indexing
  const globalOffset = useMemo(() => {
    if (!bidirectional.enabled) return 0;
    return slidingWindowRef.current.globalOffset;
  }, [bidirectional.enabled, slidingWindowRef.current.globalOffset]);

  // Enhanced return object with bidirectional capabilities
  const bidirectionalInfo = useMemo(
    () => ({
      windowStart: slidingWindowRef.current.windowStart,
      windowEnd: slidingWindowRef.current.windowEnd,
      isAtStart: !actualHasPreviousPage,
      isAtEnd: !actualHasNextPage,
      pagesInMemory: infiniteQuery.data?.pages?.length || 0,
      maxPagesInMemory: bidirectional.maxPagesInMemory,
      globalOffset, // Add global offset for row indexing
    }),
    [
      slidingWindowRef.current.windowStart,
      slidingWindowRef.current.windowEnd,
      actualHasPreviousPage,
      actualHasNextPage,
      infiniteQuery.data?.pages?.length,
      bidirectional.maxPagesInMemory,
      globalOffset,
    ]
  );

  const enhancedQuery = useMemo(() => {
    return {
      ...infiniteQuery,
      hasNextPage: actualHasNextPage,
      hasPreviousPage: actualHasPreviousPage,
      fetchNextPage: fetchNextPageBidirectional,
      fetchPreviousPage: fetchPreviousPageBidirectional,
      // Additional bidirectional info
      bidirectionalInfo,
    };
  }, [
    infiniteQuery,
    actualHasNextPage,
    actualHasPreviousPage,
    fetchNextPageBidirectional,
    fetchPreviousPageBidirectional,
    bidirectionalInfo,
  ]);

  const hookTime = performance.now() - tHookStart;
  perfLog(
    `[perf] useInfiniteLogsQuery(${tileId}) – completed (next: ${actualHasNextPage}, prev: ${actualHasPreviousPage}, bidirectional: ${bidirectional.enabled}) – ${hookTime.toFixed(1)}ms`
  );
  return enhancedQuery;
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
  groupLimit,
  logsActions,
  updateLogs,
  onGroupOffsetChange,
  groupId,
  dataTypes,
  fields,
  enabled = true,
  bidirectional = {
    enabled: false,
    maxPagesInMemory: 5,
    enableBackwardLoading: true,
    enableForwardLoading: true,
  },
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
  groupLimit: number;
  logsActions: LogsActions;
  updateLogs?: (
    logsData: LogsResponseProps,
    mode: 'replace' | 'append' | 'prepend',
    targetGroupId?: string | null,
    targetGroupFilters?: [string, string][],
    preConvertedLogs?: GroupedLogProps[] | LogProps[],
    windowConfig?: {
      maxPagesInMemory: number;
      pageSize: number;
      currentPageCount: number;
    },
    currentOffsets?: { globalOffset: number; groupOffset: number }
  ) => { globalOffset: number; groupOffset: number };
  onGroupOffsetChange?: (groupId: string | undefined, offset: number) => void;
  groupId: string; // Full group path like "column1:value1>column2:value2"
  dataTypes: { [key: string]: string };
  fields: LogFieldsResponseProps;
  enabled?: boolean;
  bidirectional?: BidirectionalConfig;
}) {
  const tGroupHookStart = performance.now();
  const queryClient = useQueryClient();

  // Get table tile actions for offset management
  const { tableTileActions } = useTableTile(tileId, tabId);

  // For group-specific queries, we always use group pagination
  const useGroupPagination = true;

  const queryKey = useMemo(
    () =>
      buildLogQueryKey(
        'group-specific',
        {
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
          groupLimit,
        },
        {
          groupId,
          dataTypes,
          fields,
        }
      ),
    [
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
      groupLimit,
      groupId,
      dataTypes,
      fields,
    ]
  );

  // Register this query key with the table tile for cleanup
  const queryKeyString = useMemo(() => JSON.stringify(queryKey), [queryKey]);

  useEffect(() => {
    if (tableTileActions?.addInfiniteQueryKey && enabled) {
      keyLog(
        `[queryKey] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – ADDING infinite query key:`,
        queryKeyString
      );
      tableTileActions.addInfiniteQueryKey(queryKeyString);
    } else {
      keyLog(
        `[queryKey] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – NOT adding query key (actions: ${!!tableTileActions?.addInfiniteQueryKey}, enabled: ${enabled})`
      );
    }
  }, [tableTileActions, queryKeyString, enabled, tileId, groupId]);

  // Bidirectional page management state for groups
  const groupSlidingWindowRef = useRef({
    windowStart: 0,
    windowEnd: 0,
    totalPagesLoaded: 0,
    groupOffset: 0, // Store the calculated group offset here
  });

  // Reset sliding window bookkeeping for group-specific queries when the parent disables the query.
  useEffect(() => {
    if (!enabled) {
      groupSlidingWindowRef.current = {
        windowStart: 0,
        windowEnd: 0,
        totalPagesLoaded: 0,
        groupOffset: 0,
      };
    }
  }, [enabled]);

  const groupInfiniteQuery = useInfiniteQuery<
    InfiniteGroupSpecificPage,
    Error,
    InfiniteData<InfiniteGroupSpecificPage>,
    typeof queryKey,
    number
  >({
    queryKey,
    initialPageParam: 0,
    queryFn: async ({
      pageParam,
      direction = 'forward',
    }: {
      pageParam: number;
      direction?: 'forward' | 'backward';
    }): Promise<InfiniteGroupSpecificPage> => {
      const tGroupQueryFnStart = performance.now();

      if (!projectId) {
        throw new Error('Project ID is required');
      }

      // Smart skip logic: Only skip page 0 on initial load, not on bidirectional scroll
      const existingInfiniteData = queryClient.getQueryData(queryKey) as
        | { pages?: InfiniteGroupSpecificPage[] }
        | undefined;
      const hasExistingPages = existingInfiniteData?.pages && existingInfiniteData.pages.length > 0;
      const isBidirectionalScroll = hasExistingPages && pageParam === 0;
      const isInitialPageZero = pageParam === 0 && !isBidirectionalScroll;

      // Parse groupId to get the last group info
      const { groupingColumnId, groupingValue, parentId } = decomposeGroupId(groupId);

      if (isInitialPageZero) {
        // Check if we have tableDataItem data to use (from onGroupExpand calls)
        const existingTableData = queryClient.getQueryData<TableDataItem>([
          'tableDataItem',
          tileId,
        ]);
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
              pageIndex: pageParam,
              direction,
              data: groupData.subRows || [],
            };
            perfLog(
              `[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – page ${pageParam} served from cache (${groupData.currentCount} subrows, hasMore: ${result.hasMore}) – ${(performance.now() - tGroupQueryFnStart).toFixed(2)}ms`
            );
            return result;
          } else {
            // If no group data is found, return an empty result
            perfLog(
              `[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – page ${pageParam} served from cache (no group data found) – ${(performance.now() - tGroupQueryFnStart).toFixed(2)}ms`
            );
            return {
              hasMore: false,
              totalCount: 0,
              currentCount: 0,
              pageIndex: pageParam,
              direction,
              data: [],
            };
          }
        }
      }

      // Calculate offsets for group-specific queries with direction support
      let offset: number;
      let groupOffset: number;

      if (direction === 'backward') {
        // For backward loading, we need to calculate offset from the beginning
        // pageParam for backward will be negative
        const absolutePageParam = Math.abs(pageParam);
        offset = Math.max(0, absolutePageParam * limit);
        groupOffset = Math.max(0, absolutePageParam * groupLimit);
      } else {
        // Forward loading (existing logic)
        offset = pageParam * limit;
        groupOffset = pageParam * groupLimit;
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
        groupLimit,
        groupOffset: groupOffset,
        logsActions,
        groupId,
        groupingColumnId,
        groupingValue,
        parentId,
        dataTypes,
        fields,
      };

      const result = await fetchLogsCore(coreParams);
      const fetchTime = performance.now() - tGroupCoreFetch;

      // Update the table data using updateLogs with group context
      const tGroupUpdateStart = performance.now();
      if (updateLogs) {
        let mode: 'append' | 'prepend';
        if (direction === 'backward') {
          mode = 'prepend';
        } else {
          mode = 'append';
        }

        // For groups, we typically don't need aggressive windowing since each group has smaller datasets
        // But we can still pass windowConfig for consistency
        const currentPages = queryClient.getQueryData(queryKey) as
          | { pages?: InfiniteGroupSpecificPage[] }
          | undefined;
        const currentPageCount = currentPages?.pages?.length || 0;

        const windowConfig = bidirectional.enabled
          ? {
              maxPagesInMemory: bidirectional.maxPagesInMemory,
              pageSize: result.effectiveLimit,
              currentPageCount: currentPageCount + 1, // +1 because we're adding a new page
            }
          : undefined;

        // Update logs and get calculated offsets
        const currentGroupOffset = bidirectional.enabled
          ? groupSlidingWindowRef.current.groupOffset
          : 0;
        const { groupOffset: calculatedGroupOffset } = updateLogs(
          result.response,
          mode,
          groupId,
          result.targetGroupFilters,
          result.convertedLogs,
          windowConfig,
          { globalOffset: 0, groupOffset: currentGroupOffset }
        );

        // Store the calculated group offset for row indexing
        if (bidirectional.enabled) {
          groupSlidingWindowRef.current.groupOffset = calculatedGroupOffset;
          onGroupOffsetChange?.(groupId, calculatedGroupOffset);
        }
      }
      const updateTime = performance.now() - tGroupUpdateStart;

      const finalResult = {
        hasMore: result.hasMore,
        totalCount: result.totalCount,
        currentCount: result.currentCount,
        pageIndex: pageParam,
        direction,
        data: result.convertedLogs,
      };

      const totalTime = performance.now() - tGroupQueryFnStart;
      const groupPath = groupId.split('>').length;
      perfLog(
        `[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – page ${pageParam} (${direction}) fetched (${result.convertedLogs.length} logs processed, depth ${groupPath}) – fetch: ${fetchTime.toFixed(1)}ms, update: ${updateTime.toFixed(1)}ms, total: ${totalTime.toFixed(1)}ms`
      );
      return finalResult;
    },
    getNextPageParam: (lastPage) => {
      if (!bidirectional.enabled || !bidirectional.enableForwardLoading) return undefined;
      return lastPage.hasMore ? lastPage.pageIndex + 1 : undefined;
    },
    getPreviousPageParam:
      bidirectional.enabled && bidirectional.enableBackwardLoading
        ? (firstPage) => {
            // Only allow backward loading if we're not at the very beginning
            return firstPage.pageIndex > 0 ? firstPage.pageIndex - 1 : undefined;
          }
        : undefined,
    maxPages: bidirectional.enabled ? bidirectional.maxPagesInMemory : undefined,
    enabled: enabled && !!projectId && !!tileId && !!tabId && !!groupId && !!dataTypes && !!fields,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  // Custom hooks for bidirectional group loading
  const fetchNextPageGroupBidirectional = useCallback(async () => {
    if (!bidirectional.enabled || !bidirectional.enableForwardLoading) {
      return groupInfiniteQuery.fetchNextPage();
    }

    // Let TanStack Query handle the sliding window via maxPages
    // The actual log removal is handled by updateLogs with windowConfig
    const result = await groupInfiniteQuery.fetchNextPage();

    // Update window tracking
    if (result.data?.pages) {
      groupSlidingWindowRef.current.windowEnd =
        groupSlidingWindowRef.current.windowStart + result.data.pages.length - 1;
      groupSlidingWindowRef.current.totalPagesLoaded = Math.max(
        groupSlidingWindowRef.current.totalPagesLoaded,
        groupSlidingWindowRef.current.windowEnd + 1
      );
    }

    return result;
  }, [groupInfiniteQuery, bidirectional]);

  const fetchPreviousPageGroupBidirectional = useCallback(async () => {
    if (!bidirectional.enabled || !bidirectional.enableBackwardLoading) {
      return Promise.resolve();
    }

    // Let TanStack Query handle the sliding window via maxPages
    // The actual log removal is handled by updateLogs with windowConfig
    const result = await groupInfiniteQuery.fetchPreviousPage();

    // Update window tracking
    if (result.data?.pages) {
      groupSlidingWindowRef.current.windowStart = Math.max(
        0,
        groupSlidingWindowRef.current.windowStart - 1
      );
      groupSlidingWindowRef.current.windowEnd =
        groupSlidingWindowRef.current.windowStart + result.data.pages.length - 1;
    }

    return result;
  }, [groupInfiniteQuery, bidirectional]);

  // Calculate actual page availability for groups
  const actualGroupHasNextPage = useMemo(() => {
    if (!bidirectional.enabled) return groupInfiniteQuery.hasNextPage;

    const currentPages = groupInfiniteQuery.data?.pages || [];
    if (currentPages.length === 0) return false;

    // Check if the last page in our window has more data
    const lastPage = currentPages[currentPages.length - 1];
    return lastPage ? lastPage.hasMore : false;
  }, [groupInfiniteQuery.hasNextPage, groupInfiniteQuery.data?.pages, bidirectional.enabled]);

  const actualGroupHasPreviousPage = useMemo(() => {
    if (!bidirectional.enabled) return groupInfiniteQuery.hasPreviousPage;

    const currentPages = groupInfiniteQuery.data?.pages || [];
    if (currentPages.length === 0) return false;

    // Check if we can load previous pages (not at the very beginning)
    const firstPage = currentPages[0];
    return firstPage ? firstPage.pageIndex > 0 : false;
  }, [groupInfiniteQuery.hasPreviousPage, groupInfiniteQuery.data?.pages, bidirectional.enabled]);

  // Get stored group-specific offset for row indexing
  const groupOffset = useMemo(() => {
    if (!bidirectional.enabled) return 0;
    return groupSlidingWindowRef.current.groupOffset;
  }, [bidirectional.enabled, groupSlidingWindowRef.current.groupOffset]);

  // Enhanced return object with bidirectional capabilities for groups
  const bidirectionalInfo = useMemo(
    () => ({
      windowStart: groupSlidingWindowRef.current.windowStart,
      windowEnd: groupSlidingWindowRef.current.windowEnd,
      isAtStart: !actualGroupHasPreviousPage,
      isAtEnd: !actualGroupHasNextPage,
      pagesInMemory: groupInfiniteQuery.data?.pages?.length || 0,
      maxPagesInMemory: bidirectional.maxPagesInMemory,
      groupOffset, // Add group-specific offset for row indexing
      groupId, // Include groupId for offset mapping
    }),
    [
      groupSlidingWindowRef.current.windowStart,
      groupSlidingWindowRef.current.windowEnd,
      actualGroupHasPreviousPage,
      actualGroupHasNextPage,
      groupInfiniteQuery.data?.pages?.length,
      bidirectional.maxPagesInMemory,
      groupOffset,
      groupId,
    ]
  );

  const enhancedGroupQuery = useMemo(() => {
    return {
      ...groupInfiniteQuery,
      hasNextPage: actualGroupHasNextPage,
      hasPreviousPage: actualGroupHasPreviousPage,
      fetchNextPage: fetchNextPageGroupBidirectional,
      fetchPreviousPage: fetchPreviousPageGroupBidirectional,
      // Additional bidirectional info
      bidirectionalInfo,
    };
  }, [
    groupInfiniteQuery,
    actualGroupHasNextPage,
    actualGroupHasPreviousPage,
    fetchNextPageGroupBidirectional,
    fetchPreviousPageGroupBidirectional,
    bidirectionalInfo,
  ]);

  const groupHookTime = performance.now() - tGroupHookStart;
  const groupDepth = groupId.split('>').length;
  perfLog(
    `[perf] useInfiniteGroupSpecificLogsQuery(${tileId}|${groupId}) – completed (depth ${groupDepth}, next: ${actualGroupHasNextPage}, prev: ${actualGroupHasPreviousPage}, bidirectional: ${bidirectional.enabled}) – ${groupHookTime.toFixed(1)}ms`
  );
  return enhancedGroupQuery;
}
