import React, { useEffect } from 'react';
import { useInfiniteGroupSpecificLogsQuery } from '@/hooks/Interfaces/Query/useInfiniteLogsQuery';
import { LogsActions } from '@/types/interfaces/grid';
import { LogFieldsResponseProps, LogsResponseProps } from '@/types/interfaces/logs';
import LoadMore, { LoadMoreProps } from './LoadMore';
import { useTileData } from '@/contexts/hooks/tile/useTileData';

export interface GroupLoadMoreProps {
  // Query parameters
  tileId: string;
  tabId: string;
  projectId: string;
  context: string | null;
  columnContext: string | null;
  filterExpression: string | null;
  sortingExpression: string | null;
  groupingExpression: string | null;
  groupSortingExpression: string | null;
  limit: number;
  group_limit: number;
  logsActions: LogsActions;
  
  // Group-specific parameters
  groupId: string | undefined; // Full group path like "column1:value1>column2:value2"
  dataTypes: { [key: string]: string };
  fields: LogFieldsResponseProps;

  // isLoading flag from tableDataItem
  isTableDataLoading: boolean;
  
  // Update function
  updateLogs?: (
    logsData: LogsResponseProps,
    mode: "replace" | "append" | "prepend",
    targetGroupId?: string | null,
    targetGroupFilters?: [string, string][],
    preConvertedLogs?: any[],
    windowConfig?: {
      maxPagesInMemory: number;
      pageSize: number;
      currentPageCount: number;
    },
    currentOffsets?: { globalOffset: number; groupOffset: number }
  ) => { globalOffset: number; groupOffset: number };
  
  // UI parameters
  colSpan: number | undefined;
  interactive?: boolean;
  
  // LoadMore component override
  LoadMoreComponent?: React.ComponentType<LoadMoreProps>;

  // Group-specific hasNextPage and hasPreviousPage calculation
  calculateGroupHasNextPage: (groupId: string | undefined) => boolean;
  
  // Callback for reporting isFetchingNextPage state changes
  onFetchingStateChange?: (isFetchingNextPage: boolean) => void;
  
  // Callback for reporting group offset changes
  onGroupOffsetChange?: (groupId: string | undefined, offset: number) => void;
  
  // Bidirectional loading configuration
  bidirectionalEnabled?: boolean;
  bidirectionalConfig?: {
    maxPagesInMemory: number;
    enableBackwardLoading: boolean;
    enableForwardLoading: boolean;
  };
  
  // Position indicator to determine what to render
  position?: "before" | "after";
}

/**
 * GroupLoadMore component handles infinite loading for a specific group.
 * Each instance manages its own infinite query, following React Query best practices.
 */
export default function GroupLoadMore({
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
  groupId,
  dataTypes,
  fields,
  isTableDataLoading,
  updateLogs,
  colSpan,
  interactive = true,
  calculateGroupHasNextPage,
  LoadMoreComponent = LoadMore,
  onFetchingStateChange,
  onGroupOffsetChange,
  bidirectionalEnabled = false,
  bidirectionalConfig = {
    maxPagesInMemory: 5,
    enableBackwardLoading: true,
    enableForwardLoading: true,
  },
  position = "after", // Default to "after" for backward compatibility
}: GroupLoadMoreProps) {
  const { data: tileDataState } = useTileData(tileId, tabId);
  const autoUpdate = tileDataState?.auto_update === "true";

  const infiniteGroupQuery = useInfiniteGroupSpecificLogsQuery({
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
    onGroupOffsetChange,
    groupId: groupId || "",
    dataTypes,
    fields,
    enabled: !!groupId && !isTableDataLoading && !autoUpdate,
    bidirectional: {
      enabled: bidirectionalEnabled,
      maxPagesInMemory: bidirectionalConfig.maxPagesInMemory,
      enableBackwardLoading: bidirectionalConfig.enableBackwardLoading,
      enableForwardLoading: bidirectionalConfig.enableForwardLoading,
    },
  });

  // Report isFetchingNextPage state changes to parent
  useEffect(() => {
    if (onFetchingStateChange) {
      onFetchingStateChange(infiniteGroupQuery.isFetchingNextPage);
    }
  }, [infiniteGroupQuery.isFetchingNextPage, onFetchingStateChange]);

  // Handle Load Previous rendering
  if (position === "before") {
    const hasPrevPage = infiniteGroupQuery.hasPreviousPage;
    if (!hasPrevPage && !infiniteGroupQuery.isFetchingPreviousPage) {
      return null;
    }
    
    return (
      <LoadMoreComponent
        onLoadMore={infiniteGroupQuery.fetchPreviousPage}
        isLoading={infiniteGroupQuery.isFetchingPreviousPage}
        hasNextPage={hasPrevPage}
        colSpan={colSpan}
        asTableRow={true}
        interactive={interactive}
        buttonText="Load Previous"
        loadingText="Loading previous..."
        disabled={autoUpdate}
      />
    );
  }

  // Handle Load More rendering (default, backward compatible)
  const hasNextPage = calculateGroupHasNextPage(groupId) || infiniteGroupQuery.hasNextPage;
  if (!hasNextPage && !infiniteGroupQuery.isFetchingNextPage) {
    return null;
  }

  return (
    <LoadMoreComponent
      onLoadMore={infiniteGroupQuery.fetchNextPage}
      isLoading={infiniteGroupQuery.isFetchingNextPage}
      hasNextPage={hasNextPage}
      colSpan={colSpan}
      asTableRow={true}
      interactive={interactive}
      buttonText="Load More"
      loadingText="Loading more..."
      disabled={autoUpdate}
    />
  );
} 