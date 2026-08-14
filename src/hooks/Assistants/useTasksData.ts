/**
 * React hook for the Tasks tab — fetches task definitions and execution data
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
import type { ContextRoot } from '@/lib/assistants/scope';
import { fetchHasRunningTaskRun } from '@/lib/client/tasks';
import { groupRunsByTask, withRunSummary } from '@/utils/assistants/taskRuns';
import {
  invalidateTabDataCache,
  readTabDataCache,
  writeTabDataCache,
} from '@/lib/assistants/tabDataCache';

const PAGE_SIZE = 50;

interface UseTasksDataOptions {
  /** Scope override: a team root reads `Teams/{id}/Tasks…` only. */
  root?: ContextRoot | null;
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  enabled?: boolean;
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
  filter: string | null;
  searchQuery: string;
  lastLoadedAt: number | null;
}

export interface UseTasksDataResult {
  tasks: ContextState<TaskRow>;
  taskRuns: ContextState<TaskRunRow>;
  hasRunningTaskRun: boolean;
  hasLoaded: boolean;
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
    filter: null,
    searchQuery: '',
    lastLoadedAt: null,
  };
}

function contextStateFromData<T extends BrainRow>(
  data: BrainContextData<T>,
  sorting: SortState | null,
  filter: string | null,
  searchQuery: string,
  loadedAt = Date.now()
): ContextState<T> {
  return {
    ...data,
    hasMore: data.rows.length < data.count,
    sorting,
    filter,
    searchQuery,
    lastLoadedAt: loadedAt,
  };
}

type ApiContext = 'Tasks' | 'Tasks/Executions';
type StateKey = 'tasks' | 'taskRuns';

const VIEW_TO_STATE_KEY: Record<TaskBrainView, StateKey> = {
  Tasks: 'tasks',
  Activity: 'taskRuns',
};

const STATE_KEY_TO_API: Record<StateKey, ApiContext> = {
  tasks: 'Tasks',
  taskRuns: 'Tasks/Executions',
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
  filter?: string | null,
  root: ContextRoot | null = null
) {
  const apiContext = STATE_KEY_TO_API[stateKey];
  const sortingParam = sorting ? buildSortingParam(sorting.field, sorting.direction) : undefined;
  return fetchBrainContext(assistant, apiContext, {
    limit: PAGE_SIZE,
    offset,
    sorting: sortingParam,
    filter: filter ?? undefined,
    root,
    readAcrossRoots: !root,
  });
}

