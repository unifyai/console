import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardPaneData, DashboardRecord, TileRecord } from '@/types/assistants/dashboard';
import type { Assistant } from '@/types/assistants/assistant';

interface UseDashboardsOptions {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  getMetadata: (assistant: Assistant) => Promise<DashboardPaneData>;
  getTileContent: (assistant: Assistant, tileToken: string) => Promise<string | null>;
  shouldPoll: boolean;
}

interface UseDashboardsResult {
  dashboards: DashboardRecord[];
  tiles: TileRecord[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  dataUpdatedAt: number;
  /**
   * Lazily fetches a tile's htmlContent. Returns cached HTML if available,
   * otherwise fetches from the server and caches the result.
   */
  getTileHtml: (token: string) => Promise<string | null>;
}

export function useDashboards({
  assistant,
  ownerId,
  assistantId,
  getMetadata,
  getTileContent,
  shouldPoll,
}: UseDashboardsOptions): UseDashboardsResult {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery<DashboardPaneData>({
    queryKey: ['dashboards', ownerId, assistantId],
    queryFn: () => getMetadata(assistant),
    refetchInterval: shouldPoll ? 5000 : false,
    enabled: !!ownerId && !!assistantId,
  });

  const dashboards = React.useMemo(() => data?.dashboards ?? [], [data?.dashboards]);
  const tiles = React.useMemo(() => data?.tiles ?? [], [data?.tiles]);

  // HTML content cache: token -> htmlContent
  const htmlCacheRef = React.useRef<Map<string, string>>(new Map());
  // Track updatedAt per token so we can invalidate on change
  const updatedAtCacheRef = React.useRef<Map<string, string | null>>(new Map());
  // In-flight fetch deduplication
  const pendingRef = React.useRef<Map<string, Promise<string | null>>>(new Map());

  // Invalidate cache entries when updatedAt changes
  React.useEffect(() => {
    for (const tile of tiles) {
      const prevUpdatedAt = updatedAtCacheRef.current.get(tile.token);
      if (prevUpdatedAt !== undefined && prevUpdatedAt !== tile.updatedAt) {
        htmlCacheRef.current.delete(tile.token);
      }
      updatedAtCacheRef.current.set(tile.token, tile.updatedAt);
    }
  }, [tiles]);

  const getTileHtml = React.useCallback(
    async (token: string): Promise<string | null> => {
      if (!token || token === 'undefined') return null;

      const cached = htmlCacheRef.current.get(token);
      if (cached !== undefined) return cached;

      const pending = pendingRef.current.get(token);
      if (pending) return pending;

      const promise = getTileContent(assistant, token).then((html) => {
        pendingRef.current.delete(token);
        if (html) htmlCacheRef.current.set(token, html);
        return html;
      });

      pendingRef.current.set(token, promise);
      return promise;
    },
    [assistant, getTileContent]
  );

  return {
    dashboards,
    tiles,
    isLoading,
    error: error as Error | null,
    refetch,
    dataUpdatedAt,
    getTileHtml,
  };
}
