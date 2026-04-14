/**
 * React hook for the Memory tab — fetches Contacts, Transcripts,
 * Knowledge, and Tasks data from the logging API.
 *
 * Supports server-side sorting, filtering, and incremental loading
 * (infinite scroll). Uses client-side fetch with session cookie auth
 * (same pattern as useContactIdPrefetch) to bypass server action
 * serialization.
 */

import * as React from 'react';
import type {
  MemoryContext,
  MemoryContextData,
  ContactRow,
  TranscriptRow,
  KnowledgeRow,
  TaskRow,
  GuidanceRow,
  FunctionRow,
  MemoryRow,
} from '@/types/assistants/memory';
import { MEMORY_CONTEXTS } from '@/types/assistants/memory';
import {
  fetchMemoryContext,
  fetchKnowledgeTables,
  fetchFunctionsTables,
  buildSortingParam,
  buildSearchFilterExpr,
} from '@/lib/client/memory';

const PAGE_SIZE = 50;

interface UseMemoryDataOptions {
  ownerId: string;
  assistantId: string;
}

interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

interface ContextState<T extends MemoryRow = MemoryRow> {
  rows: T[];
  count: number;
  fields: string[];
  hasMore: boolean;
  sorting: SortState | null;
  filterExpr: string | null;
  searchQuery: string;
}

export interface UseMemoryDataResult {
  contacts: ContextState<ContactRow>;
  transcripts: ContextState<TranscriptRow>;
  knowledge: ContextState<KnowledgeRow>;
  tasks: ContextState<TaskRow>;
  guidance: ContextState<GuidanceRow>;
  functions: ContextState<FunctionRow>;
  isLoading: boolean;
  error: string | null;
  activeContext: MemoryContext;
  setActiveContext: (ctx: MemoryContext) => void;
  sort: (field: string, direction: 'asc' | 'desc') => void;
  search: (query: string) => void;
  clearSearch: () => void;
  loadMore: () => void;
  isLoadingMore: boolean;
  refetch: () => void;
}

function emptyState<T extends MemoryRow>(): ContextState<T> {
  return {
    rows: [],
    count: 0,
    fields: [],
    hasMore: false,
    sorting: null,
    filterExpr: null,
    searchQuery: '',
  };
}

function contextStateFromData<T extends MemoryRow>(
  data: MemoryContextData<T>,
  sorting: SortState | null,
  filterExpr: string | null,
  searchQuery: string
): ContextState<T> {
  return {
    ...data,
    hasMore: data.rows.length < data.count,
    sorting,
    filterExpr,
    searchQuery,
  };
}

type ContextStates = {
  Contacts: ContextState<ContactRow>;
  Transcripts: ContextState<TranscriptRow>;
  Knowledge: ContextState<KnowledgeRow>;
  Tasks: ContextState<TaskRow>;
  Guidance: ContextState<GuidanceRow>;
  Functions: ContextState<FunctionRow>;
};

function fetchForContext(
  ownerId: string,
  assistantId: string,
  context: MemoryContext,
  sorting: SortState | null,
  offset = 0,
  filterExpr?: string | null
) {
  const sortingParam = sorting ? buildSortingParam(sorting.field, sorting.direction) : undefined;

  if (context === 'Knowledge') {
    return fetchKnowledgeTables(ownerId, assistantId);
  }

  if (context === 'Functions') {
    return fetchFunctionsTables(ownerId, assistantId);
  }

  return fetchMemoryContext(ownerId, assistantId, context, {
    limit: PAGE_SIZE,
    offset,
    sorting: sortingParam,
    filterExpr: filterExpr ?? undefined,
  });
}

