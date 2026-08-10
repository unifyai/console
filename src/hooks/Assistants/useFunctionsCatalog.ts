'use client';

import * as React from 'react';
import type { Assistant } from '@/types/assistants/assistant';
import type { FunctionRow } from '@/types/assistants/brain';
import {
  FUNCTIONS_PAGE_SIZE,
  buildFunctionSearchFilterExpr,
  listFunctionsFederatedPage,
} from '@/lib/client/functions';
import {
  normalizeFunctionEntries,
  type FunctionKindFilter,
  type FunctionEntry,
} from '@/utils/assistants/functions';
import {
  invalidateTabDataCache,
  readTabDataCache,
  writeTabDataCache,
} from '@/lib/assistants/tabDataCache';
import { roots, rootKey, type ContextRoot } from '@/lib/assistants/scope';

interface FunctionsCatalogCacheEntry {
  rows: FunctionRow[];
  functions: FunctionEntry[];
  total: number;
  hasMoreServer: boolean;
}

interface UseFunctionsCatalogOptions {
  assistant: Assistant;
  kind: FunctionKindFilter;
  query?: string;
  /**
   * Scope override: a team root reads `Teams/{id}/Functions/…`; `null` reads
   * every in-scope root (personal + teams) as one merged catalog.
   */
  root?: ContextRoot | null;
  enabled?: boolean;
}

export function useFunctionsCatalog({
  assistant,
  kind,
  query = '',
  root = null,
  enabled = true,
}: UseFunctionsCatalogOptions) {
  const trimmedQuery = query.trim();
  const searchFilter = trimmedQuery ? buildFunctionSearchFilterExpr(trimmedQuery) : undefined;
  const assistantRef = React.useRef(assistant);
  assistantRef.current = assistant;
  const rootRef = React.useRef(root);
  rootRef.current = root;
  const teamIdsKey = (assistant.teamIds ?? []).join(',');
  const rootCacheKey = root ? rootKey(root) : 'all';
  // Key scope identity on strings: `root` is routinely passed as a fresh
  // object literal, and an object dep would refire the fetch every render.
  const scopedRoots = React.useMemo(
    () => (rootRef.current ? [rootRef.current] : roots(assistantRef.current)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rootCacheKey, assistant.userId, assistant.agentId, teamIdsKey]
  );
  const cacheKey = `${assistant.userId}:${assistant.agentId}:functionsCatalog:${kind}:${rootCacheKey}:${trimmedQuery}`;
  const initialCachedCatalog = readTabDataCache<FunctionsCatalogCacheEntry>(cacheKey);
  const [rows, setRows] = React.useState<FunctionRow[]>(initialCachedCatalog?.rows ?? []);
  const [functions, setFunctions] = React.useState<FunctionEntry[]>(
    initialCachedCatalog?.functions ?? []
  );
  const [total, setTotal] = React.useState(initialCachedCatalog?.total ?? 0);
  const [isLoading, setIsLoading] = React.useState(enabled && !initialCachedCatalog);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(!!initialCachedCatalog);
  const [error, setError] = React.useState<string | null>(null);
  const [hasMoreServer, setHasMoreServer] = React.useState(
    initialCachedCatalog?.hasMoreServer ?? false
  );
  const isLoadingMoreRef = React.useRef(false);
  const hasMoreServerRef = React.useRef(hasMoreServer);
  const isLoadingRef = React.useRef(isLoading);
  const rowsRef = React.useRef(rows);
  hasMoreServerRef.current = hasMoreServer;
  isLoadingRef.current = isLoading;
  rowsRef.current = rows;

  const hasMore = hasLoaded && hasMoreServer;

  React.useEffect(() => {
    const cached = readTabDataCache<FunctionsCatalogCacheEntry>(cacheKey);
    if (!cached) return;
    setRows(cached.rows);
    setFunctions(cached.functions);
    setTotal(cached.total);
    setHasMoreServer(cached.hasMoreServer);
    setHasLoaded(true);
    setError(null);
    setIsLoading(false);
  }, [cacheKey]);

  const assistantAgentId = assistant.agentId;
  const assistantUserId = assistant.userId;

  const fetchCatalog = React.useCallback(async () => {
    if (!enabled || !assistantAgentId || !assistantUserId) return;
    setIsLoading(true);
    setIsLoadingMore(false);
    setHasLoaded(false);
    setError(null);
    setRows([]);
    setFunctions([]);
    setHasMoreServer(false);
    isLoadingMoreRef.current = false;

    try {
      const page = await listFunctionsFederatedPage({
        assistant: assistantRef.current,
        kind,
        roots: scopedRoots,
        limit: FUNCTIONS_PAGE_SIZE,
        offset: 0,
        filter: searchFilter,
      });

      const nextFunctions = normalizeFunctionEntries(page.rows);
      setRows(page.rows);
      setFunctions(nextFunctions);
      setTotal(page.count);
      setHasMoreServer(page.hasMore);
      setHasLoaded(true);
      writeTabDataCache<FunctionsCatalogCacheEntry>(cacheKey, {
        rows: page.rows,
        functions: nextFunctions,
        total: page.count,
        hasMoreServer: page.hasMore,
      });
    } catch (fetchError) {
      console.error('[useFunctionsCatalog] Failed to load functions catalog', fetchError);
      setError('Could not load functions. Please try again.');
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [assistantAgentId, assistantUserId, enabled, kind, searchFilter, scopedRoots, cacheKey]);

  React.useEffect(() => {
    const cached = readTabDataCache<FunctionsCatalogCacheEntry>(cacheKey);
    if (cached) return;
    void fetchCatalog();
  }, [cacheKey, fetchCatalog]);

  const loadMore = React.useCallback(async () => {
    if (
      !enabled ||
      !assistantAgentId ||
      !assistantUserId ||
      isLoadingMoreRef.current ||
      isLoadingRef.current ||
      !hasMoreServerRef.current
    ) {
      return;
    }

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const page = await listFunctionsFederatedPage({
        assistant: assistantRef.current,
        kind,
        roots: scopedRoots,
        limit: FUNCTIONS_PAGE_SIZE,
        offset: rowsRef.current.length,
        filter: searchFilter,
      });

      const merged = [...rowsRef.current, ...page.rows];
      const nextFunctions = normalizeFunctionEntries(merged);
      setRows(merged);
      setFunctions(nextFunctions);
      setTotal(page.count);
      setHasMoreServer(merged.length < page.count && page.rows.length > 0);
      writeTabDataCache<FunctionsCatalogCacheEntry>(cacheKey, {
        rows: merged,
        functions: nextFunctions,
        total: page.count,
        hasMoreServer: merged.length < page.count && page.rows.length > 0,
      });
    } catch (loadError) {
      console.error('[useFunctionsCatalog] Failed to load more functions', loadError);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [assistantAgentId, assistantUserId, enabled, kind, searchFilter, scopedRoots, cacheKey]);

  return {
    functions,
    total,
    isLoading: isLoading || (enabled && !hasLoaded),
    isLoadingMore,
    hasMore,
    hasLoaded,
    error,
    loadMore,
    refetch: () => {
      invalidateTabDataCache(cacheKey);
      return fetchCatalog();
    },
  };
}
