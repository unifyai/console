/**
 * React hook for the Memory tab — fetches Contacts, Transcripts,
 * Knowledge, Guidance, and Functions data from the logging API.
 *
 * Tasks data is managed by the dedicated useTasksData hook.
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
  GuidanceRow,
  FunctionRow,
  MemoryRow,
} from '@/types/assistants/memory';
import type { Assistant } from '@/types/assistants/assistant';
import {
  fetchMemoryContext,
  fetchKnowledgeTables,
  fetchFunctionsTables,
  buildSortingParam,
  buildSearchFilterExpr,
} from '@/lib/client/memory';
import type { ContextRoot } from '@/lib/assistants/scope';

const PAGE_SIZE = 50;

type MemoryTabContext = Exclude<MemoryContext, 'Tasks'>;

interface UseMemoryDataOptions {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  root?: ContextRoot | null;
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
  lastLoadedAt: number | null;
}

export interface UseMemoryDataResult {
  contacts: ContextState<ContactRow>;
  transcripts: ContextState<TranscriptRow>;
  knowledge: ContextState<KnowledgeRow>;
  guidance: ContextState<GuidanceRow>;
  functions: ContextState<FunctionRow>;
  isLoading: boolean;
  error: string | null;
  activeContext: MemoryTabContext;
  setActiveContext: (ctx: MemoryTabContext) => void;
  sort: (field: string, direction: 'asc' | 'desc' | null) => void;
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
    lastLoadedAt: null,
  };
}

function contextStateFromData<T extends MemoryRow>(
  data: MemoryContextData<T>,
  sorting: SortState | null,
  filterExpr: string | null,
  searchQuery: string,
  loadedAt = Date.now()
): ContextState<T> {
  return {
    ...data,
    hasMore: data.rows.length < data.count,
    sorting,
    filterExpr,
    searchQuery,
    lastLoadedAt: loadedAt,
  };
}

type ContextStates = {
  Contacts: ContextState<ContactRow>;
  Transcripts: ContextState<TranscriptRow>;
  Knowledge: ContextState<KnowledgeRow>;
  Guidance: ContextState<GuidanceRow>;
  Functions: ContextState<FunctionRow>;
};

interface FetchForKeyOptions {
  sorting?: SortState | null;
  offset?: number;
  filterExpr?: string | null;
  root?: ContextRoot | null;
}

function fetchForKey(
  assistant: Assistant,
  context: MemoryTabContext,
  { sorting = null, offset = 0, filterExpr = null, root = null }: FetchForKeyOptions = {}
) {
  const sortingParam = sorting ? buildSortingParam(sorting.field, sorting.direction) : undefined;

  if (context === 'Knowledge') {
    return fetchKnowledgeTables(assistant, root);
  }

  if (context === 'Functions') {
    return fetchFunctionsTables(assistant, root);
  }

  return fetchMemoryContext(assistant, context, {
    limit: PAGE_SIZE,
    offset,
    sorting: sortingParam,
    filterExpr: filterExpr ?? undefined,
    root,
  });
}

export function useMemoryData({
  assistant,
  ownerId,
  assistantId,
  root = null,
}: UseMemoryDataOptions): UseMemoryDataResult {
  const [states, setStates] = React.useState<ContextStates>({
    Contacts: emptyState(),
    Transcripts: emptyState(),
    Knowledge: emptyState(),
    Guidance: emptyState(),
    Functions: emptyState(),
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeContext, setActiveContext] = React.useState<MemoryTabContext>('Contacts');
  const identityKey = `${ownerId}:${assistantId}`;
  const previousIdentityKey = React.useRef(identityKey);
  const requestSequence = React.useRef(0);
  const pageRequestSequence = React.useRef(0);

  const nextRequestId = React.useCallback(() => {
    requestSequence.current += 1;
    return requestSequence.current;
  }, []);

  const isLatestRequest = React.useCallback((requestId: number) => {
    return requestSequence.current === requestId;
  }, []);

  const invalidatePageRequests = React.useCallback(() => {
    pageRequestSequence.current += 1;
  }, []);

  const nextPageRequestId = React.useCallback(() => {
    pageRequestSequence.current += 1;
    return pageRequestSequence.current;
  }, []);

  const isLatestPageRequest = React.useCallback((requestId: number) => {
    return pageRequestSequence.current === requestId;
  }, []);

  const fetchAll = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    const requestId = nextRequestId();
    setIsLoading(true);
    setError(null);

    try {
      const [c, t, k, g, f] = await Promise.all([
        fetchForKey(assistant, 'Contacts', { root }),
        fetchForKey(assistant, 'Transcripts', { root }),
        fetchForKey(assistant, 'Knowledge', { root }),
        fetchForKey(assistant, 'Guidance', { root }),
        fetchForKey(assistant, 'Functions', { root }),
      ]);
      if (!isLatestRequest(requestId)) return;

      const loadedAt = Date.now();

      setStates({
        Contacts: contextStateFromData(
          c as MemoryContextData<ContactRow>,
          null,
          null,
          '',
          loadedAt
        ),
        Transcripts: contextStateFromData(
          t as MemoryContextData<TranscriptRow>,
          null,
          null,
          '',
          loadedAt
        ),
        Knowledge: contextStateFromData(
          k as MemoryContextData<KnowledgeRow>,
          null,
          null,
          '',
          loadedAt
        ),
        Guidance: contextStateFromData(
          g as MemoryContextData<GuidanceRow>,
          null,
          null,
          '',
          loadedAt
        ),
        Functions: contextStateFromData(
          f as MemoryContextData<FunctionRow>,
          null,
          null,
          '',
          loadedAt
        ),
      });
    } catch (err) {
      if (isLatestRequest(requestId)) {
        setError(err instanceof Error ? err.message : 'Failed to load memory data');
      }
    } finally {
      if (isLatestRequest(requestId)) {
        setIsLoading(false);
      }
    }
  }, [ownerId, assistantId, assistant, root, nextRequestId, isLatestRequest]);

  React.useEffect(() => {
    setStates({
      Contacts: emptyState(),
      Transcripts: emptyState(),
      Knowledge: emptyState(),
      Guidance: emptyState(),
      Functions: emptyState(),
    });
    if (previousIdentityKey.current !== identityKey) {
      setActiveContext('Contacts');
      previousIdentityKey.current = identityKey;
    }
    invalidatePageRequests();
    setIsLoadingMore(false);
    fetchAll();
  }, [fetchAll, identityKey, invalidatePageRequests]);

  const sort = React.useCallback(
    async (field: string, direction: 'asc' | 'desc' | null) => {
      if (!ownerId || !assistantId) return;

      const newSorting: SortState | null = direction ? { field, direction } : null;
      const current = states[activeContext];

      setStates((prev) => ({
        ...prev,
        [activeContext]: { ...prev[activeContext], rows: [], sorting: newSorting },
      }));
      const requestId = nextRequestId();
      setIsLoading(true);

      try {
        const data = await fetchForKey(assistant, activeContext, {
          sorting: newSorting,
          filterExpr: current.filterExpr,
          root,
        });
        if (!isLatestRequest(requestId)) return;

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
        if (isLatestRequest(requestId)) {
          setError(err instanceof Error ? err.message : 'Failed to sort data');
        }
      } finally {
        if (isLatestRequest(requestId)) {
          setIsLoading(false);
        }
      }
    },
    [ownerId, assistantId, activeContext, states, assistant, root, nextRequestId, isLatestRequest]
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
        [activeContext]: { ...prev[activeContext], rows: [], filterExpr, searchQuery: trimmed },
      }));
      const requestId = nextRequestId();
      setIsLoading(true);

      try {
        const data = await fetchForKey(assistant, activeContext, {
          sorting: currentSorting,
          filterExpr,
          root,
        });
        if (!isLatestRequest(requestId)) return;

        setStates((prev) => ({
          ...prev,
          [activeContext]: contextStateFromData(data as any, currentSorting, filterExpr, trimmed),
        }));
      } catch (err) {
        if (isLatestRequest(requestId)) {
          setError(err instanceof Error ? err.message : 'Failed to search');
        }
      } finally {
        if (isLatestRequest(requestId)) {
          setIsLoading(false);
        }
      }
    },
    [ownerId, assistantId, activeContext, states, assistant, root, nextRequestId, isLatestRequest]
  );

  const clearSearch = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    const currentSorting = states[activeContext].sorting;

    setStates((prev) => ({
      ...prev,
      [activeContext]: { ...prev[activeContext], rows: [], filterExpr: null, searchQuery: '' },
    }));
    const requestId = nextRequestId();
    setIsLoading(true);

    try {
      const data = await fetchForKey(assistant, activeContext, {
        sorting: currentSorting,
        root,
      });
      if (!isLatestRequest(requestId)) return;

      setStates((prev) => ({
        ...prev,
        [activeContext]: contextStateFromData(data as any, currentSorting, null, ''),
      }));
    } catch (err) {
      if (isLatestRequest(requestId)) {
        setError(err instanceof Error ? err.message : 'Failed to clear search');
      }
    } finally {
      if (isLatestRequest(requestId)) {
        setIsLoading(false);
      }
    }
  }, [
    ownerId,
    assistantId,
    activeContext,
    states,
    assistant,
    root,
    nextRequestId,
    isLatestRequest,
  ]);

  const loadMore = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    const current = states[activeContext];
    if (!current.hasMore || isLoadingMore) return;

    if (activeContext === 'Knowledge' || activeContext === 'Functions') return;

    const requestId = nextPageRequestId();
    setIsLoadingMore(true);

    try {
      const offset = current.rows.length;
      const data = await fetchForKey(assistant, activeContext, {
        sorting: current.sorting,
        offset,
        filterExpr: current.filterExpr,
        root,
      });
      if (!isLatestPageRequest(requestId)) return;

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
            lastLoadedAt: Date.now(),
          } as any,
        };
      });
    } catch (err) {
      if (isLatestPageRequest(requestId)) {
        setError(err instanceof Error ? err.message : 'Failed to load more data');
      }
    } finally {
      if (isLatestPageRequest(requestId)) {
        setIsLoadingMore(false);
      }
    }
  }, [
    ownerId,
    assistantId,
    activeContext,
    states,
    isLoadingMore,
    assistant,
    root,
    nextPageRequestId,
    isLatestPageRequest,
  ]);

  const refetch = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    setIsLoading(true);
    setError(null);

    const requestId = nextRequestId();
    try {
      const current = states[activeContext];
      const data = await fetchForKey(assistant, activeContext, {
        sorting: current.sorting,
        filterExpr: current.filterExpr,
        root,
      });
      if (!isLatestRequest(requestId)) return;

      setStates((prev) => ({
        ...prev,
        [activeContext]: contextStateFromData(
          data as any,
          current.sorting,
          current.filterExpr,
          current.searchQuery
        ),
      }));
    } catch (err) {
      if (isLatestRequest(requestId)) {
        setError(err instanceof Error ? err.message : 'Failed to refresh data');
      }
    } finally {
      if (isLatestRequest(requestId)) {
        setIsLoading(false);
      }
    }
  }, [
    ownerId,
    assistantId,
    activeContext,
    states,
    assistant,
    root,
    nextRequestId,
    isLatestRequest,
  ]);

  return {
    contacts: states.Contacts,
    transcripts: states.Transcripts,
    knowledge: states.Knowledge,
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
    refetch,
  };
}
