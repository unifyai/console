/**
 * Tasks Test Harness
 *
 * Provides reusable test utilities and wrapper components
 * for testing the Task System components.
 *
 * @example
 * ```tsx
 * import {
 *   TasksTestHarness,
 *   createMockTask,
 *   createMockTaskActions
 * } from './fixtures/tasksTestHarness';
 *
 * const task = createMockTask({ status: Status.queued });
 *
 * render(<TasksTestHarness task={task} canEditTask={true} />);
 * ```
 */
import * as React from 'react';
import { vi } from 'vitest';
import { TaskListItem } from '@/components/Pages/Assistants/Tasks/List/TaskListItem';
import { Accordion } from '@/components/UI/accordion';
import { Task, TaskActions, Status, Priority } from '@/types/assistants/task';
import { ResponseProps } from '@/types/common';
import { LogsResponseProps, LogItemProps } from '@/types/interfaces/logs';
import { Assistant } from '@/types/assistants/assistant';
import { createMockAssistant } from '../../mocks/data';

// =============================================================================
// RE-EXPORT ENUMS FOR CONVENIENCE
// =============================================================================

export { Status, Priority };

// =============================================================================
// MOCK TASK FACTORIES
// =============================================================================

let taskIdCounter = 1;

/**
 * Create a mock task.
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  const id = taskIdCounter++;
  return {
    logId: id,
    taskId: id,
    name: `Task ${id}`,
    description: `Description for task ${id}`,
    status: Status.queued,
    priority: Priority.normal,
    schedule: {},
    assistantId: 'assistant-1',
    ...overrides,
  };
}

/**
 * Create multiple mock tasks.
 */
export function createMockTasks(count: number): Task[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTask({
      logId: i + 1,
      taskId: i + 1,
      name: `Task ${i + 1}`,
      description: `Description for task ${i + 1}`,
      status: i % 3 === 0 ? Status.completed : i % 3 === 1 ? Status.active : Status.queued,
      priority:
        i % 4 === 0
          ? Priority.urgent
          : i % 4 === 1
            ? Priority.high
            : i % 4 === 2
              ? Priority.normal
              : Priority.low,
    })
  );
}

/**
 * Reset the task ID counter (call in beforeEach for consistent IDs).
 */
export function resetTaskIdCounter() {
  taskIdCounter = 1;
}

// =============================================================================
// MOCK TASK ACTIONS FACTORY
// =============================================================================

export interface MockTaskActionsOptions {
  /** Initial tasks to return from get() */
  initialTasks?: Task[];
  /** Whether get should succeed (default: true) */
  getSuccess?: boolean;
  /** Whether update should succeed (default: true) */
  updateSuccess?: boolean;
  /** Custom error message for failures */
  errorMessage?: string;
  /** Delay for async operations in ms */
  delay?: number;
}

/**
 * Create mock task actions with configurable behavior.
 */
export function createMockTaskActions(options: MockTaskActionsOptions = {}): TaskActions {
  const {
    initialTasks,
    getSuccess = true,
    updateSuccess = true,
    errorMessage = 'Operation failed',
    delay = 0,
  } = options;

  const tasks = initialTasks ?? createMockTasks(3);

  const maybeDelay = async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  };

  return {
    get: vi.fn(
      async (
        _assistantId: string | null,
        _filterExpression: string | null,
        _limit: number | null,
        _offset: number | null
      ): Promise<LogsResponseProps | ResponseProps> => {
        await maybeDelay();
        if (!getSuccess) return { detail: errorMessage };
        return {
          logs: tasks.map((t) => ({
            id: t.logId,
            entries: {
              task_id: t.taskId,
              name: t.name,
              description: t.description,
              status: t.status,
              priority: t.priority,
            },
          })),
          page: 0,
          limit: 50,
          totalCount: tasks.length,
        };
      }
    ),
    update: vi.fn(
      async (
        _assistantId: string,
        _logs: number[],
        _entries: LogItemProps
      ): Promise<ResponseProps> => {
        await maybeDelay();
        if (!updateSuccess) return { detail: errorMessage };
        return { info: 'Task updated' };
      }
    ),
  };
}

/**
 * Create task actions that never resolve (for loading state tests).
 */
