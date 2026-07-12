/**
 * React hook for the Brain tab — fetches Contacts, Transcripts,
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
  BrainContext,
  BrainContextData,
  ContactRow,
  TranscriptRow,
  KnowledgeRow,
  GuidanceRow,
  FunctionRow,
  BrainRow,
} from '@/types/assistants/brain';
import type { Assistant } from '@/types/assistants/assistant';
import {
  fetchBrainContext,
  fetchKnowledgeClaims,
  fetchFunctionsTables,
  buildSortingParam,
  buildSearchFilterExpr,
} from '@/lib/client/brain';
import type { ContextRoot } from '@/lib/assistants/scope';
import {
  brainRootCacheKey,
  invalidateTabDataCache,
  readTabDataCache,
  writeTabDataCache,
} from '@/lib/assistants/tabDataCache';
import { KNOWLEDGE_DEFAULT_FILTER_EXPR } from '@/utils/assistants/knowledge';

const PAGE_SIZE = 50;
const KNOWLEDGE_PAGE_SIZE = 200;

type BrainTabContext = Exclude<BrainContext, 'Tasks'>;

const ALL_CONTEXTS: readonly BrainTabContext[] = [
  'Contacts',
  'Transcripts',
  'Knowledge',
  'Guidance',
  'Functions',
];

interface UseBrainDataOptions {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  root?: ContextRoot | null;
  /**
   * Which contexts to fetch. Defaults to all five (the legacy aggregate Brain
   * pane). Dedicated Brain views pass a single context so a tab only loads its
   * own data and never blocks the others on the all-context waterfall.
   */
  contexts?: readonly BrainTabContext[];
  /** Initial active context (defaults to the first requested context). */
  initialContext?: BrainTabContext;
  enabled?: boolean;
}

interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

interface ContextState<T = BrainRow> {
  rows: T[];
  count: number;
  fields: string[];
  hasMore: boolean;
  sorting: SortState | null;
  filterExpr: string | null;
  searchQuery: string;
  lastLoadedAt: number | null;
}

export interface UseBrainDataResult {
  contacts: ContextState<ContactRow>;
  transcripts: ContextState<TranscriptRow>;
  knowledge: ContextState<KnowledgeRow>;
  guidance: ContextState<GuidanceRow>;
  functions: ContextState<FunctionRow>;
  hasLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  activeContext: BrainTabContext;
  setActiveContext: (ctx: BrainTabContext) => void;
  sort: (field: string, direction: 'asc' | 'desc' | null) => void;
  search: (query: string) => void;
  clearSearch: () => void;
  loadMore: () => void;
  isLoadingMore: boolean;
  refetch: () => void;
}

