'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Plus, ChevronRight, Clock, Play, Pause, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/UI/button';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import { cn } from '@/lib/utils';
import { TabToolbar } from '../Common/TabToolbar';
import { TabFooter } from '../Common/TabFooter';
import { useTasksData } from '@/hooks/Assistants/useTasksData';
import {
  taskStatusBadge,
  getTaskCardFields,
  getRunHistoryCells,
  isPausedTaskStatus,
  TASK_LIVE_DOT_CLASS,
} from '@/utils/assistants/tasks';
import { BrainRowDetail } from '../Brain/BrainRowDetail';
import { NewTaskDrawer } from './NewTaskDrawer';
import type { TaskRow, TaskRunRow } from '@/types/assistants/brain';
import type { Assistant } from '@/types/assistants/assistant';

type TaskFilter = 'All' | 'Active' | 'Paused';
const TASK_FILTERS: TaskFilter[] = ['All', 'Active', 'Paused'];

interface TasksPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /**
   * Notifies the parent whenever the pane's task count changes. Used by
   * the Coordinator onboarding flow to auto-mark the "Assign a task" step
   * the moment a task lands. Receives ``0`` while the list is empty or
   * still loading.
   */
  onTasksCountChange?: (count: number) => void;
}

export function TasksPane({ assistant, ownerId, assistantId, onTasksCountChange }: TasksPaneProps) {
  const { tasks, taskRuns, hasRunningTaskRun, isLoading, error, search, clearSearch, refetch } =
    useTasksData({ assistant, ownerId, assistantId });

  const tasksCount = tasks.count;
  useEffect(() => {
    onTasksCountChange?.(tasksCount);
  }, [tasksCount, onTasksCountChange]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('All');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());
  const [selectedRun, setSelectedRun] = useState<Record<string, unknown> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Group runs under their owning task so each card can show its own
  // run-history table without a second fetch.
  const runsByTaskId = useMemo(() => {
    const map = new Map<number, TaskRunRow[]>();
    for (const run of taskRuns.rows) {
      if (run.taskId === null || run.taskId === undefined) continue;
      const existing = map.get(run.taskId);
      if (existing) existing.push(run);
      else map.set(run.taskId, [run]);
    }
    return map;
  }, [taskRuns.rows]);

  const filteredTasks = useMemo(() => {
    if (filter === 'All') return tasks.rows;
    if (filter === 'Paused') return tasks.rows.filter((t) => isPausedTaskStatus(t.status));
    return tasks.rows.filter((t) => !isPausedTaskStatus(t.status));
  }, [tasks.rows, filter]);

  const totalRunsLogged = taskRuns.count;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    clearSearch();
    inputRef.current?.focus();
  }, [clearSearch]);

  const toggleTask = useCallback((taskId: number) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const isFiltered = !!tasks.filterExpr;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="text-body-muted">{error}</span>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="tasks-pane">
      {/* Toolbar — segmented filter + search + New task */}
      <TabToolbar
        testId="tasks-header"
        leading={
          <div className="bg-muted/40 inline-flex gap-0.5 rounded-lg border p-0.5" role="tablist">
            {TASK_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === f
                    ? 'bg-accent-soft text-accent-soft-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                data-testid={`tasks-filter-${f.toLowerCase()}`}
              >
                {f}
              </button>
            ))}
          </div>
        }
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search tasks…"
        onSearchSubmit={() => {
          const val = searchValue.trim();
          if (val) search(val);
          else clearSearch();
        }}
        onSearchClear={handleClearSearch}
        searchInputRef={inputRef}
        searchTestId="tasks-search"
        searchClearTestId="tasks-search-clear"
        trailing={
          hasRunningTaskRun && (
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
          )
        }
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh tasks"
        refreshTestId="tasks-refresh"
        addAction={
          <Button
            size="sm"
            className="h-7 shrink-0"
            onClick={() => setIsCreating(true)}
            data-testid="tasks-new"
          >
            <Plus className="h-3.5 w-3.5" />
            New task
          </Button>
        }
      />

      {/* Body — expandable task cards */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="tasks-body">
        {isLoading && tasks.rows.length === 0 ? (
          <div className="flex flex-col gap-2" data-testid="tasks-skeleton">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} lines={1} />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-body-muted">
              {isFiltered ? 'No results match your search' : 'No tasks found'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.taskId}
                task={task}
                runs={runsByTaskId.get(task.taskId) ?? []}
                isOpen={expandedTaskIds.has(task.taskId)}
                onToggle={() => toggleTask(task.taskId)}
                onRunClick={(run) => setSelectedRun(run as Record<string, unknown>)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer — task + run counts */}
      <TabFooter
        testId="tasks-footer"
        right={
          <span className="text-caption" data-testid="tasks-table-footer">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} ·{' '}
            {totalRunsLogged} {totalRunsLogged === 1 ? 'run' : 'runs'} logged
          </span>
        }
      />

      <NewTaskDrawer
        open={isCreating}
        onClose={() => setIsCreating(false)}
        onCreate={() =>
          toast('Task creation isn’t available from this view yet.', {
            description: 'Ask your digital twin in chat to set up a new task.',
          })
        }
      />

      <BrainRowDetail
        row={selectedRun}
        context="Tasks"
        taskView="Activity"
        title="Run Detail"
        onClose={() => setSelectedRun(null)}
      />
    </div>
  );
}

