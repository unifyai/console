'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
// TODO(wire-backend): Task mutations (create / run-now / pause / edit) are not
// wired to any backend yet. The icons + toast below are only used by those
// currently-disabled controls; restore them together with the controls.
// import { Plus, Play, Pause, Pencil } from 'lucide-react';
// import { toast } from 'sonner';
import { Button } from '@/components/UI/button';
import { SkeletonCard } from '@/components/Common/Loaders/Skeletons';
import { cn } from '@/lib/utils';
import { TabToolbar } from '../Common/TabToolbar';
import { useBrainScopeFilter } from '../Common/BrainScopeFilter';
import { BrainScopeDropdown } from '../Common/BrainScopeDropdown';
import { TabSegmentGroup, TabSegment } from '../Common/TabSegmentGroup';
import { TabFooter } from '../Common/TabFooter';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { useTasksData } from '@/hooks/Assistants/useTasksData';
import type { ContextRoot } from '@/lib/assistants/scope';
import {
  taskStatusBadge,
  getTaskCardFields,
  getRunHistoryCells,
  isPausedTaskStatus,
  TASK_LIVE_DOT_CLASS,
  collectTaskTags,
  filterTasksByTags,
  readTaskTags,
  type TagFilterState,
} from '@/utils/assistants/tasks';
import { TaskTagsDropdown } from './TaskTagsDropdown';
import { BrainRowDetail } from '../Brain/BrainRowDetail';
import { TaskFields, TaskMetaLine, TaskRunHistory } from './TaskDetail';
import { ClampedAssistantMarkdown } from '../Common/ClampedAssistantMarkdown';
// TODO(wire-backend): restore once task creation is wired to a backend
// (Orchestra task-create endpoint or a Droid system-event).
// import { NewTaskDrawer } from './NewTaskDrawer';
import type { TaskRow, TaskRunRow } from '@/types/assistants/brain';
import type { Assistant } from '@/types/assistants/assistant';

type TaskFilter = 'All' | 'Active' | 'Paused';
const TASK_FILTERS: TaskFilter[] = ['All', 'Active', 'Paused'];

interface TasksPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  /** Scope override: a team root reads `Teams/{id}/Tasks…` only. */
  root?: ContextRoot | null;
  isVisible?: boolean;
  isActiveSurface?: boolean;
  /**
   * Notifies the parent whenever the pane's task count changes. Used by
   * the Coordinator onboarding flow to auto-mark the "Assign a task" step
   * the moment a task lands. Receives ``0`` while the list is empty or
   * still loading.
   */
  onTasksCountChange?: (count: number) => void;
}

