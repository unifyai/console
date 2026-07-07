'use client';

import * as React from 'react';
import type { Assistant } from '@/types/assistants/assistant';
import type { FunctionRow } from '@/types/assistants/brain';
import {
  FUNCTIONS_PAGE_SIZE,
  buildFunctionSearchFilterExpr,
  functionSubContextsForKind,
  listFunctionsPage,
  resolveFunctionsCatalogTotal,
} from '@/lib/client/functions';
import {
  normalizeFunctionSkills,
  type FunctionKindFilter,
  type FunctionSkill,
} from '@/utils/assistants/functions';
import {
  invalidateTabDataCache,
  readTabDataCache,
  writeTabDataCache,
} from '@/lib/assistants/tabDataCache';
import type { ContextRoot } from '@/lib/assistants/scope';

interface SubContextCursor {
  offset: number;
  hasMore: boolean;
  total: number;
}

interface FunctionsCatalogCacheEntry {
  rows: FunctionRow[];
  skills: FunctionSkill[];
  total: number;
  cursors: Record<string, SubContextCursor>;
  hasMoreServer: boolean;
}

interface UseFunctionsCatalogOptions {
  assistant: Assistant;
  kind: FunctionKindFilter;
  query?: string;
  /** Scope override: a team root reads `Teams/{id}/Functions/…`. */
  root?: ContextRoot | null;
  enabled?: boolean;
}

function resolveCatalogTotalFromPages(
  pageResults: Array<{ count: number }>,
  loadedCount: number,
  hasMoreServer: boolean
): number {
  const reported = pageResults.reduce((sum, page) => sum + page.count, 0);
  if (!hasMoreServer) return loadedCount;
  return Math.max(reported, loadedCount);
}