interface TaskCardProps {
  task: TaskRow;
  runs: TaskRunRow[];
  isOpen: boolean;
  onToggle: () => void;
  onRunClick: (run: TaskRunRow) => void;
}

function TaskCard({ task, runs, isOpen, onToggle, onRunClick }: TaskCardProps) {
  const fields = useMemo(() => getTaskCardFields(task), [task]);
  const cadence = fields.find((f) => f.label === 'Cadence')?.value ?? '—';
  const nextRun = fields.find((f) => f.label === 'Next run')?.value ?? '—';
  const owner = fields.find((f) => f.label === 'Owner')?.value ?? '—';

  const handleAction = (label: string) => {
    toast(`${label} isn’t available from this view yet.`, {
      description: 'Manage this task by asking your digital twin in chat.',
    });
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card transition-shadow',
        isOpen && 'shadow-[0_4px_18px_-12px_var(--shadow-soft)]'
      )}
      data-testid="task-card"
      data-open={isOpen || undefined}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        data-testid="task-card-head"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-90'
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-title truncate text-foreground">
              {task.name ?? 'Untitled task'}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {cadence} · next {nextRun} · {owner}
            </span>
          </div>
        </div>
        <span className="shrink-0">{taskStatusBadge(task.status)}</span>
      </button>

      {isOpen && (
        <div
          className="grid grid-cols-1 border-t lg:grid-cols-[1fr_1.3fr]"
          data-testid="task-card-body"
        >
          {/* Left — description, fields, actions */}
          <div className="border-b p-4 lg:border-b-0 lg:border-r">
            {task.description && (
              <p className="text-foreground/90 mb-3 text-[12.5px] leading-relaxed">
                {task.description}
              </p>
            )}
            <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {fields.map((field) => (
                <div key={field.label} className="flex flex-col gap-0.5">
                  <dt className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd
                    className={cn(
                      'text-[12.5px] font-semibold text-foreground',
                      field.mono && 'font-mono font-medium'
                    )}
                  >
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleAction('Run now')}>
                <Play className="h-3.5 w-3.5" />
                Run now
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAction('Pause')}>
                <Pause className="h-3.5 w-3.5" />
                Pause
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleAction('Edit')}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </div>

          {/* Right — run history */}
          <div className="p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Run history · {runs.length}
              </span>
              {runs.length > 0 && (
                <span className="text-muted-foreground/70 text-[11px]">click a run to inspect</span>
              )}
            </div>
            {runs.length === 0 ? (
              <p className="text-caption text-muted-foreground">No runs recorded yet.</p>
            ) : (
              <div className="flex flex-col">
                <div className="grid grid-cols-[1.1fr_1.1fr_1.2fr_1.2fr_0.7fr] gap-2.5 border-b pb-2 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground">
                  <span>State</span>
                  <span>Why it started</span>
                  <span>Started</span>
                  <span>Finished</span>
                  <span>Duration</span>
                </div>
                {runs.map((run, idx) => {
                  const cells = getRunHistoryCells(run);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onRunClick(run)}
                      className="hover:bg-muted/40 grid grid-cols-[1.1fr_1.1fr_1.2fr_1.2fr_0.7fr] items-center gap-2.5 border-b py-2 text-left text-xs last:border-b-0"
                      data-testid="task-run-row"
                    >
                      <span>{taskStatusBadge(run.state, { showRunningDot: true })}</span>
                      <span className="truncate text-muted-foreground">{cells.whyLabel}</span>
                      <span className="truncate font-mono text-[11px]">{cells.startedLabel}</span>
                      <span className="truncate font-mono text-[11px]">{cells.finishedLabel}</span>
                      <span className="font-mono text-[11px]">{cells.durationLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