export function createPendingTaskActions(): TaskActions {
  return {
    get: vi.fn(
      (
        _assistantId: string | null,
        _filterExpression: string | null,
        _limit: number | null,
        _offset: number | null
      ): Promise<LogsResponseProps | ResponseProps> => new Promise(() => {})
    ),
    update: vi.fn(
      (_assistantId: string, _logs: number[], _entries: LogItemProps): Promise<ResponseProps> =>
        new Promise(() => {})
    ),
  };
}

// =============================================================================
// TASKS TEST WRAPPER COMPONENT (SINGLE TASK)
// =============================================================================

export interface TaskTestHarnessProps {
  /** The task to display */
  task?: Task;
  /** The assistant for context */
  assistant?: Assistant;
  /** Callback when task is updated */
  updateTask?: TaskActions['update'];
  /** Callback after task update */
  onTaskUpdate?: (logId: number, updates: Partial<Task>) => void;
  /** Whether the user can edit this task */
  canEditTask?: boolean;
  /** Whether to expand the task by default */
  defaultExpanded?: boolean;
}

/**
 * Test wrapper component for a single task item.
 */
export function TaskTestHarness({
  task,
  assistant,
  updateTask,
  onTaskUpdate,
  canEditTask = true,
  defaultExpanded = true,
}: TaskTestHarnessProps) {
  const defaultTask = React.useMemo(
    () =>
      createMockTask({
        name: 'Send weekly report',
        description: 'Compile and send the weekly status report to stakeholders.',
      }),
    []
  );

  const defaultAssistant = React.useMemo(
    () =>
      createMockAssistant({
        agentId: 'assistant-1',
        firstName: 'Jane',
        surname: 'Doe',
      }),
    []
  );

  const activeTask = task || defaultTask;
  const activeAssistant = assistant || defaultAssistant;

  return (
    <Accordion type="multiple" defaultValue={defaultExpanded ? [String(activeTask.logId)] : []}>
      <TaskListItem
        task={activeTask}
        assistant={activeAssistant}
        updateTask={updateTask ?? vi.fn(async () => ({}))}
        onTaskUpdate={onTaskUpdate ?? vi.fn()}
        canEditTask={canEditTask}
      />
    </Accordion>
  );
}

// =============================================================================
// TASKS LIST TEST WRAPPER COMPONENT
// =============================================================================

export interface TasksListTestHarnessProps {
  /** The tasks to display */
  tasks?: Task[];
  /** The assistant for context */
  assistant?: Assistant;
  /** Callback when a task is updated */
  updateTask?: TaskActions['update'];
  /** Callback after task update */
  onTaskUpdate?: (logId: number, updates: Partial<Task>) => void;
  /** Whether the user can edit tasks */
  canEditTask?: boolean;
  /** IDs of tasks to expand by default */
  defaultExpandedIds?: string[];
}

/**
 * Test wrapper component for multiple tasks.
 */