function emptyState<T = BrainRow>(): ContextState<T> {
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

function contextStateFromData<T = BrainRow>(
  data: BrainContextData<T>,
  sorting: SortState | null,
  filterExpr: string | null,
  searchQuery: string,
  loadedAt = Date.now()
): ContextState<T> {
  return {
    ...data,
    hasMore: data.hasMore ?? data.rows.length < data.count,
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
  searchQuery?: string;
  root?: ContextRoot | null;
}

function fetchForKey(
  assistant: Assistant,
  context: BrainTabContext,
  {
    sorting = null,
    offset = 0,
    filterExpr = null,
    searchQuery = '',
    root = null,
  }: FetchForKeyOptions = {}
) {
  const sortingParam = sorting ? buildSortingParam(sorting.field, sorting.direction) : undefined;

  if (context === 'Knowledge') {
    return fetchKnowledgeClaims(assistant, {
      root,
      limit: KNOWLEDGE_PAGE_SIZE,
      offset,
      filterExpr: filterExpr ?? KNOWLEDGE_DEFAULT_FILTER_EXPR,
      sorting: sortingParam,
    });
  }

  if (context === 'Functions') {
    void searchQuery;
    void offset;
    return fetchFunctionsTables(assistant, root);
  }

  return fetchBrainContext(assistant, context, {
    limit: PAGE_SIZE,
    offset,
    sorting: sortingParam,
    filterExpr: filterExpr ?? undefined,
    root,
  });
}

function brainCacheKey(
  ownerId: string,
  assistantId: string,
  contextsKey: string,
  root: ContextRoot | null
): string {
  return `${ownerId}:${assistantId}:brain:${contextsKey}:${brainRootCacheKey(root)}`;
}

export function useBrainData({
  assistant,
  ownerId,
  assistantId,
  root = null,
  contexts,
  initialContext,
  enabled = true,
}: UseBrainDataOptions): UseBrainDataResult {
  // Stable signature so inline-array `contexts` props don't retrigger fetches.
  const contextsKey = (contexts ?? ALL_CONTEXTS).join(',');
  const requestedContexts = React.useMemo(
    () => contextsKey.split(',') as BrainTabContext[],
    [contextsKey]
  );
  const defaultContext = initialContext ?? requestedContexts[0];
  const identityKey = `${ownerId}:${assistantId}`;
  const cacheKey = brainCacheKey(ownerId, assistantId, contextsKey, root);
  const initialCachedStates = readTabDataCache<ContextStates>(cacheKey);

  const [states, setStates] = React.useState<ContextStates>({
    Contacts: initialCachedStates?.Contacts ?? emptyState(),
    Transcripts: initialCachedStates?.Transcripts ?? emptyState(),
    Knowledge: initialCachedStates?.Knowledge ?? emptyState(),
    Guidance: initialCachedStates?.Guidance ?? emptyState(),
    Functions: initialCachedStates?.Functions ?? emptyState(),
  });
  const [isLoading, setIsLoading] = React.useState(!initialCachedStates);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeContext, setActiveContext] = React.useState<BrainTabContext>(defaultContext);
  const previousIdentityKey = React.useRef(identityKey);
  const requestSequence = React.useRef(0);
  const pageRequestSequence = React.useRef(0);
  const hasLoaded = requestedContexts.every((context) => states[context].lastLoadedAt !== null);

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
    if (!enabled || !ownerId || !assistantId) return;

    const requestId = nextRequestId();
    setIsLoading(true);
    setError(null);

    try {
      // Fetch only the requested contexts in parallel; a single-context Brain
      // view therefore issues exactly one read and never waits on the others.
      const results = await Promise.all(
        requestedContexts.map((ctx) => fetchForKey(assistant, ctx, { root }))
      );
      if (!isLatestRequest(requestId)) return;

      const loadedAt = Date.now();

      setStates(() => {
        const next: ContextStates = {
          Contacts: emptyState(),
          Transcripts: emptyState(),
          Knowledge: emptyState(),
          Guidance: emptyState(),
          Functions: emptyState(),
        };
        requestedContexts.forEach((ctx, i) => {
          next[ctx] = contextStateFromData(results[i] as any, null, null, '', loadedAt) as any;
        });
        writeTabDataCache(cacheKey, next);
        return next;
      });
    } catch (err) {
      if (isLatestRequest(requestId)) {
        setError(err instanceof Error ? err.message : 'Failed to load brain data');
      }
    } finally {
      if (isLatestRequest(requestId)) {
        setIsLoading(false);
      }
    }
  }, [
    ownerId,
    assistantId,
    enabled,
    assistant,
    root,
    requestedContexts,
    nextRequestId,
    isLatestRequest,
    cacheKey,
  ]);

  const fetchAllRef = React.useRef(fetchAll);
  fetchAllRef.current = fetchAll;

  React.useEffect(() => {
    if (previousIdentityKey.current !== identityKey) {
      setActiveContext(defaultContext);
      previousIdentityKey.current = identityKey;
    }
    invalidatePageRequests();
    setIsLoadingMore(false);

    const cached = readTabDataCache<ContextStates>(cacheKey);
    if (cached) {
      setStates(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (enabled) {
      setIsLoading(true);
      void fetchAllRef.current();
      return;
    }
    setIsLoading(false);
  }, [identityKey, defaultContext, invalidatePageRequests, cacheKey, enabled]);

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
          searchQuery: current.searchQuery,
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
          searchQuery: trimmed,
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
        searchQuery: '',
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

    const requestId = nextPageRequestId();
    setIsLoadingMore(true);

    try {
      const offset =
        activeContext === 'Functions'
          ? current.rows.filter((row) => (row as Record<string, unknown>)._table === 'Integrations')
              .length
          : current.rows.length;
      const data = await fetchForKey(assistant, activeContext, {
        sorting: current.sorting,
        offset,
        filterExpr:
          activeContext === 'Knowledge'
            ? (current.filterExpr ?? KNOWLEDGE_DEFAULT_FILTER_EXPR)
            : current.filterExpr,
        searchQuery: current.searchQuery,
        root,
      });
      if (!isLatestPageRequest(requestId)) return;

      setStates((prev) => {
        const prevCtx = prev[activeContext];
        const merged = [...prevCtx.rows, ...data.rows];
        const deduped: typeof merged = [];
        const seen = new Set<string>();
        for (const row of merged) {
          const raw = row as Record<string, unknown>;
          if (activeContext === 'Knowledge') {
            const id = raw.knowledgeId ?? raw.knowledge_id ?? '';
            const key = `knowledge:${String(id)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            deduped.push(row);
            continue;
          }
          const table = String(raw._table ?? '');
          const id = raw.functionId ?? raw.function_id ?? raw.name ?? '';
          const key = `${table}:${String(id)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(row);
        }
        const fields = new Set([...prevCtx.fields, ...data.fields]);
        const hasMore = data.hasMore ?? deduped.length < data.count;
        const nextCount =
          activeContext === 'Transcripts'
            ? hasMore
              ? Math.max(prevCtx.count, deduped.length + 1)
              : deduped.length
            : activeContext === 'Functions'
              ? deduped.length + (hasMore ? 1 : 0)
              : data.count;
        return {
          ...prev,
          [activeContext]: {
            ...prevCtx,
            rows: deduped,
            fields: Array.from(fields),
            count: nextCount,
            hasMore,
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
    invalidateTabDataCache(cacheKey);
    setStates((prev) => {
      const next = { ...prev };
      requestedContexts.forEach((context) => {
        next[context] = emptyState() as any;
      });
      return next;
    });
    await fetchAllRef.current();
  }, [ownerId, assistantId, cacheKey, requestedContexts]);

  return {
    contacts: states.Contacts,
    transcripts: states.Transcripts,
    knowledge: states.Knowledge,
    guidance: states.Guidance,
    functions: states.Functions,
    hasLoaded,
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
