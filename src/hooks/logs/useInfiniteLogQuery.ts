'use client';

import * as React from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  buildLogQuerySpec,
  DEFAULT_LOG_PAGE_SIZE,
  fetchLogFields,
  fetchLogs,
  parseGrouping,
  type LogFieldsResponseProps,
  type LogGridRow,
  type LogQuerySpec,
  type LogViewState,
} from '@/lib/logs';

export type UseInfiniteLogQueryArgs = {
  projectName: string;
  context: string | null;
  view: LogViewState;
  /** When fields are already known, skip the fields round-trip on every page. */
  fields?: LogFieldsResponseProps;
  columnContext?: string | null;
  enabled?: boolean;
  /** Page size for each infinite-scroll fetch (defaults to DEFAULT_LOG_PAGE_SIZE). */
  pageSize?: number;
};

export type UseInfiniteLogQueryResult = {
  rows: LogGridRow[];
  count: number;
  fields: LogFieldsResponseProps;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  error: Error | null;
  refetch: () => void;
  spec: LogQuerySpec | null;
};

/**
 * Accumulating log query: loads pages of `pageSize` (default 50) and appends
 * rows as the consumer calls `fetchNextPage` (infinite scroll).
 * When `view.grouping` is set, pages are top-level groups (`groupLimit`/`groupOffset`).
 */
export function useInfiniteLogQuery({
  projectName,
  context,
  view,
  fields: fieldsOverride,
  columnContext,
  enabled = true,
  pageSize = DEFAULT_LOG_PAGE_SIZE,
}: UseInfiniteLogQueryArgs): UseInfiniteLogQueryResult {
  const fieldsQuery = useQuery({
    queryKey: ['logFields', projectName, context],
    queryFn: ({ signal }) => fetchLogFields(projectName, context!, signal),
    enabled: enabled && !!context && !fieldsOverride,
    staleTime: 0,
  });

  const fields = React.useMemo(
    () => fieldsOverride ?? fieldsQuery.data ?? {},
    [fieldsOverride, fieldsQuery.data]
  );

  const groupingKey = parseGrouping(view.grouping).join(',');

  const spec = React.useMemo(() => {
    if (!context) return null;
    return buildLogQuerySpec({
      projectName,
      context,
      view: { ...view, limit: pageSize, offset: 0 },
      fields,
      columnContext,
    });
  }, [projectName, context, view, fields, columnContext, pageSize]);

  const fieldsReady =
    enabled && !!spec && (!!fieldsOverride || fieldsQuery.isSuccess || fieldsQuery.isFetched);

  const infiniteQueryKey = [
    'logInfiniteQuery',
    projectName,
    context,
    spec?.filter ?? '',
    spec?.sorting ?? '',
    groupingKey,
    pageSize,
    columnContext ?? '',
    view.freeze ?? '',
    !!view.autoUpdate,
  ] as const;

  const infiniteQuery = useInfiniteQuery({
    queryKey: infiniteQueryKey,
    queryFn: ({ pageParam, signal }) =>
      fetchLogs(
        {
          ...spec!,
          limit: pageSize,
          offset: pageParam * pageSize,
        },
        signal
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, page) => n + page.rows.length, 0);
      if (loaded >= lastPage.count) return undefined;
      if (lastPage.rows.length < pageSize) return undefined;
      return allPages.length;
    },
    enabled: fieldsReady,
    // Keep prior pages only within the same grouping mode. Reusing flat rows as
    // placeholder after Group by (or grouped rows after Ungroup) makes the grid
    // look like grouping did nothing aside from reordering columns.
    placeholderData: (previousData, previousQuery) => {
      if (!previousQuery) return previousData;
      // infiniteQueryKey: [id, project, context, filter, sorting, groupingKey, ...]
      const prevGrouping = String(previousQuery.queryKey[5] ?? '');
      if (prevGrouping !== groupingKey) return undefined;
      return previousData;
    },
    refetchInterval: view.autoUpdate ? 5_000 : false,
  });

  const rows = React.useMemo(
    () => infiniteQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [infiniteQuery.data]
  );

  const count = infiniteQuery.data?.pages.at(-1)?.count ?? 0;

  const { refetch: refetchFields } = fieldsQuery;
  const {
    refetch: refetchInfinite,
    fetchNextPage: fetchInfiniteNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = infiniteQuery;

  const fetchNextPage = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchInfiniteNextPage();
    }
  }, [fetchInfiniteNextPage, hasNextPage, isFetchingNextPage]);

  const refetch = React.useCallback(() => {
    void refetchFields();
    void refetchInfinite();
  }, [refetchFields, refetchInfinite]);

  return {
    rows,
    count,
    fields,
    isLoading: (!fieldsOverride && fieldsQuery.isLoading) || infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    hasNextPage: !!infiniteQuery.hasNextPage,
    fetchNextPage,
    error: (infiniteQuery.error ?? fieldsQuery.error) as Error | null,
    refetch,
    spec,
  };
}