export function useTasksData({
  assistant,
  ownerId,
  assistantId,
  root = null,
  enabled = true,
}: UseTasksDataOptions): UseTasksDataResult {
  const rootCacheKey = root?.kind === 'team' ? `team-${root.teamId}` : 'personal';
  const cacheKey = `${ownerId}:${assistantId}:tasks:${rootCacheKey}`;
  const initialCachedState = readTabDataCache<{
    tasks: TaskStates['tasks'];
    taskRuns: TaskStates['taskRuns'];
    hasRunningTaskRun: boolean;
  }>(cacheKey);
  const [states, setStates] = React.useState<TaskStates>({
    tasks: initialCachedState?.tasks ?? emptyState(),
    taskRuns: initialCachedState?.taskRuns ?? emptyState(),
  });
  const [isLoading, setIsLoading] = React.useState(!initialCachedState);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [taskView, setTaskView] = React.useState<TaskBrainView>('Tasks');
  const [hasRunningTaskRun, setHasRunningTaskRun] = React.useState(
    initialCachedState?.hasRunningTaskRun ?? false
  );

  const activeKey = VIEW_TO_STATE_KEY[taskView];
  const hasLoaded = states.tasks.lastLoadedAt !== null && states.taskRuns.lastLoadedAt !== null;

  const fetchAll = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [td, tr, hasRunning] = await Promise.all([
        fetchForKey(assistant, 'tasks', null, 0, null, root),
        fetchForKey(assistant, 'taskRuns', null, 0, null, root),
        fetchHasRunningTaskRun(assistant, root),
      ]);
      const loadedAt = Date.now();
      const taskRunsState = contextStateFromData(
        tr as BrainContextData<TaskRunRow>,
        null,
        null,
        '',
        loadedAt
      );
      const tasksState = contextStateFromData(
        td as BrainContextData<TaskRow>,
        null,
        null,
        '',
        loadedAt
      );
      // Definitions carry authored intent only, so every column about what a
      // task is *doing* has to be joined from its runs. Without this the
      // Status column read a `status` field the definition schema dropped and
      // rendered an em dash for every task, and Timing fell back to a
      // `schedule.start_at` that a repeat-only definition — the shape every
      // workflow plants — does not carry, and said "No due time set".
      const runsByTask = groupRunsByTask(taskRunsState.rows);
      const nextStates = {
        tasks: {
          ...tasksState,
          rows: tasksState.rows.map((row) =>
            withRunSummary(
              row,
              typeof row.taskId === 'number' ? runsByTask.get(row.taskId) : undefined
            )
          ),
        },
        taskRuns: taskRunsState,
      };
      writeTabDataCache(cacheKey, { ...nextStates, hasRunningTaskRun: hasRunning });
      setStates(nextStates);
      setHasRunningTaskRun(hasRunning);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task data');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, assistantId, assistant, cacheKey, root]);

  const fetchAllRef = React.useRef(fetchAll);
  fetchAllRef.current = fetchAll;

  React.useEffect(() => {
    if (!enabled || !ownerId || !assistantId) return;

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
  }, [enabled, ownerId, assistantId, cacheKey]);

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
        const data = await fetchForKey(assistant, activeKey, newSorting, 0, current.filter, root);
        setStates((prev) => ({
          ...prev,
          [activeKey]: contextStateFromData(
            data as any,
            newSorting,
            current.filter,
            current.searchQuery
          ),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sort data');
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId, assistantId, activeKey, states, assistant, root]
  );

  const search = React.useCallback(
    async (query: string) => {
      if (!ownerId || !assistantId) return;

      const trimmed = query.trim();
      const currentFields = states[activeKey].fields;
      const filter = trimmed ? buildSearchFilterExpr(trimmed, currentFields) : null;
      const currentSorting = states[activeKey].sorting;

      setStates((prev) => ({
        ...prev,
        [activeKey]: { ...prev[activeKey], rows: [], filter, searchQuery: trimmed },
      }));
      setIsLoading(true);

      try {
        const data = await fetchForKey(assistant, activeKey, currentSorting, 0, filter, root);
        setStates((prev) => ({
          ...prev,
          [activeKey]: contextStateFromData(data as any, currentSorting, filter, trimmed),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search');
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId, assistantId, activeKey, states, assistant, root]
  );

  const clearSearch = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;

    const currentSorting = states[activeKey].sorting;

    setStates((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], rows: [], filter: null, searchQuery: '' },
    }));
    setIsLoading(true);

    try {
      const data = await fetchForKey(assistant, activeKey, currentSorting, 0, null, root);
      setStates((prev) => ({
        ...prev,
        [activeKey]: contextStateFromData(data as any, currentSorting, null, ''),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear search');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, assistantId, activeKey, states, assistant, root]);

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
        current.filter,
        root
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
  }, [ownerId, assistantId, activeKey, states, isLoadingMore, assistant, root]);

  const refetch = React.useCallback(async () => {
    if (!ownerId || !assistantId) return;
    invalidateTabDataCache(cacheKey);
    setStates({ tasks: emptyState(), taskRuns: emptyState() });
    await fetchAllRef.current();
  }, [ownerId, assistantId, cacheKey]);

  return {
    tasks: states.tasks,
    taskRuns: states.taskRuns,
    hasRunningTaskRun,
    hasLoaded,
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