export function useMemoryData({ ownerId, assistantId }: UseMemoryDataOptions): UseMemoryDataResult {
  const [states, setStates] = React.useState<ContextStates>({
    Contacts: emptyState(),
    Transcripts: emptyState(),
    Knowledge: emptyState(),
    Tasks: emptyState(),
    Guidance: emptyState(),
    Functions: emptyState(),
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeContext, setActiveContext] = React.useState<MemoryContext>('Contacts');

  const fetchAll = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [c, t, k, ta, g, f] = await Promise.all(
        MEMORY_CONTEXTS.map((ctx) => fetchForContext(ownerId, assistantId, ctx, null))
      );

      setStates({
        Contacts: contextStateFromData(c as MemoryContextData<ContactRow>, null, null, ''),
        Transcripts: contextStateFromData(t as MemoryContextData<TranscriptRow>, null, null, ''),
        Knowledge: contextStateFromData(k as MemoryContextData<KnowledgeRow>, null, null, ''),
        Tasks: contextStateFromData(ta as MemoryContextData<TaskRow>, null, null, ''),
        Guidance: contextStateFromData(g as MemoryContextData<GuidanceRow>, null, null, ''),
        Functions: contextStateFromData(f as MemoryContextData<FunctionRow>, null, null, ''),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory data');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, assistantId]);

  React.useEffect(() => {
    setStates({
      Contacts: emptyState(),
      Transcripts: emptyState(),
      Knowledge: emptyState(),
      Tasks: emptyState(),
      Guidance: emptyState(),
      Functions: emptyState(),
    });
    setActiveContext('Contacts');
    fetchAll();
  }, [fetchAll]);

  const sort = React.useCallback(
    async (field: string, direction: 'asc' | 'desc') => {
      if (!ownerId || !assistantId) return;

      const newSorting: SortState = { field, direction };
      const current = states[activeContext];

      setStates((prev) => ({
        ...prev,
        [activeContext]: { ...prev[activeContext], sorting: newSorting },
      }));
      setIsLoading(true);

      try {
        const data = await fetchForContext(
          ownerId,
          assistantId,
          activeContext,
          newSorting,
          0,
          current.filterExpr
        );
        setStates((prev) => ({
          ...prev,
          [activeContext]: contextStateFromData(
            data as any,
            newSorting,
            current.filterExpr,
            current.searchQuery
          ),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sort data');
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId, assistantId, activeContext, states]
  );

  const search = React.useCallback(
    async (query: string) => {
      if (!ownerId || !assistantId) return;

      const trimmed = query.trim();
      const currentFields = states[activeContext].fields;
      const filterExpr = trimmed ? buildSearchFilterExpr(trimmed, currentFields) : null;
      const currentSorting = states[activeContext].sorting;

      setStates((prev) => ({
        ...prev,
        [activeContext]: { ...prev[activeContext], filterExpr, searchQuery: trimmed },
      }));
      setIsLoading(true);

      try {
        const data = await fetchForContext(
          ownerId,
          assistantId,
          activeContext,
          currentSorting,
          0,
          filterExpr
        );
        setStates((prev) => ({
          ...prev,
          [activeContext]: contextStateFromData(data as any, currentSorting, filterExpr, trimmed),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search');
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId, assistantId, activeContext, states]
  );

  const clearSearch = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    const currentSorting = states[activeContext].sorting;

    setStates((prev) => ({
      ...prev,
      [activeContext]: { ...prev[activeContext], filterExpr: null, searchQuery: '' },
    }));
    setIsLoading(true);

    try {
      const data = await fetchForContext(
        ownerId,
        assistantId,
        activeContext,
        currentSorting,
        0,
        null
      );
      setStates((prev) => ({
        ...prev,
        [activeContext]: contextStateFromData(data as any, currentSorting, null, ''),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear search');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, assistantId, activeContext, states]);

  const loadMore = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    const current = states[activeContext];
    if (!current.hasMore || isLoadingMore) return;

    // Sub-context merges don't support offset-based paging
    if (activeContext === 'Knowledge' || activeContext === 'Functions') return;

    setIsLoadingMore(true);

    try {
      const offset = current.rows.length;
      const data = await fetchForContext(
        ownerId,
        assistantId,
        activeContext,
        current.sorting,
        offset,
        current.filterExpr
      );

      setStates((prev) => {
        const prevCtx = prev[activeContext];
        const merged = [...prevCtx.rows, ...data.rows];
        const fields = new Set([...prevCtx.fields, ...data.fields]);
        return {
          ...prev,
          [activeContext]: {
            ...prevCtx,
            rows: merged,
            fields: Array.from(fields),
            hasMore: merged.length < data.count,
          } as any,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more data');
    } finally {
      setIsLoadingMore(false);
    }
  }, [ownerId, assistantId, activeContext, states, isLoadingMore]);

  return {
    contacts: states.Contacts,
    transcripts: states.Transcripts,
    knowledge: states.Knowledge,
    tasks: states.Tasks,
    guidance: states.Guidance,
    functions: states.Functions,
    isLoading,
    isLoadingMore,
    error,
    activeContext,
    setActiveContext,
    sort,
    search,
    clearSearch,
    loadMore,
    refetch: fetchAll,
  };
}
