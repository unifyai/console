/**
 * React hook for the Memory tab — fetches Contacts, Transcripts,
 * Knowledge, and Tasks data from the logging API.
 *
 * Supports server-side sorting and incremental loading (infinite scroll).
 * Uses client-side fetch with session cookie auth (same pattern as
 * useContactIdPrefetch) to bypass server action serialization.
 */

import * as React from 'react';
import type {
  MemoryContext,
  MemoryContextData,
  ContactRow,
  TranscriptRow,
  KnowledgeRow,
  TaskRow,
  MemoryRow,
} from '@/types/assistants/memory';
import { MEMORY_CONTEXTS } from '@/types/assistants/memory';
import { fetchMemoryContext, fetchKnowledgeTables, buildSortingParam } from '@/lib/client/memory';

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
}

export interface UseMemoryDataResult {
  contacts: ContextState<ContactRow>;
  transcripts: ContextState<TranscriptRow>;
  knowledge: ContextState<KnowledgeRow>;
  tasks: ContextState<TaskRow>;
  isLoading: boolean;
  error: string | null;
  activeContext: MemoryContext;
  setActiveContext: (ctx: MemoryContext) => void;
  sort: (field: string, direction: 'asc' | 'desc') => void;
  loadMore: () => void;
  isLoadingMore: boolean;
  refetch: () => void;
}

function emptyState<T extends MemoryRow>(): ContextState<T> {
  return { rows: [], count: 0, fields: [], hasMore: false, sorting: null };
}

function contextStateFromData<T extends MemoryRow>(
  data: MemoryContextData<T>,
  sorting: SortState | null
): ContextState<T> {
  return {
    ...data,
    hasMore: data.rows.length < data.count,
    sorting,
  };
}

type ContextStates = {
  Contacts: ContextState<ContactRow>;
  Transcripts: ContextState<TranscriptRow>;
  Knowledge: ContextState<KnowledgeRow>;
  Tasks: ContextState<TaskRow>;
};

function fetchForContext(
  ownerId: string,
  assistantId: string,
  context: MemoryContext,
  sorting: SortState | null,
  offset = 0
) {
  const sortingParam = sorting ? buildSortingParam(sorting.field, sorting.direction) : undefined;

  if (context === 'Knowledge') {
    return fetchKnowledgeTables(ownerId, assistantId);
  }

  return fetchMemoryContext(ownerId, assistantId, context, {
    limit: PAGE_SIZE,
    offset,
    sorting: sortingParam,
  });
}

export function useMemoryData({ ownerId, assistantId }: UseMemoryDataOptions): UseMemoryDataResult {
  const [states, setStates] = React.useState<ContextStates>({
    Contacts: emptyState(),
    Transcripts: emptyState(),
    Knowledge: emptyState(),
    Tasks: emptyState(),
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
      const [c, t, k, ta] = await Promise.all(
        MEMORY_CONTEXTS.map((ctx) => fetchForContext(ownerId, assistantId, ctx, null))
      );

      setStates({
        Contacts: contextStateFromData(c as MemoryContextData<ContactRow>, null),
        Transcripts: contextStateFromData(t as MemoryContextData<TranscriptRow>, null),
        Knowledge: contextStateFromData(k as MemoryContextData<KnowledgeRow>, null),
        Tasks: contextStateFromData(ta as MemoryContextData<TaskRow>, null),
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
    });
    setActiveContext('Contacts');
    fetchAll();
  }, [fetchAll]);

  const sort = React.useCallback(
    async (field: string, direction: 'asc' | 'desc') => {
      if (!ownerId || !assistantId) return;

      const newSorting: SortState = { field, direction };

      setStates((prev) => ({
        ...prev,
        [activeContext]: { ...prev[activeContext], rows: [], hasMore: false, sorting: newSorting },
      }));
      setIsLoading(true);

      try {
        const data = await fetchForContext(ownerId, assistantId, activeContext, newSorting);
        setStates((prev) => ({
          ...prev,
          [activeContext]: contextStateFromData(data as any, newSorting),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sort data');
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId, assistantId, activeContext]
  );

  const loadMore = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    const current = states[activeContext];
    if (!current.hasMore || isLoadingMore) return;

    // Knowledge is merged from sub-contexts and doesn't support offset-based paging
    if (activeContext === 'Knowledge') return;

    setIsLoadingMore(true);

    try {
      const offset = current.rows.length;
      const data = await fetchForContext(
        ownerId,
        assistantId,
        activeContext,
        current.sorting,
        offset
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
    isLoading,
    isLoadingMore,
    error,
    activeContext,
    setActiveContext,
    sort,
    loadMore,
    refetch: fetchAll,
  };
}