export function TasksListTestHarness({
  tasks,
  assistant,
  updateTask,
  onTaskUpdate,
  canEditTask = true,
  defaultExpandedIds,
}: TasksListTestHarnessProps) {
  const defaultTasks = React.useMemo(() => createMockTasks(3), []);
  const defaultAssistant = React.useMemo(
    () =>
      createMockAssistant({
        agentId: 'assistant-1',
        firstName: 'Jane',
        surname: 'Doe',
      }),
    []
  );

  const activeTasks = tasks || defaultTasks;
  const activeAssistant = assistant || defaultAssistant;
  const expandedIds = defaultExpandedIds ?? activeTasks.map((t) => String(t.logId));

  return (
    <Accordion type="multiple" defaultValue={expandedIds}>
      {activeTasks.map((task) => (
        <TaskListItem
          key={task.logId}
          task={task}
          assistant={activeAssistant}
          updateTask={updateTask ?? vi.fn(async () => ({}))}
          onTaskUpdate={onTaskUpdate ?? vi.fn()}
          canEditTask={canEditTask}
        />
      ))}
    </Accordion>
  );
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Get task display elements.
 */
export function getTaskElements(
  screen: {
    queryByText: (text: string | RegExp) => HTMLElement | null;
    queryByPlaceholderText: (text: string | RegExp) => HTMLElement | null;
  },
  container: HTMLElement
) {
  return {
    nameElement: screen.queryByText(/Task \d+|Send weekly report/),
    descriptionTextarea: screen.queryByPlaceholderText(
      /task description/i
    ) as HTMLTextAreaElement | null,
    statusBadge: container.querySelector('[class*="badge"]'),
    priorityIndicator: container.querySelector(
      '[class*="text-destructive"], [class*="text-warning"], [class*="text-primary"], [class*="text-muted"]'
    ),
    deadlineIcon: container.querySelector('.lucide-calendar-days'),
  };
}

/**
 * Get task edit controls.
 */
export function getTaskEditControls(container: HTMLElement) {
  return {
    saveButton: container
      .querySelector('.lucide-save')
      ?.closest('button') as HTMLButtonElement | null,
    discardButton: container
      .querySelector('.lucide-undo-2')
      ?.closest('button') as HTMLButtonElement | null,
    loadingSpinner: container.querySelector('.animate-spin'),
  };
}

/**
 * Get status badge by status value.
 */
export function getStatusBadge(
  screen: { queryByText: (text: string) => HTMLElement | null },
  status: Status
) {
  return screen.queryByText(status);
}

/**
 * Get priority indicator by priority value.
 */
export function getPriorityIndicator(
  screen: { queryByText: (text: string) => HTMLElement | null },
  priority: Priority
) {
  return screen.queryByText(priority);
}

// =============================================================================
// STYLING VERIFICATION HELPERS
// =============================================================================

/**
 * Status to expected badge variant mapping.
 */
export const statusVariantMap: Record<Status, string> = {
  [Status.queued]: 'secondary',
  [Status.active]: 'secondary',
  [Status.completed]: 'default',
  [Status.failed]: 'destructive',
  [Status.cancelled]: 'destructive',
  [Status.scheduled]: 'outline',
  [Status.paused]: 'outline',
};

/**
 * Priority to expected text class mapping.
 */
export const priorityClassMap: Record<Priority, string> = {
  [Priority.low]: 'text-muted-foreground',
  [Priority.normal]: 'text-primary',
  [Priority.high]: 'text-warning',
  [Priority.urgent]: 'text-destructive',
};

/**
 * Check if an element has the expected priority styling.
 */
export function hasPriorityStyling(element: HTMLElement | null, priority: Priority): boolean {
  if (!element) return false;
  return element.classList.contains(priorityClassMap[priority]);
}

// =============================================================================
// INTERACTION HELPERS
// =============================================================================

/**
 * Edit a task description through the UI.
 */
export async function editTaskDescription(
  user: {
    click: (el: HTMLElement) => Promise<void>;
    clear: (el: HTMLElement) => Promise<void>;
    type: (el: HTMLElement, text: string) => Promise<void>;
  },
  screen: { getByPlaceholderText: (text: string | RegExp) => HTMLElement },
  newDescription: string
) {
  const textarea = screen.getByPlaceholderText(/task description/i);
  await user.click(textarea);
  await user.clear(textarea);
  await user.type(textarea, newDescription);
}

/**
 * Save task changes through the UI.
 */
export async function saveTaskChanges(
  user: { click: (el: HTMLElement) => Promise<void> },
  container: HTMLElement
) {
  const saveButton = container.querySelector('.lucide-save')?.closest('button');
  if (saveButton) {
    await user.click(saveButton);
  }
}

/**
 * Discard task changes through the UI.
 */
export async function discardTaskChanges(
  user: { click: (el: HTMLElement) => Promise<void> },
  container: HTMLElement
) {
  const discardButton = container.querySelector('.lucide-undo-2')?.closest('button');
  if (discardButton) {
    await user.click(discardButton);
  }
}

/**
 * Expand or collapse a task in the accordion.
 */
export async function toggleTaskExpansion(
  user: { click: (el: HTMLElement) => Promise<void> },
  screen: { getByText: (text: string | RegExp) => HTMLElement },
  taskName: string | RegExp
) {
  const taskHeader = screen.getByText(taskName);
  await user.click(taskHeader);
}
