import React from 'react';
import { useInfiniteGroupSpecificLogsQuery } from '@/hooks/Interfaces/Query/useInfiniteLogsQuery';
import { LogsActions } from '@/types/interfaces/grid';
import { LogFieldsResponseProps, LogsResponseProps } from '@/types/interfaces/logs';
import LoadMore, { LoadMoreProps } from './LoadMore';
import { useTableDataQueryWithTracking } from '@/hooks/Interfaces/Query/useTableDataQuery';

interface GroupLoadMoreProps {
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
  groupId: string; // Full group path like "column1:value1>column2:value2"
  dataTypes: { [key: string]: string };
  fields: LogFieldsResponseProps;
  
  // Update function
  updateLogs?: (
    logsData: LogsResponseProps,
    mode?: "replace" | "append",
    targetGroupId?: string | null,
    targetGroupFilters?: [string, string][]
  ) => void;
  
  // UI parameters
  colSpan: number;
  interactive?: boolean;
  hasNextPage?: boolean; // External hasNextPage calculation
  
  // LoadMore component override
  LoadMoreComponent?: React.ComponentType<LoadMoreProps>;
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
  updateLogs,
  colSpan,
  interactive = true,
  hasNextPage: externalHasNextPage,
  LoadMoreComponent = LoadMore,
}: GroupLoadMoreProps) {
  const { tableData: tableDataItem } = useTableDataQueryWithTracking(tileId || null, tabId || null);
  const isTableDataLoading = tableDataItem?.isLoading;
  const {
    hasNextPage: queryHasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isError,
  } = useInfiniteGroupSpecificLogsQuery({
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
    enabled: !isTableDataLoading,
  });

  // Combine external and query hasNextPage
  const hasNextPage = externalHasNextPage || queryHasNextPage;

  // Only render if there are more pages to load or currently fetching
  if (!hasNextPage && !isFetchingNextPage) {
    return null;
  }

  // Render the LoadMore component with group-specific infinite query
  return (
    <LoadMoreComponent
      onLoadMore={() => fetchNextPage()}
      isLoading={isFetchingNextPage}
      hasNextPage={hasNextPage}
      colSpan={colSpan}
      asTableRow={true}
      interactive={interactive}
    />
  );
} 