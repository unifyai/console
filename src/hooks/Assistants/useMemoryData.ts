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
  TaskActivationRow,
  TaskRunRow,
  TaskMemoryView,
  GuidanceRow,
  FunctionRow,
  MemoryRow,
} from '@/types/assistants/memory';
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
  lastLoadedAt: number | null;
}

export interface UseMemoryDataResult {
  contacts: ContextState<ContactRow>;
  transcripts: ContextState<TranscriptRow>;
  knowledge: ContextState<KnowledgeRow>;
  tasks: ContextState<TaskRow>;
  taskActivations: ContextState<TaskActivationRow>;
  taskRuns: ContextState<TaskRunRow>;
  tasksSnapshotLastLoadedAt: number | null;
  tasksSnapshotHasRunningLiveRun: boolean;
  guidance: ContextState<GuidanceRow>;
  functions: ContextState<FunctionRow>;
  isLoading: boolean;
  error: string | null;
  activeContext: MemoryContext;
  setActiveContext: (ctx: MemoryContext) => void;
  taskView: TaskMemoryView;
  setTaskView: (view: TaskMemoryView) => void;
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

function hasRunningLiveTaskRun(data: MemoryContextData<TaskRunRow>): boolean {
  return data.rows.some((row) => row.state === 'running' && row.executionMode === 'live');
}

type TaskActivationKey = 'Tasks/Activations';
type TaskRunsKey = 'Tasks/Runs';
type MemoryDataKey = MemoryContext | TaskActivationKey | TaskRunsKey;

type ContextStates = {
  Contacts: ContextState<ContactRow>;
  Transcripts: ContextState<TranscriptRow>;
  Knowledge: ContextState<KnowledgeRow>;
  Tasks: ContextState<TaskRow>;
  Guidance: ContextState<GuidanceRow>;
  Functions: ContextState<FunctionRow>;
} & Record<TaskActivationKey, ContextState<TaskActivationRow>> &
  Record<TaskRunsKey, ContextState<TaskRunRow>>;

const TASK_VIEW_TO_KEY: Record<TaskMemoryView, MemoryDataKey> = {
  Definitions: 'Tasks',
  Activations: 'Tasks/Activations',
  Runs: 'Tasks/Runs',
};

function getActiveKey(activeContext: MemoryContext, taskView: TaskMemoryView): MemoryDataKey {
  if (activeContext === 'Tasks') return TASK_VIEW_TO_KEY[taskView];
  return activeContext;
}

function fetchForKey(
  ownerId: string,
  assistantId: string,
  context: MemoryDataKey,
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
    'Tasks/Activations': emptyState(),
    'Tasks/Runs': emptyState(),
    Guidance: emptyState(),
    Functions: emptyState(),
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeContext, setActiveContext] = React.useState<MemoryContext>('Contacts');
  const [taskView, setTaskView] = React.useState<TaskMemoryView>('Definitions');
  const [tasksSnapshotLastLoadedAt, setTasksSnapshotLastLoadedAt] = React.useState<number | null>(
    null
  );
  const [tasksSnapshotHasRunningLiveRun, setTasksSnapshotHasRunningLiveRun] = React.useState(false);

  const activeKey = React.useMemo(
    () => getActiveKey(activeContext, taskView),
    [activeContext, taskView]
  );

  const refetchTasksSnapshot = React.useCallback(async () => {
    const taskState = states.Tasks;
    const taskActivationsState = states['Tasks/Activations'];
    const taskRunsState = states['Tasks/Runs'];

    const [tasksData, taskActivationsData, taskRunsData] = await Promise.all([
      fetchForKey(ownerId, assistantId, 'Tasks', taskState.sorting, 0, taskState.filterExpr),
      fetchForKey(
        ownerId,
        assistantId,
        'Tasks/Activations',
        taskActivationsState.sorting,
        0,
        taskActivationsState.filterExpr
      ),
      fetchForKey(
        ownerId,
        assistantId,
        'Tasks/Runs',
        taskRunsState.sorting,
        0,
        taskRunsState.filterExpr
      ),
    ]);

    const loadedAt = Date.now();
    setStates((prev) => ({
      ...prev,
      Tasks: contextStateFromData(
        tasksData as MemoryContextData<TaskRow>,
        taskState.sorting,
        taskState.filterExpr,
        taskState.searchQuery,
        loadedAt
      ),
      'Tasks/Activations': contextStateFromData(
        taskActivationsData as MemoryContextData<TaskActivationRow>,
        taskActivationsState.sorting,
        taskActivationsState.filterExpr,
        taskActivationsState.searchQuery,
        loadedAt
      ),
      'Tasks/Runs': contextStateFromData(
        taskRunsData as MemoryContextData<TaskRunRow>,
        taskRunsState.sorting,
        taskRunsState.filterExpr,
        taskRunsState.searchQuery,
        loadedAt
      ),
    }));
    setTasksSnapshotLastLoadedAt(loadedAt);
    setTasksSnapshotHasRunningLiveRun(
      hasRunningLiveTaskRun(taskRunsData as MemoryContextData<TaskRunRow>)
    );
  }, [assistantId, ownerId, states]);

