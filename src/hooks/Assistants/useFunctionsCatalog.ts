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

interface SubContextCursor {
  offset: number;
  hasMore: boolean;
  total: number;
}

interface UseFunctionsCatalogOptions {
  assistant: Assistant;
  kind: FunctionKindFilter;
  query?: string;
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
  enabled = true,
}: UseFunctionsCatalogOptions) {
  const [rows, setRows] = React.useState<FunctionRow[]>([]);
  const [skills, setSkills] = React.useState<FunctionSkill[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cursors, setCursors] = React.useState<Record<string, SubContextCursor>>({});
  const [hasMoreServer, setHasMoreServer] = React.useState(false);
  const isLoadingMoreRef = React.useRef(false);
  const cursorsRef = React.useRef(cursors);
  const hasMoreServerRef = React.useRef(hasMoreServer);
  const isLoadingRef = React.useRef(isLoading);
  const rowsRef = React.useRef(rows);
  cursorsRef.current = cursors;
  hasMoreServerRef.current = hasMoreServer;
  isLoadingRef.current = isLoading;
  rowsRef.current = rows;

  const trimmedQuery = query.trim();
  const searchFilter = trimmedQuery ? buildFunctionSearchFilterExpr(trimmedQuery) : undefined;
  const subContexts = React.useMemo(() => functionSubContextsForKind(kind), [kind]);
  const hasMore = hasLoaded && hasMoreServer;

  const fetchCatalog = React.useCallback(async () => {
    if (!enabled || !assistant.agentId) return;
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
            assistant,
            subContext,
            limit: FUNCTIONS_PAGE_SIZE,
            offset: 0,
            filterExpr: searchFilter,
          })
        )
      );

      const catalogTotal = searchFilter
        ? 0
        : await resolveFunctionsCatalogTotal({
            assistant,
            kind,
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
      setCursors(nextCursors);
      setRows(dedupedRows);
      setSkills(normalizeFunctionSkills(dedupedRows));
      setTotal(
        searchFilter
          ? resolveCatalogTotalFromPages(pageResults, dedupedRows.length, hasMore)
          : Math.max(catalogTotal, dedupedRows.length)
      );
      setHasMoreServer(hasMore);
      setHasLoaded(true);
    } catch (fetchError) {
      console.error('[useFunctionsCatalog] Failed to load functions catalog', fetchError);
      setError('Could not load functions. Please try again.');
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [assistant, enabled, kind, searchFilter, subContexts]);

  React.useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const loadMore = React.useCallback(async () => {
    if (
      !enabled ||
      !assistant.agentId ||
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
            assistant,
            subContext,
            limit: FUNCTIONS_PAGE_SIZE,
            offset: cursorsRef.current[subContext]?.offset ?? 0,
            filterExpr: searchFilter,
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
      setRows(merged);
      setSkills(normalizeFunctionSkills(merged));
      setTotal((prev) => {
        if (searchFilter) {
          if (!stillHasMore) return merged.length;
          const reported = pageResults.reduce((sum, page) => sum + page.count, 0);
          return Math.max(prev, merged.length, reported);
        }
        return Math.max(
          prev,
          merged.length,
          ...Object.values(nextCursors).map((cursor) => cursor.total)
        );
      });
    } catch (loadError) {
      console.error('[useFunctionsCatalog] Failed to load more functions', loadError);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [assistant, enabled, searchFilter, subContexts]);

  return {
    skills,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    hasLoaded,
    error,
    loadMore,
    refetch: fetchCatalog,
  };
}
