'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  RefreshCw,
  Users,
  MessageSquare,
  BookOpen,
  ListTodo,
  Compass,
  Code,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { useMemoryData } from '@/hooks/Assistants/useMemoryData';
import type { ColumnDef } from '@tanstack/react-table';
import {
  getColumnsForContext,
  getColumnsForTaskView,
  buildTranscriptColumns,
  MEMORY_CONTEXT_LABELS,
} from '@/utils/assistants/memory';
import { MemoryTable } from './MemoryTable';
import { MemoryRowDetail } from './MemoryRowDetail';
import type {
  MemoryContext,
  MemoryRow,
  TaskMemoryView,
  TaskRunRow,
} from '@/types/assistants/memory';

interface MemoryPaneProps {
  ownerId: string;
  assistantId: string;
}

const CONTEXT_ICONS: Record<MemoryContext, React.ElementType> = {
  Contacts: Users,
  Transcripts: MessageSquare,
  Knowledge: BookOpen,
  Tasks: ListTodo,
  Guidance: Compass,
  Functions: Code,
};

const TAB_CLASS = [
  'inline-flex items-center gap-1.5 border-t-2 px-3 py-1.5 text-xs font-medium',
  'text-muted-foreground transition-colors hover:text-foreground',
  'border-transparent data-[active=true]:border-foreground data-[active=true]:text-foreground',
].join(' ');

const TASK_VIEW_LABELS: Record<TaskMemoryView, string> = {
  Definitions: 'Definitions',
  Activations: 'Activations',
  Runs: 'Runs',
};

const TASK_VIEW_HELPER_COPY: Record<TaskMemoryView, string> = {
  Definitions: 'Configured work the assistant owns, including intent and schedule.',
  Activations: 'Queued or armed task instances that can wake live or offline work.',
  Runs: 'Current and past task executions, including what triggered them and when they ran.',
};

