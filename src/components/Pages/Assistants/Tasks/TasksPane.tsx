'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { RefreshCw, Search, X, ListChecks, Activity } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { useTasksData } from '@/hooks/Assistants/useTasksData';
import type { ColumnDef } from '@tanstack/react-table';
import { getColumnsForTaskView, TASK_LIVE_DOT_CLASS } from '@/utils/assistants/tasks';
import { MemoryTable } from '../Memory/MemoryTable';
import { MemoryRowDetail } from '../Memory/MemoryRowDetail';
import type { MemoryRow, TaskMemoryView, TaskRunRow } from '@/types/assistants/memory';

interface TasksPaneProps {
  ownerId: string;
  assistantId: string;
}

const TASK_VIEW_LABELS: Record<TaskMemoryView, string> = {
  Tasks: 'Tasks',
  Activity: 'Activity',
};

const TASK_VIEW_ICONS: Record<TaskMemoryView, React.ElementType> = {
  Tasks: ListChecks,
  Activity: Activity,
};

const TAB_CLASS = [
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium',
  'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
  'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground',
].join(' ');

function getTaskEmptyState(
  taskView: TaskMemoryView,
  isFiltered: boolean
): { title: string; helperText?: string } {
  if (isFiltered) {
    return {
      title: 'No results match your search.',
      helperText: 'Try clearing search or switching between Tasks and Activity.',
    };
  }

  switch (taskView) {
    case 'Tasks':
      return {
        title: 'No tasks found.',
        helperText: 'Create a task to give the assistant structured work to own.',
      };
    case 'Activity':
      return {
        title: 'No task activity yet.',
        helperText:
          'Task activity appears here after a task starts or finishes running. Use Refresh to check for recent updates.',
      };
  }
}

export function TasksPane({ ownerId, assistantId }: TasksPaneProps) {
  const {
    tasks,
    taskRuns,
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
  } = useTasksData({ ownerId, assistantId });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedRow(null);
  }, [taskView]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleSearchSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const val = searchValue.trim();
        if (val) {
          search(val);
        } else {
          clearSearch();
        }
      }
    },
    [searchValue, search, clearSearch]
  );

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    clearSearch();
    inputRef.current?.focus();
  }, [clearSearch]);

  const taskDisplayById = useMemo(() => {
    const map = new Map<number, { taskName: string | null; taskDescription: string | null }>();
    for (const task of tasks.rows) {
      if (task.taskId === null || task.taskId === undefined) continue;
      map.set(task.taskId, {
        taskName: task.name ?? null,
        taskDescription: task.description ?? null,
      });
    }
    return map;
  }, [tasks.rows]);

  const resolvedTaskRuns = useMemo<TaskRunRow[]>(() => {
    return taskRuns.rows.map((row) => {
      const taskDisplay =
        row.taskId !== null && row.taskId !== undefined
          ? taskDisplayById.get(row.taskId)
          : undefined;
      return {
        ...row,
        taskName: row.taskName ?? taskDisplay?.taskName ?? null,
        taskDescription: row.taskDescription ?? taskDisplay?.taskDescription ?? null,
      };
    });
  }, [taskDisplayById, taskRuns.rows]);

  const activeState = useMemo(() => {
    switch (taskView) {
      case 'Tasks':
        return tasks;
      case 'Activity':
        return { ...taskRuns, rows: resolvedTaskRuns };
    }
  }, [taskView, tasks, taskRuns, resolvedTaskRuns]);

  useEffect(() => {
    setSearchValue(activeState.searchQuery);
  }, [taskView, activeState.searchQuery]);

  const allColumns = useMemo(
    () => getColumnsForTaskView(taskView, activeState.fields),
    [taskView, activeState.fields]
  );

  const columns = useMemo(() => {
    if (activeState.rows.length === 0) return allColumns;
    return allColumns.filter((col) => {
      const key = (col as any).accessorKey as string | undefined;
      if (!key) return true;
      return activeState.rows.some((row) => {
        const val = (row as Record<string, unknown>)[key];
        return val !== null && val !== undefined && val !== '';
      });
    });
  }, [allColumns, activeState.rows]);

  const isFiltered = !!activeState.filterExpr;
  const taskViewCounts: Record<TaskMemoryView, number> = {
    Tasks: tasks.count,
    Activity: taskRuns.count,
  };
  const tableTestId = taskView === 'Tasks' ? 'tasks-table-tasks' : 'tasks-table-activity';
  const detailTitle = taskView === 'Tasks' ? 'Task Detail' : 'Activity Detail';
  const emptyState = getTaskEmptyState(taskView, isFiltered);
  const getRowEmphasis = useCallback(
    (row: MemoryRow) => {
      if (taskView !== 'Activity') return undefined;
      return 'state' in row && row.state === 'running' ? 'running' : undefined;
    },
    [taskView]
  );

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="text-body-muted text-sm">{error}</span>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="tasks-pane">
      {/* Header — search + working indicator + refresh */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        data-testid="tasks-header"
      >
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            className="h-7 w-full rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchSubmit}
            data-testid="tasks-search"
          />
          {isFiltered && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={handleClearSearch}
              data-testid="tasks-search-clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {hasRunningTaskRun && (
          <span
            className="text-caption inline-flex shrink-0 items-center gap-1.5 text-muted-foreground"
            data-testid="tasks-snapshot-status"
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', TASK_LIVE_DOT_CLASS)}
              data-testid="tasks-snapshot-working-indicator"
            />
            <span>Working</span>
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="tasks-refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Body — table */}
      <div className="min-h-0 flex-1" data-testid="tasks-body">
        <MemoryTable<MemoryRow>
          data={activeState.rows}
          columns={columns as ColumnDef<MemoryRow, any>[]}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={activeState.hasMore}
          emptyMessage={emptyState.title}
          emptyHelperText={emptyState.helperText}
          onRowClick={(row) => setSelectedRow(row as Record<string, unknown>)}
          onSort={sort}
          onLoadMore={loadMore}
          serverSorting={activeState.sorting}
          getRowEmphasis={getRowEmphasis}
          testId={tableTestId}
        />
      </div>

      {/* Footer — sub-tabs (left) + row count (right). h-10 aligns this bar
          with the assistant-list toggle and the chat input / other tab footers. */}
      <div
        className="flex h-10 shrink-0 items-center justify-between border-t px-2"
        data-testid="tasks-footer"
      >
        <div className="flex items-center gap-1 overflow-x-auto" data-testid="tasks-views">
          {(Object.keys(TASK_VIEW_LABELS) as TaskMemoryView[]).map((view) => {
            const Icon = TASK_VIEW_ICONS[view];
            return (
              <button
                key={view}
                className={TAB_CLASS}
                data-active={taskView === view}
                data-testid={`tasks-view-${view.toLowerCase()}`}
                onClick={() => setTaskView(view)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{TASK_VIEW_LABELS[view]}</span>
                {taskViewCounts[view] > 0 && (
                  <span className="tabular-nums opacity-60">{taskViewCounts[view]}</span>
                )}
              </button>
            );
          })}
        </div>

        {activeState.rows.length > 0 && (
          <span
            className="text-caption hidden shrink-0 px-3 py-1.5 sm:inline"
            data-testid="tasks-table-footer"
          >
            {activeState.rows.length} of {activeState.count}{' '}
            {activeState.count === 1 ? 'row' : 'rows'}
            {activeState.hasMore && ' · scroll for more'}
          </span>
        )}
      </div>

      <MemoryRowDetail
        row={selectedRow}
        context="Tasks"
        taskView={taskView}
        title={detailTitle}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