  const fetchAll = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [c, t, k, td, ta, tr, g, f] = await Promise.all([
        fetchForKey(ownerId, assistantId, 'Contacts', null),
        fetchForKey(ownerId, assistantId, 'Transcripts', null),
        fetchForKey(ownerId, assistantId, 'Knowledge', null),
        fetchForKey(ownerId, assistantId, 'Tasks', null),
        fetchForKey(ownerId, assistantId, 'Tasks/Activations', null),
        fetchForKey(ownerId, assistantId, 'Tasks/Runs', null),
        fetchForKey(ownerId, assistantId, 'Guidance', null),
        fetchForKey(ownerId, assistantId, 'Functions', null),
      ]);
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
        Tasks: contextStateFromData(td as MemoryContextData<TaskRow>, null, null, '', loadedAt),
        'Tasks/Activations': contextStateFromData(
          ta as MemoryContextData<TaskActivationRow>,
          null,
          null,
          '',
          loadedAt
        ),
        'Tasks/Runs': contextStateFromData(
          tr as MemoryContextData<TaskRunRow>,
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
      setTasksSnapshotLastLoadedAt(loadedAt);
      setTasksSnapshotHasRunningLiveRun(hasRunningLiveTaskRun(tr as MemoryContextData<TaskRunRow>));
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
      'Tasks/Activations': emptyState(),
      'Tasks/Runs': emptyState(),
      Guidance: emptyState(),
      Functions: emptyState(),
    });
    setActiveContext('Contacts');
    setTaskView('Definitions');
    setTasksSnapshotLastLoadedAt(null);
    setTasksSnapshotHasRunningLiveRun(false);
    fetchAll();
  }, [fetchAll]);

  const sort = React.useCallback(
    async (field: string, direction: 'asc' | 'desc') => {
      if (!ownerId || !assistantId) return;

      const newSorting: SortState = { field, direction };
      const current = states[activeKey];

      setStates((prev) => ({
        ...prev,
        [activeKey]: { ...prev[activeKey], rows: [], sorting: newSorting },
      }));
      setIsLoading(true);

      try {
        const data = await fetchForKey(
          ownerId,
          assistantId,
          activeKey,
          newSorting,
          0,
          current.filterExpr
        );
        setStates((prev) => ({
          ...prev,
          [activeKey]: contextStateFromData(
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
    [ownerId, assistantId, activeKey, states]
  );

  const search = React.useCallback(
    async (query: string) => {
      if (!ownerId || !assistantId) return;

      const trimmed = query.trim();
      const currentFields = states[activeKey].fields;
      const filterExpr = trimmed ? buildSearchFilterExpr(trimmed, currentFields) : null;
      const currentSorting = states[activeKey].sorting;

      setStates((prev) => ({
        ...prev,
        [activeKey]: { ...prev[activeKey], rows: [], filterExpr, searchQuery: trimmed },
      }));
      setIsLoading(true);

      try {
        const data = await fetchForKey(
          ownerId,
          assistantId,
          activeKey,
          currentSorting,
          0,
          filterExpr
        );
        setStates((prev) => ({
          ...prev,
          [activeKey]: contextStateFromData(data as any, currentSorting, filterExpr, trimmed),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search');
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId, assistantId, activeKey, states]
  );

  const clearSearch = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    const currentSorting = states[activeKey].sorting;

    setStates((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], rows: [], filterExpr: null, searchQuery: '' },
    }));
    setIsLoading(true);

    try {
      const data = await fetchForKey(ownerId, assistantId, activeKey, currentSorting, 0, null);
      setStates((prev) => ({
        ...prev,
        [activeKey]: contextStateFromData(data as any, currentSorting, null, ''),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear search');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, assistantId, activeKey, states]);

  const loadMore = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    const current = states[activeKey];
    if (!current.hasMore || isLoadingMore) return;

    // Sub-context merges don't support offset-based paging
    if (activeKey === 'Knowledge' || activeKey === 'Functions') return;

    setIsLoadingMore(true);

    try {
      const offset = current.rows.length;
      const data = await fetchForKey(
        ownerId,
        assistantId,
        activeKey,
        current.sorting,
        offset,
        current.filterExpr
      );

      setStates((prev) => {
        const prevCtx = prev[activeKey];
        const merged = [...prevCtx.rows, ...data.rows];
        const fields = new Set([...prevCtx.fields, ...data.fields]);
        return {
          ...prev,
          [activeKey]: {
            ...prevCtx,
            rows: merged,
            fields: Array.from(fields),
            hasMore: merged.length < data.count,
            lastLoadedAt: Date.now(),
          } as any,
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more data');
    } finally {
      setIsLoadingMore(false);
    }
  }, [ownerId, assistantId, activeKey, states, isLoadingMore]);

  const refetch = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    setIsLoading(true);
    setError(null);

    try {
      if (activeContext === 'Tasks') {
        await refetchTasksSnapshot();
        return;
      }

      const current = states[activeKey];
      const data = await fetchForKey(
        ownerId,
        assistantId,
        activeKey,
        current.sorting,
        0,
        current.filterExpr
      );
      setStates((prev) => ({
        ...prev,
        [activeKey]: contextStateFromData(
          data as any,
          current.sorting,
          current.filterExpr,
          current.searchQuery
        ),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, assistantId, activeContext, activeKey, refetchTasksSnapshot, states]);

  return {
    contacts: states.Contacts,
    transcripts: states.Transcripts,
    knowledge: states.Knowledge,
    tasks: states.Tasks,
    taskActivations: states['Tasks/Activations'],
    taskRuns: states['Tasks/Runs'],
    tasksSnapshotLastLoadedAt,
    tasksSnapshotHasRunningLiveRun,
    guidance: states.Guidance,
    functions: states.Functions,
    isLoading,
    isLoadingMore,
    error,
    activeContext,
    setActiveContext,
    taskView,
    setTaskView,
    sort,
    search,
    clearSearch,
    loadMore,
    refetch,
  };
}