export function TasksPane({
  assistant,
  ownerId,
  assistantId,
  root = null,
  isVisible = true,
  isActiveSurface = true,
  onTasksCountChange,
}: TasksPaneProps) {
  const tasksDataEnabled = isVisible && isActiveSurface;
  const scope = useBrainScopeFilter(assistant, { fixedRoot: root });
  const {
    tasks,
    taskRuns,
    hasRunningTaskRun,
    hasLoaded,
    isLoading,
    error,
    search,
    clearSearch,
    refetch,
  } = useTasksData({
    assistant,
    ownerId,
    assistantId,
    root: scope.root,
    enabled: tasksDataEnabled,
  });

  const tasksCount = tasks.count;
  useEffect(() => {
    onTasksCountChange?.(tasksCount);
  }, [tasksCount, onTasksCountChange]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('All');
  const [tagFilters, setTagFilters] = useState<Map<string, TagFilterState>>(new Map());
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set());
  const [selectedRun, setSelectedRun] = useState<Record<string, unknown> | null>(null);
  // TODO(wire-backend): restore when the "New task" create flow is wired.
  // const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Group runs under their owning task so each card can show its own
  // run-history table without a second fetch. Execution rows carry no
  // description copy — the definition is the source of truth, joined here;
  // pre-diet rows may still hold a stored copy as the fallback.
  const runsByTaskId = useMemo(() => {
    const descriptionByTaskId = new Map<number, string | null>();
    for (const task of tasks.rows) {
      if (task.taskId === null || task.taskId === undefined) continue;
      descriptionByTaskId.set(task.taskId, task.description ?? null);
    }
    const map = new Map<number, TaskRunRow[]>();
    for (const run of taskRuns.rows) {
      if (run.taskId === null || run.taskId === undefined) continue;
      const enriched: TaskRunRow = {
        ...run,
        taskDescription: descriptionByTaskId.get(run.taskId) ?? run.taskDescription ?? null,
      };
      const existing = map.get(run.taskId);
      if (existing) existing.push(enriched);
      else map.set(run.taskId, [enriched]);
    }
    return map;
  }, [taskRuns.rows, tasks.rows]);

  const allTags = useMemo(() => collectTaskTags(tasks.rows), [tasks.rows]);

  // Cycle one tag neutral → include → exclude → neutral (GitHub-labels style).
  const cycleTagFilter = useCallback((tag: string) => {
    setTagFilters((prev) => {
      const next = new Map(prev);
      const current = next.get(tag);
      if (current === undefined) next.set(tag, 'include');
      else if (current === 'include') next.set(tag, 'exclude');
      else next.delete(tag);
      return next;
    });
  }, []);

  const includeTagFilter = useCallback((tag: string) => {
    setTagFilters((prev) => {
      const next = new Map(prev);
      if (next.get(tag) === 'include') next.delete(tag);
      else next.set(tag, 'include');
      return next;
    });
  }, []);

  const clearTagFilters = useCallback(() => setTagFilters(new Map()), []);

  const filteredTasks = useMemo(() => {
    let rows = tasks.rows;
    if (filter === 'Paused') rows = rows.filter((t) => isPausedTaskStatus(t.lifecycle));
    else if (filter === 'Active') rows = rows.filter((t) => !isPausedTaskStatus(t.lifecycle));
    return filterTasksByTags(rows, tagFilters);
  }, [tasks.rows, filter, tagFilters]);

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

  const isFiltered = !!tasks.filter;

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
          <TabSegmentGroup testId="tasks-filter-seg">
            {TASK_FILTERS.map((f) => (
              <TabSegment
                key={f}
                label={f}
                active={filter === f}
                onClick={() => setFilter(f)}
                testId={`tasks-filter-${f.toLowerCase()}`}
              />
            ))}
          </TabSegmentGroup>
        }
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder={tabSearchPlaceholder('tasks')}
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
          <>
            <TaskTagsDropdown
              tags={allTags}
              filters={tagFilters}
              onCycle={cycleTagFilter}
              onClear={clearTagFilters}
            />
            <BrainScopeDropdown scope={scope} />
            {hasRunningTaskRun ? (
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
            ) : null}
          </>
        }
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        refreshTitle="Refresh tasks"
        refreshTestId="tasks-refresh"
        // TODO(wire-backend): "New task" creation is not wired to any backend
        // yet. Restore this addAction (and the NewTaskDrawer below) once an
        // Orchestra task-create endpoint / Droid system-event exists.
        // addAction={
        //   <Button
        //     size="sm"
        //     className="h-7 shrink-0"
        //     onClick={() => setIsCreating(true)}
        //     data-testid="tasks-new"
        //   >
        //     <Plus className="h-3.5 w-3.5" />
        //     New task
        //   </Button>
        // }
      />

      {/* Body — expandable task cards */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3" data-testid="tasks-body">
        {isLoading && !hasLoaded ? (
          <div className="flex flex-col gap-2" data-testid="tasks-skeleton">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} lines={1} />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-body-muted">
              {isFiltered
                ? 'No results match your search'
                : tagFilters.size > 0
                  ? 'No tasks match the active tag filters'
                  : 'No tasks found'}
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
                tagFilters={tagFilters}
                onTagClick={includeTagFilter}
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

      {/*
        TODO(wire-backend): "New task" creation drawer — not wired to a backend
        yet (onCreate only toasts). Restore once an Orchestra task-create
        endpoint / Droid system-event is available.
        <NewTaskDrawer
          open={isCreating}
          onClose={() => setIsCreating(false)}
          onCreate={() =>
            toast('Task creation isn’t available from this view yet.', {
              description: 'Ask your teammate in chat to set up a new task.',
            })
          }
        />
      */}

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
  tagFilters: ReadonlyMap<string, TagFilterState>;
  /** Toggle a tag as an include filter (chip click on the card). */
  onTagClick: (tag: string) => void;
}

function TaskCard({
  task,
  runs,
  isOpen,
  onToggle,
  onRunClick,
  tagFilters,
  onTagClick,
}: TaskCardProps) {
  const fields = useMemo(() => getTaskCardFields(task), [task]);
  const tags = useMemo(() => readTaskTags(task), [task]);
  const cadence = fields.find((f) => f.label === 'Cadence')?.value ?? '—';
  const nextRun = fields.find((f) => f.label === 'Next run')?.value ?? '—';
  const priority = fields.find((f) => f.label === 'Priority')?.value ?? '—';

  // TODO(wire-backend): Run-now / Pause / Edit are not wired to any backend
  // (this handler only toasts). Restore the handler and the button row below
  // once task lifecycle mutation endpoints exist.
  // const handleAction = (label: string) => {
  //   toast(`${label} isn’t available from this view yet.`, {
  //     description: 'Manage this task by asking your teammate in chat.',
  //   });
  // };

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
            {tags.length > 0 && (
              <span className="flex min-w-0 shrink items-center gap-1 overflow-hidden">
                {/* Chips are plain click targets, not focusable controls: the
                    card head is already a <button>, and nesting focusables in
                    it is invalid. Keyboard filtering lives in the dropdown. */}
                {tags.map((tag) => (
                  <span
                    key={tag}
                    onClick={(event) => {
                      event.stopPropagation();
                      onTagClick(tag);
                    }}
                    className={cn(
                      'shrink-0 cursor-pointer rounded-full border px-2 py-0.5 text-[10.5px] leading-4 transition-colors',
                      tagFilters.get(tag) === 'include'
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted'
                    )}
                    title={`Filter by "${tag}"`}
                    data-testid={`task-card-tag-${tag}`}
                  >
                    {tag}
                  </span>
                ))}
              </span>
            )}
          </div>
          <TaskMetaLine cadence={cadence} nextRun={nextRun} priority={priority} />
        </div>
        <span className="shrink-0">{taskStatusBadge(task.lifecycle)}</span>
      </button>

      {isOpen && (
        <div
          className="grid grid-cols-1 border-t lg:grid-cols-[1fr_1.3fr]"
          data-testid="task-card-body"
        >
          {/* Left — description, fields, actions */}
          <div className="border-b p-4 lg:border-b-0 lg:border-r">
            {task.description && (
              <ClampedAssistantMarkdown maxHeight={140}>
                {task.description}
              </ClampedAssistantMarkdown>
            )}
            <TaskFields fields={fields} className="mb-3" />
            {/*
              TODO(wire-backend): Task lifecycle actions (Run now / Pause / Edit)
              are not wired to any backend (handleAction only toasts). Restore
              this row once task mutation endpoints / system-events exist.
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
            */}
          </div>

          {/* Right — run history */}
          <div className="p-4">
            <TaskRunHistory runs={runs} onRunClick={onRunClick} />
          </div>
        </div>
      )}
    </div>
  );
}
