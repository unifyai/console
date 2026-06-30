/**
 * React hook for the Tasks tab — fetches Tasks and Task Runs data
 * from the logging API.
 *
 * Supports server-side sorting, filtering, incremental loading
 * (infinite scroll), snapshot-based refresh, and running task detection.
 */

import * as React from 'react';
import type {
  BrainContextData,
  TaskRow,
  TaskRunRow,
  TaskBrainView,
  BrainRow,
} from '@/types/assistants/brain';
import type { Assistant } from '@/types/assistants/assistant';
import { fetchBrainContext, buildSortingParam, buildSearchFilterExpr } from '@/lib/client/brain';
import {
  invalidateTabDataCache,
  readTabDataCache,
  writeTabDataCache,
} from '@/lib/assistants/tabDataCache';

const PAGE_SIZE = 50;
const RUNNING_TASK_RUN_FILTER_EXPR = 'state == "running"';

interface UseTasksDataOptions {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
}

interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

interface ContextState<T extends BrainRow = BrainRow> {
  rows: T[];
  count: number;
  fields: string[];
  hasMore: boolean;
  sorting: SortState | null;
  filterExpr: string | null;
  searchQuery: string;
  lastLoadedAt: number | null;
}

export interface UseTasksDataResult {
  tasks: ContextState<TaskRow>;
  taskRuns: ContextState<TaskRunRow>;
  hasRunningTaskRun: boolean;
  isLoading: boolean;
  error: string | null;
  taskView: TaskBrainView;
  setTaskView: (view: TaskBrainView) => void;
  sort: (field: string, direction: 'asc' | 'desc' | null) => void;
  search: (query: string) => void;
  clearSearch: () => void;
  loadMore: () => void;
  isLoadingMore: boolean;
  refetch: () => void;
}

function emptyState<T extends BrainRow>(): ContextState<T> {
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

function contextStateFromData<T extends BrainRow>(
  data: BrainContextData<T>,
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

type ApiContext = 'Tasks' | 'Tasks/Runs';
type StateKey = 'tasks' | 'taskRuns';

const VIEW_TO_STATE_KEY: Record<TaskBrainView, StateKey> = {
  Tasks: 'tasks',
  Activity: 'taskRuns',
};

const STATE_KEY_TO_API: Record<StateKey, ApiContext> = {
  tasks: 'Tasks',
  taskRuns: 'Tasks/Runs',
};

interface TaskStates {
  tasks: ContextState<TaskRow>;
  taskRuns: ContextState<TaskRunRow>;
}

function fetchForKey(
  assistant: Assistant,
  stateKey: StateKey,
  sorting: SortState | null,
  offset = 0,
  filterExpr?: string | null
) {
  const apiContext = STATE_KEY_TO_API[stateKey];
  const sortingParam = sorting ? buildSortingParam(sorting.field, sorting.direction) : undefined;
  return fetchBrainContext(assistant, apiContext, {
    limit: PAGE_SIZE,
    offset,
    sorting: sortingParam,
    filterExpr: filterExpr ?? undefined,
    readAcrossRoots: stateKey === 'tasks',
  });
}

async function fetchHasRunningSnapshot(assistant: Assistant): Promise<boolean> {
  const data = (await fetchForKey(
    assistant,
    'taskRuns',
    null,
    0,
    RUNNING_TASK_RUN_FILTER_EXPR
  )) as BrainContextData<TaskRunRow>;
  return data.count > 0 || data.rows.some((row) => row.state === 'running');
}

export function useTasksData({
  assistant,
  ownerId,
  assistantId,
}: UseTasksDataOptions): UseTasksDataResult {
  const [states, setStates] = React.useState<TaskStates>({
    tasks: emptyState(),
    taskRuns: emptyState(),
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [taskView, setTaskView] = React.useState<TaskBrainView>('Tasks');
  const [hasRunningTaskRun, setHasRunningTaskRun] = React.useState(false);

  const activeKey = VIEW_TO_STATE_KEY[taskView];
  const cacheKey = `${ownerId}:${assistantId}:tasks`;

  const fetchAll = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [td, tr, hasRunning] = await Promise.all([
        fetchForKey(assistant, 'tasks', null),
        fetchForKey(assistant, 'taskRuns', null),
        fetchHasRunningSnapshot(assistant),
      ]);
      const loadedAt = Date.now();
      const nextStates = {
        tasks: contextStateFromData(td as BrainContextData<TaskRow>, null, null, '', loadedAt),
        taskRuns: contextStateFromData(
          tr as BrainContextData<TaskRunRow>,
          null,
          null,
          '',
          loadedAt
        ),
      };
      writeTabDataCache(cacheKey, { ...nextStates, hasRunningTaskRun: hasRunning });
      setStates(nextStates);
      setHasRunningTaskRun(hasRunning);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task data');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, assistantId, assistant, cacheKey]);

  const fetchAllRef = React.useRef(fetchAll);
  fetchAllRef.current = fetchAll;

  React.useEffect(() => {
    if (!ownerId || !assistantId) return;

    const cached = readTabDataCache<{
      tasks: TaskStates['tasks'];
      taskRuns: TaskStates['taskRuns'];
      hasRunningTaskRun: boolean;
    }>(cacheKey);

    if (cached) {
      setStates({ tasks: cached.tasks, taskRuns: cached.taskRuns });
      setHasRunningTaskRun(cached.hasRunningTaskRun);
      setIsLoading(false);
      setError(null);
      return;
    }

    setTaskView('Tasks');
    setHasRunningTaskRun(false);
    void fetchAllRef.current();
  }, [ownerId, assistantId, cacheKey]);

  const sort = React.useCallback(
    async (field: string, direction: 'asc' | 'desc' | null) => {
      if (!ownerId || !assistantId) return;

      const newSorting: SortState | null = direction ? { field, direction } : null;
      const current = states[activeKey];

      setStates((prev) => ({
        ...prev,
        [activeKey]: { ...prev[activeKey], rows: [], sorting: newSorting },
      }));
      setIsLoading(true);

      try {
        const data = await fetchForKey(assistant, activeKey, newSorting, 0, current.filterExpr);
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
    [ownerId, assistantId, activeKey, states, assistant]
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
        const data = await fetchForKey(assistant, activeKey, currentSorting, 0, filterExpr);
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
    [ownerId, assistantId, activeKey, states, assistant]
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
      const data = await fetchForKey(assistant, activeKey, currentSorting, 0, null);
      setStates((prev) => ({
        ...prev,
        [activeKey]: contextStateFromData(data as any, currentSorting, null, ''),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear search');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, assistantId, activeKey, states, assistant]);

  const loadMore = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    const current = states[activeKey];
    if (!current.hasMore || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const offset = current.rows.length;
      const data = await fetchForKey(
        assistant,
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
  }, [ownerId, assistantId, activeKey, states, isLoadingMore, assistant]);

  const refetch = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;
    invalidateTabDataCache(cacheKey);
    await fetchAllRef.current();
  }, [ownerId, assistantId, cacheKey]);

  return {
    tasks: states.tasks,
    taskRuns: states.taskRuns,
    hasRunningTaskRun,
    isLoading,
    isLoadingMore,
    error,
    taskView,
    setTaskView,
    sort,
    search,
    clearSearch,
    loadMore,
    refetch,
  };
}