function mergeFunctionRows(existing: FunctionRow[], incoming: FunctionRow[]): FunctionRow[] {
  const seen = new Set<string>();
  const merged: FunctionRow[] = [];
  for (const row of [...existing, ...incoming]) {
    const raw = row as Record<string, unknown>;
    const table = String(raw._table ?? '');
    const id = raw.functionId ?? raw.function_id ?? raw.name ?? '';
    const key = `${table}:${String(id)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  merged.sort((a, b) => {
    const left = String((a as Record<string, unknown>).name ?? '');
    const right = String((b as Record<string, unknown>).name ?? '');
    return left.localeCompare(right);
  });
  return merged;
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
  const subContexts = React.useMemo(() => functionSubContextsForKind(kind), [kind]);
  const rootCacheKey = root?.kind === 'team' ? `team-${root.teamId}` : 'personal';
  const cacheKey = `${assistant.userId}:${assistant.agentId}:functionsCatalog:${kind}:${rootCacheKey}:${trimmedQuery}`;
  const initialCachedCatalog = readTabDataCache<FunctionsCatalogCacheEntry>(cacheKey);
  const [rows, setRows] = React.useState<FunctionRow[]>(initialCachedCatalog?.rows ?? []);
  const [skills, setSkills] = React.useState<FunctionSkill[]>(initialCachedCatalog?.skills ?? []);
  const [total, setTotal] = React.useState(initialCachedCatalog?.total ?? 0);
  const [isLoading, setIsLoading] = React.useState(enabled && !initialCachedCatalog);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(!!initialCachedCatalog);
  const [error, setError] = React.useState<string | null>(null);
  const [cursors, setCursors] = React.useState<Record<string, SubContextCursor>>(
    initialCachedCatalog?.cursors ?? {}
  );
  const [hasMoreServer, setHasMoreServer] = React.useState(
    initialCachedCatalog?.hasMoreServer ?? false
  );
  const isLoadingMoreRef = React.useRef(false);
  const cursorsRef = React.useRef(cursors);
  const hasMoreServerRef = React.useRef(hasMoreServer);
  const isLoadingRef = React.useRef(isLoading);
  const rowsRef = React.useRef(rows);
  cursorsRef.current = cursors;
  hasMoreServerRef.current = hasMoreServer;
  isLoadingRef.current = isLoading;
  rowsRef.current = rows;

  const hasMore = hasLoaded && hasMoreServer;

  React.useEffect(() => {
    const cached = readTabDataCache<FunctionsCatalogCacheEntry>(cacheKey);
    if (!cached) return;
    setRows(cached.rows);
    setSkills(cached.skills);
    setTotal(cached.total);
    setCursors(cached.cursors);
    setHasMoreServer(cached.hasMoreServer);
    setHasLoaded(true);
    setError(null);
    setIsLoading(false);
  }, [cacheKey]);

  const assistantRef = React.useRef(assistant);
  assistantRef.current = assistant;
  const assistantAgentId = assistant.agentId;
  const assistantUserId = assistant.userId;

  const fetchCatalog = React.useCallback(async () => {
    if (!enabled || !assistantAgentId || !assistantUserId) return;
    setIsLoading(true);
    setIsLoadingMore(false);
    setHasLoaded(false);
    setError(null);
    setRows([]);
    setSkills([]);
    setCursors({});
    setHasMoreServer(false);
    isLoadingMoreRef.current = false;

    try {
      const pageResults = await Promise.all(
        subContexts.map((subContext) =>
          listFunctionsPage({
            assistant: assistantRef.current,
            subContext,
            limit: FUNCTIONS_PAGE_SIZE,
            offset: 0,
            filterExpr: searchFilter,
            root: root ?? undefined,
          })
        )
      );

      const catalogTotal = searchFilter
        ? 0
        : await resolveFunctionsCatalogTotal({
            assistant: assistantRef.current,
            kind,
            root: root ?? undefined,
          });

      const nextCursors: Record<string, SubContextCursor> = {};
      const mergedRows: FunctionRow[] = [];
      for (let index = 0; index < subContexts.length; index += 1) {
        const subContext = subContexts[index];
        const page = pageResults[index];
        nextCursors[subContext] = {
          offset: page.rows.length,
          hasMore: page.hasMore,
          total: page.count,
        };
        mergedRows.push(...page.rows);
      }

      const dedupedRows = mergeFunctionRows([], mergedRows);
      const hasMore = Object.values(nextCursors).some((cursor) => cursor.hasMore);
      const nextSkills = normalizeFunctionSkills(dedupedRows);
      const nextTotal = searchFilter
        ? resolveCatalogTotalFromPages(pageResults, dedupedRows.length, hasMore)
        : Math.max(catalogTotal, dedupedRows.length);
      setCursors(nextCursors);
      setRows(dedupedRows);
      setSkills(nextSkills);
      setTotal(nextTotal);
      setHasMoreServer(hasMore);
      setHasLoaded(true);
      writeTabDataCache<FunctionsCatalogCacheEntry>(cacheKey, {
        rows: dedupedRows,
        skills: nextSkills,
        total: nextTotal,
        cursors: nextCursors,
        hasMoreServer: hasMore,
      });
    } catch (fetchError) {
      console.error('[useFunctionsCatalog] Failed to load functions catalog', fetchError);
      setError('Could not load functions. Please try again.');
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [assistantAgentId, assistantUserId, enabled, kind, searchFilter, subContexts, cacheKey, root]);

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
    const pendingContexts = subContexts.filter(
      (subContext) => cursorsRef.current[subContext]?.hasMore
    );
    if (pendingContexts.length === 0) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const pageResults = await Promise.all(
        pendingContexts.map((subContext) =>
          listFunctionsPage({
            assistant: assistantRef.current,
            subContext,
            limit: FUNCTIONS_PAGE_SIZE,
            offset: cursorsRef.current[subContext]?.offset ?? 0,
            filterExpr: searchFilter,
            root: root ?? undefined,
          })
        )
      );

      const nextCursors = { ...cursorsRef.current };
      pendingContexts.forEach((subContext, index) => {
        const page = pageResults[index];
        const prior = nextCursors[subContext] ?? { offset: 0, hasMore: false, total: 0 };
        nextCursors[subContext] = {
          offset: prior.offset + page.rows.length,
          hasMore: page.hasMore,
          total: Math.max(prior.total, page.count),
        };
      });
      setCursors(nextCursors);
      const stillHasMore = Object.values(nextCursors).some((cursor) => cursor.hasMore);
      setHasMoreServer(stillHasMore);

      const incoming = pageResults.flatMap((page) => page.rows);
      const merged = mergeFunctionRows(rowsRef.current, incoming);
      const nextSkills = normalizeFunctionSkills(merged);
      setRows(merged);
      setSkills(nextSkills);
      setTotal((prev) => {
        if (searchFilter) {
          const nextTotal = (() => {
            if (!stillHasMore) return merged.length;
            const reported = pageResults.reduce((sum, page) => sum + page.count, 0);
            return Math.max(prev, merged.length, reported);
          })();
          writeTabDataCache<FunctionsCatalogCacheEntry>(cacheKey, {
            rows: merged,
            skills: nextSkills,
            total: nextTotal,
            cursors: nextCursors,
            hasMoreServer: stillHasMore,
          });
          return nextTotal;
        }
        const nextTotal = Math.max(
          prev,
          merged.length,
          ...Object.values(nextCursors).map((cursor) => cursor.total)
        );
        writeTabDataCache<FunctionsCatalogCacheEntry>(cacheKey, {
          rows: merged,
          skills: nextSkills,
          total: nextTotal,
          cursors: nextCursors,
          hasMoreServer: stillHasMore,
        });
        return nextTotal;
      });
    } catch (loadError) {
      console.error('[useFunctionsCatalog] Failed to load more functions', loadError);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [assistantAgentId, assistantUserId, enabled, searchFilter, subContexts, cacheKey, root]);

  return {
    skills,
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
