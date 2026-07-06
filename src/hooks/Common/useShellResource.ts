import * as React from 'react';
import {
  type QueryKey,
  type RefetchOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

const SESSION_RESOURCE_GC_MS = 30 * 60 * 1000;

interface ShellResourceRefreshOptions extends RefetchOptions {
  blocking?: boolean;
}

interface UseShellResourceOptions<TData> {
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  enabled?: boolean;
  initialData?: TData;
  refetchInterval?: number | false;
  staleTime?: number;
  gcTime?: number;
}

/**
 * Shell tabs keep their last settled result visible while later requests run.
 * Skeletons therefore represent first load only; refreshes are exposed
 * separately so panes can show lightweight activity without blanking content.
 */
export function useShellResource<TData>({
  queryKey,
  queryFn,
  enabled = true,
  initialData,
  refetchInterval = false,
  staleTime = Infinity,
  gcTime = SESSION_RESOURCE_GC_MS,
}: UseShellResourceOptions<TData>) {
  const queryClient = useQueryClient();
  const [isBlockingRefresh, setIsBlockingRefresh] = React.useState(false);

  const query = useQuery<TData>({
    queryKey,
    queryFn,
    enabled,
    initialData,
    staleTime,
    gcTime,
    refetchInterval,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const hasSettledOnce =
    query.data !== undefined || query.dataUpdatedAt > 0 || query.errorUpdatedAt > 0;
  const isInitialLoading = enabled && !hasSettledOnce;
  const isRefreshing = enabled && hasSettledOnce && query.isFetching && !isBlockingRefresh;

  const refresh = React.useCallback(
    async ({ blocking = false, ...options }: ShellResourceRefreshOptions = {}) => {
      if (blocking) {
        setIsBlockingRefresh(true);
        queryClient.removeQueries({ queryKey, exact: true });
      }
      try {
        return await query.refetch(options);
      } finally {
        if (blocking) {
          setIsBlockingRefresh(false);
        }
      }
    },
    [query, queryClient, queryKey]
  );

  return {
    data: query.data,
    error: query.error,
    hasSettledOnce,
    isInitialLoading: isInitialLoading || isBlockingRefresh,
    isRefreshing,
    isFetching: query.isFetching,
    dataUpdatedAt: query.dataUpdatedAt,
    refresh,
  };
}