function formatSnapshotAge(timestamp: number | null, now: number): string {
  if (!timestamp) return 'Not loaded';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 10) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours}h ago`;
}

function formatTaskSnapshotStatus(
  timestamp: number | null,
  now: number,
  hasRunningTaskRun: boolean
): string {
  const freshness = formatSnapshotAge(timestamp, now);
  return hasRunningTaskRun ? `Working, ${freshness}` : freshness;
}

function getTaskEmptyState(
  taskView: TaskMemoryView,
  isFiltered: boolean
): { title: string; helperText?: string } {
  if (isFiltered) {
    return {
      title: 'No results match your search.',
      helperText: 'Try clearing search or switching task views to look for related task activity.',
    };
  }

  switch (taskView) {
    case 'Definitions':
      return {
        title: 'No task definitions found.',
        helperText: 'Create a task to give the assistant structured work to own.',
      };
    case 'Activations':
      return {
        title: 'No task activations in this snapshot.',
        helperText:
          'A task only appears here when it currently has a live or offline activation. Use Refresh after changing a task.',
      };
    case 'Runs':
      return {
        title: 'No task runs in this snapshot.',
        helperText:
          'The assistant may still be working on non-task actions elsewhere on the Assistants page. Use Refresh to check for recent task activity.',
      };
  }
}

export function MemoryPane({ ownerId, assistantId }: MemoryPaneProps) {
  const {
    contacts,
    transcripts,
    knowledge,
    tasks,
    taskActivations,
    taskRuns,
    tasksSnapshotLastLoadedAt,
    tasksSnapshotHasRunningTaskRun,
    guidance,
    functions,
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
  } = useMemoryData({ ownerId, assistantId });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setSelectedRow(null);
  }, [activeContext, taskView]);

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

  const contactMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of contacts.rows) {
      const name = [c.firstName, c.surname].filter(Boolean).join(' ');
      if (name) map.set(c.contactId, name);
    }
    return map;
  }, [contacts.rows]);

  const taskDisplayById = useMemo(() => {
    const map = new Map<number, { taskName: string | null; taskDescription: string | null }>();
    for (const task of tasks.rows) {
      if (task.taskId === null || task.taskId === undefined) continue;
      map.set(task.taskId, {
        taskName: task.name ?? null,
        taskDescription: task.description ?? null,
      });
    }
    for (const activation of taskActivations.rows) {
      if (activation.taskId === null || activation.taskId === undefined) continue;
      const existing = map.get(activation.taskId);
      map.set(activation.taskId, {
        taskName: activation.taskName ?? existing?.taskName ?? null,
        taskDescription: activation.taskDescription ?? existing?.taskDescription ?? null,
      });
    }
    return map;
  }, [taskActivations.rows, tasks.rows]);

  const resolvedTaskRuns = useMemo<TaskRunRow[]>(() => {
    return taskRuns.rows.map((row) => {
      const taskDisplay =
        row.taskId !== null && row.taskId !== undefined
          ? taskDisplayById.get(row.taskId)
          : undefined;
      const contactId = row.sourceContactId ? Number(row.sourceContactId) : NaN;
      const sourceContactDisplayName =
        row.sourceContactDisplayName ??
        (Number.isFinite(contactId) ? (contactMap.get(contactId) ?? null) : null);
      return {
        ...row,
        taskName: row.taskName ?? taskDisplay?.taskName ?? null,
        taskDescription: row.taskDescription ?? taskDisplay?.taskDescription ?? null,
        sourceContactDisplayName,
      };
    });
  }, [contactMap, taskDisplayById, taskRuns.rows]);

  const displayedTaskRuns = useMemo(
    () => ({
      ...taskRuns,
      rows: resolvedTaskRuns,
    }),
    [resolvedTaskRuns, taskRuns]
  );

  const activeState = useMemo(() => {
    switch (activeContext) {
      case 'Contacts':
        return contacts;
      case 'Transcripts':
        return transcripts;
      case 'Knowledge':
        return knowledge;
      case 'Tasks':
        switch (taskView) {
          case 'Definitions':
            return tasks;
          case 'Activations':
            return taskActivations;
          case 'Runs':
            return displayedTaskRuns;
        }
      case 'Guidance':
        return guidance;
      case 'Functions':
        return functions;
    }
  }, [
    activeContext,
    contacts,
    transcripts,
    knowledge,
    tasks,
    taskActivations,
    displayedTaskRuns,
    guidance,
    functions,
    taskView,
  ]);

  // Sync search input with the active context's stored query
  useEffect(() => {
    setSearchValue(activeState.searchQuery);
  }, [activeContext, taskView, activeState.searchQuery]);

  const columns = useMemo(() => {
    if (activeContext === 'Transcripts') return buildTranscriptColumns(contactMap);
    if (activeContext === 'Tasks') return getColumnsForTaskView(taskView, activeState.fields);
    return getColumnsForContext(activeContext, activeState.fields);
  }, [activeContext, activeState.fields, contactMap, taskView]);

  const counts: Record<MemoryContext, number> = {
    Contacts: contacts.count,
    Transcripts: transcripts.count,
    Knowledge: knowledge.count,
    Tasks: tasks.count,
    Guidance: guidance.count,
    Functions: functions.count,
  };

  const isFiltered = !!activeState.filterExpr;
  const taskViewCounts: Record<TaskMemoryView, number> = {
    Definitions: tasks.count,
    Activations: taskActivations.count,
    Runs: taskRuns.count,
  };
  const taskTableTestId =
    taskView === 'Definitions'
      ? 'memory-table-tasks-definitions'
      : taskView === 'Activations'
        ? 'memory-table-tasks-activations'
        : 'memory-table-tasks-runs';
  const detailTitle =
    activeContext !== 'Tasks'
      ? `${MEMORY_CONTEXT_LABELS[activeContext]} Detail`
      : taskView === 'Definitions'
        ? 'Task Definition Detail'
        : taskView === 'Activations'
          ? 'Task Activation Detail'
          : 'Task Run Detail';
  const taskEmptyState = activeContext === 'Tasks' ? getTaskEmptyState(taskView, isFiltered) : null;
  const emptyMessage =
    activeContext === 'Tasks'
      ? (taskEmptyState?.title ?? 'No task data found.')
      : isFiltered
        ? 'No results match your search.'
        : `No ${MEMORY_CONTEXT_LABELS[activeContext].toLowerCase()} found.`;
  const emptyHelperText = activeContext === 'Tasks' ? taskEmptyState?.helperText : undefined;
  const snapshotStatus = formatTaskSnapshotStatus(
    tasksSnapshotLastLoadedAt,
    now,
    tasksSnapshotHasRunningTaskRun
  );
  const showTaskWorkingIndicator = tasksSnapshotHasRunningTaskRun;
  const taskViewHelperCopy = TASK_VIEW_HELPER_COPY[taskView];
  const getRowEmphasis = useCallback(
    (row: MemoryRow) => {
      if (activeContext !== 'Tasks' || taskView !== 'Runs') return undefined;
      return 'state' in row && row.state === 'running' ? 'running' : undefined;
    },
    [activeContext, taskView]
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
    <div className="flex h-full flex-col" data-testid="memory-pane">
      {/* Header — search + refresh */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5"
        data-testid="memory-header"
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
            data-testid="memory-search"
          />
          {isFiltered && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={handleClearSearch}
              data-testid="memory-search-clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="memory-refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {activeContext === 'Tasks' && (
        <div className="shrink-0 border-b px-3 py-2" data-testid="memory-task-views">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {(Object.keys(TASK_VIEW_LABELS) as TaskMemoryView[]).map((view) => (
                <button
                  key={view}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground dark:text-slate-300 dark:hover:text-slate-50',
                    taskView === view &&
                      'dark:bg-muted/80 bg-muted text-foreground dark:text-slate-50'
                  )}
                  data-testid={`memory-task-view-${view.toLowerCase()}`}
                  onClick={() => setTaskView(view)}
                >
                  <span>{TASK_VIEW_LABELS[view]}</span>
                  {taskViewCounts[view] > 0 && (
                    <span className="text-[11px] tabular-nums text-muted-foreground dark:text-slate-300">
                      {taskViewCounts[view]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <span
              className="text-caption inline-flex shrink-0 items-center gap-1.5 text-muted-foreground dark:text-slate-300"
              data-testid="memory-task-snapshot-status"
            >
              {showTaskWorkingIndicator ? (
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                  data-testid="memory-task-snapshot-working-indicator"
                />
              ) : null}
              <span>{snapshotStatus}</span>
            </span>
          </div>
          <p
            className="mt-2 max-w-2xl text-[11px] leading-5 text-muted-foreground dark:text-slate-300"
            data-testid="memory-task-view-helper"
          >
            {taskViewHelperCopy}
          </p>
        </div>
      )}

      {/* Body — table */}
      <div className="min-h-0 flex-1" data-testid="memory-body">
        <MemoryTable<MemoryRow>
          data={activeState.rows}
          columns={columns as ColumnDef<MemoryRow, any>[]}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={activeState.hasMore}
          emptyMessage={emptyMessage}
          emptyHelperText={emptyHelperText}
          onRowClick={(row) => setSelectedRow(row as Record<string, unknown>)}
          onSort={sort}
          onLoadMore={loadMore}
          serverSorting={activeState.sorting}
          getRowEmphasis={getRowEmphasis}
          testId={
            activeContext === 'Tasks'
              ? taskTableTestId
              : `memory-table-${activeContext.toLowerCase()}`
          }
        />
      </div>

      {/* Footer — sub-tabs (left) + row count (right) */}
      <div
        className="flex shrink-0 items-center justify-between border-t"
        data-testid="memory-footer"
      >
        <div className="flex items-center overflow-x-auto" data-testid="memory-sub-tabs">
          {(Object.keys(MEMORY_CONTEXT_LABELS) as MemoryContext[]).map((ctx) => {
            const Icon = CONTEXT_ICONS[ctx];
            return (
              <button
                key={ctx}
                className={TAB_CLASS}
                data-active={activeContext === ctx}
                data-testid={`memory-tab-${ctx.toLowerCase()}`}
                onClick={() => setActiveContext(ctx)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{MEMORY_CONTEXT_LABELS[ctx]}</span>
                <span className="tabular-nums text-muted-foreground sm:hidden">
                  {counts[ctx] > 0 ? counts[ctx] : ''}
                </span>
              </button>
            );
          })}
        </div>

        {activeState.rows.length > 0 && (
          <span
            className="text-caption hidden shrink-0 px-3 py-1.5 sm:inline"
            data-testid="memory-table-footer"
          >
            {activeState.rows.length} of {activeState.count}{' '}
            {activeState.count === 1 ? 'row' : 'rows'}
            {activeState.hasMore && ' · scroll for more'}
          </span>
        )}
      </div>

      <MemoryRowDetail
        row={selectedRow}
        context={activeContext}
        taskView={activeContext === 'Tasks' ? taskView : undefined}
        title={detailTitle}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
