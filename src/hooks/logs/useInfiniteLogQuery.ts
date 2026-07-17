'use client';

import * as React from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  buildLogQuerySpec,
  DEFAULT_LOG_PAGE_SIZE,
  fetchLogFields,
  fetchLogs,
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

  const infiniteQuery = useInfiniteQuery({
    queryKey: [
      'logInfiniteQuery',
      projectName,
      context,
      spec?.filterExpr ?? '',
      spec?.sorting ?? '',
      pageSize,
      columnContext ?? '',
    ],
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
  });

  const rows = React.useMemo(
    () => infiniteQuery.data?.pages.flatMap((page) => page.rows) ?? [],
    [infiniteQuery.data]
  );

  const count = infiniteQuery.data?.pages.at(-1)?.count ?? 0;

  return {
    rows,
    count,
    fields,
    isLoading: (!fieldsOverride && fieldsQuery.isLoading) || infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    hasNextPage: !!infiniteQuery.hasNextPage,
    fetchNextPage: () => {
      if (infiniteQuery.hasNextPage && !infiniteQuery.isFetchingNextPage) {
        void infiniteQuery.fetchNextPage();
      }
    },
    error: (infiniteQuery.error ?? fieldsQuery.error) as Error | null,
    refetch: () => {
      void fieldsQuery.refetch();
      void infiniteQuery.refetch();
    },
    spec,
  };
}
