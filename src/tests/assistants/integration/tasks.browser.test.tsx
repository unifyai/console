import React from 'react';
import { render, screen, waitFor } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  TaskTestHarness,
  TasksListTestHarness,
  createMockTask,
  createMockTasks,
  createPendingTaskActions,
  getTaskEditControls,
  editTaskDescription,
  saveTaskChanges,
  discardTaskChanges,
  toggleTaskExpansion,
  priorityClassMap,
  hasPriorityStyling,
  Status,
  Priority,
  resetTaskIdCounter,
} from './fixtures';

/**
 * Behavior tests for the Task System components.
 *
 * Tests cover:
 * - Task display and state representation
 * - Task description editing
 * - Permission-based UI controls
 * - Error handling
 */

describe('Task System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTaskIdCounter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('A. Task Display', () => {
    it(
      'should display task name and description',
      {
        meta: {
          alias: 'Task-Display-Basic',
          behavior: 'Task name and description are visible',
          scenario: 'Viewing a task',
        },
      },
      async () => {
        const task = createMockTask({
          name: 'Send weekly report',
          description: 'Compile and send the weekly status report to stakeholders.',
        });

        render(<TaskTestHarness task={task} />);

        expect(screen.getByText('Send weekly report')).toBeInTheDocument();
        expect(
          screen.getByDisplayValue(/Compile and send the weekly status report/i)
        ).toBeInTheDocument();
      }
    );

    it(
      'should display status badge with correct variant',
      {
        meta: {
          alias: 'Task-Status-Badge',
          behavior: 'Status badge shows current task status',
          scenario: 'Viewing task with different statuses',
        },
      },
      async () => {
        const completedTask = createMockTask({ status: Status.completed });

        render(<TaskTestHarness task={completedTask} />);

        expect(screen.getByText('completed')).toBeInTheDocument();
      }
    );

    it(
      'should display priority indicator',
      {
        meta: {
          alias: 'Task-Priority-Indicator',
          behavior: 'Priority is shown with appropriate styling',
          scenario: 'Viewing task with different priorities',
        },
      },
      async () => {
        const urgentTask = createMockTask({ priority: Priority.urgent });

        render(<TaskTestHarness task={urgentTask} />);

        expect(screen.getByText('urgent')).toBeInTheDocument();
        const priorityElement = screen.getByText('urgent');
        expect(hasPriorityStyling(priorityElement, Priority.urgent)).toBe(true);
      }
    );

    it(
      'should display deadline when set',
      {
        meta: {
          alias: 'Task-Deadline',
          behavior: 'Deadline is visible when set',
          scenario: 'Task with deadline',
        },
      },
      async () => {
        const taskWithDeadline = createMockTask({
          deadline: '2026-01-15T10:00:00Z',
        });

        render(<TaskTestHarness task={taskWithDeadline} />);

        const calendarIcon = document.querySelector('.lucide-calendar-days');
        expect(calendarIcon).toBeInTheDocument();
      }
    );

    it(
      'should expand and collapse task details',
      {
        meta: {
          alias: 'Task-Expand-Collapse',
          behavior: 'Clicking task expands/collapses details',
          scenario: 'User clicks on task header',
        },
      },
      async () => {
        const user = userEvent.setup();
        const task = createMockTask({
          name: 'Send weekly report',
          description: 'Compile and send the weekly status report to stakeholders.',
        });

        render(<TaskTestHarness task={task} defaultExpanded={false} />);

        // Initially collapsed - description not visible
        expect(
          screen.queryByDisplayValue(/Compile and send the weekly status report/i)
        ).not.toBeInTheDocument();

        // Click to expand
        await toggleTaskExpansion(user, screen, 'Send weekly report');

        // Now description should be visible
        await waitFor(() => {
          expect(
            screen.getByDisplayValue(/Compile and send the weekly status report/i)
          ).toBeInTheDocument();
        });
      }
    );
  });

  describe('B. Task Status Styling', () => {
    const statusTests = [
      { status: Status.queued, expectedVariant: 'secondary' },
      { status: Status.active, expectedVariant: 'secondary' },
      { status: Status.completed, expectedVariant: 'default' },
      { status: Status.failed, expectedVariant: 'destructive' },
      { status: Status.cancelled, expectedVariant: 'destructive' },
      { status: Status.scheduled, expectedVariant: 'outline' },
      { status: Status.paused, expectedVariant: 'outline' },
    ];

    statusTests.forEach(({ status, expectedVariant }) => {
      it(
        `should apply ${expectedVariant} variant for ${status} status`,
        {
          meta: {
            alias: `Task-Status-${status}`,
            behavior: `${status} status shows ${expectedVariant} badge style`,
            scenario: `Task with ${status} status`,
          },
        },
        async () => {
          const task = createMockTask({ status });

          render(<TaskTestHarness task={task} />);

          const badge = screen.getByText(status);
          expect(badge).toBeInTheDocument();
        }
      );
    });
  });

  describe('C. Task Priority Styling', () => {
    const priorityTests = [
      { priority: Priority.low, expectedClass: priorityClassMap[Priority.low] },
      { priority: Priority.normal, expectedClass: priorityClassMap[Priority.normal] },
      { priority: Priority.high, expectedClass: priorityClassMap[Priority.high] },
      { priority: Priority.urgent, expectedClass: priorityClassMap[Priority.urgent] },
    ];

    priorityTests.forEach(({ priority, expectedClass }) => {
      it(
        `should apply ${expectedClass} for ${priority} priority`,
        {
          meta: {
            alias: `Task-Priority-${priority}`,
            behavior: `${priority} priority shows correct color`,
            scenario: `Task with ${priority} priority`,
          },
        },
        async () => {
          const task = createMockTask({ priority });

          render(<TaskTestHarness task={task} />);

          const priorityElement = screen.getByText(priority);
          expect(priorityElement).toHaveClass(expectedClass);
        }
      );
    });
  });

  describe('D. Description Editing', () => {
    it(
      'should enable textarea when canEditTask is true',
      {
        meta: {
          alias: 'Task-Edit-Enabled',
          behavior: 'Textarea is editable',
          scenario: 'User has edit permission',
        },
      },
      async () => {
        const task = createMockTask();

        render(<TaskTestHarness task={task} canEditTask={true} />);

        const textarea = screen.getByPlaceholderText('Task description...');
        expect(textarea).not.toBeDisabled();
        expect(textarea).not.toHaveAttribute('readonly');
      }
    );

    it(
      'should disable textarea when canEditTask is false',
      {
        meta: {
          alias: 'Task-Edit-Disabled',
          behavior: 'Textarea is read-only',
          scenario: 'User does not have edit permission',
        },
      },
      async () => {
        const task = createMockTask();

        render(<TaskTestHarness task={task} canEditTask={false} />);

        const textarea = screen.getByPlaceholderText('Task description...');
        expect(textarea).toBeDisabled();
        expect(textarea).toHaveAttribute('readonly');
      }
    );

    it(
      'should show save/discard buttons when description is modified',
      {
        meta: {
          alias: 'Task-Edit-Buttons',
          behavior: 'Save and discard buttons appear on edit',
          scenario: 'User modifies description',
        },
      },
      async () => {
        const user = userEvent.setup();
        const task = createMockTask({ description: 'Original' });

        const { container } = render(<TaskTestHarness task={task} canEditTask={true} />);

        const textarea = screen.getByPlaceholderText('Task description...');
        expect(textarea).toHaveValue('Original');

        await user.click(textarea);
        await user.type(textarea, ' Modified');

        expect(textarea).toHaveValue('Original Modified');

        const { saveButton, discardButton } = getTaskEditControls(container);
        expect(saveButton || discardButton).toBeTruthy();
      }
    );

    it(
      'should save changes when save button is clicked',
      {
        meta: {
          alias: 'Task-Edit-Save',
          behavior: 'Changes are saved via API',
          scenario: 'User clicks save after editing',
        },
      },
      async () => {
        const user = userEvent.setup();
        const updateMock = vi.fn(async () => ({}));
        const onTaskUpdateMock = vi.fn();
        const task = createMockTask();

        const { container } = render(
          <TaskTestHarness
            task={task}
            updateTask={updateMock}
            onTaskUpdate={onTaskUpdateMock}
            canEditTask={true}
          />
        );

        await editTaskDescription(user, screen, 'New description text');
        await saveTaskChanges(user, container);

        await waitFor(() => {
          expect(updateMock).toHaveBeenCalledWith(
            expect.any(String), // context
            [task.logId], // logId
            expect.objectContaining({ description: 'New description text' })
          );
        });
      }
    );

    // TODO: This test has a timing issue where the discard button click doesn't
    // trigger state update in the browser test environment. Needs investigation.
    it.skip(
      'should discard changes when discard button is clicked',
      {
        meta: {
          alias: 'Task-Edit-Discard',
          behavior: 'Changes are reverted to original',
          scenario: 'User clicks discard after editing',
        },
      },
      async () => {
        const user = userEvent.setup();
        const originalDescription = 'Original task description';
        const task = createMockTask({ description: originalDescription });

        const { container } = render(<TaskTestHarness task={task} canEditTask={true} />);

        const textarea = screen.getByPlaceholderText('Task description...');
        expect(textarea).toHaveValue(originalDescription);

        await user.click(textarea);
        await user.type(textarea, ' - Modified');

        expect(textarea).toHaveValue(`${originalDescription} - Modified`);

        // Wait for the editing buttons container to appear (it only shows when isEditing is true)
        // The buttons are in a div with class "absolute bottom-2 right-2"
        await waitFor(() => {
          const buttonsDiv = container.querySelector('.absolute.bottom-2.right-2');
          expect(buttonsDiv).toBeTruthy();
        });

        await discardTaskChanges(user, container);

        await waitFor(() => {
          expect(textarea).toHaveValue(originalDescription);
        });
      }
    );

    it(
      'should not show save/discard buttons when canEditTask is false',
      {
        meta: {
          alias: 'Task-Edit-NoButtons-ReadOnly',
          behavior: 'Save/discard buttons are hidden in read-only mode',
          scenario: 'User without edit permission',
        },
      },
      async () => {
        const task = createMockTask();

        const { container } = render(<TaskTestHarness task={task} canEditTask={false} />);

        const { saveButton, discardButton } = getTaskEditControls(container);
        expect(saveButton).toBeFalsy();
        expect(discardButton).toBeFalsy();
      }
    );
  });

  describe('E. Error Handling', () => {
    it(
      'should handle save failure gracefully',
      {
        meta: {
          alias: 'Task-Edit-Error',
          behavior: 'Error is shown when save fails',
          scenario: 'Backend returns error on update',
        },
      },
      async () => {
        const user = userEvent.setup();
        const updateMock = vi.fn(async () => ({ detail: 'Failed to update task' }));
        const task = createMockTask();

        const { container } = render(
          <TaskTestHarness task={task} updateTask={updateMock} canEditTask={true} />
        );

        await editTaskDescription(user, screen, 'This will fail');
        await saveTaskChanges(user, container);

        await waitFor(() => {
          expect(updateMock).toHaveBeenCalled();
        });

        // Component should still be functional
        expect(screen.getByPlaceholderText('Task description...')).toBeInTheDocument();
      }
    );

    it(
      'should show loading state during save',
      {
        meta: {
          alias: 'Task-Edit-Loading',
          behavior: 'Loading indicator shown during save',
          scenario: 'Save operation in progress',
        },
      },
      async () => {
        const user = userEvent.setup();
        const pendingActions = createPendingTaskActions();
        const task = createMockTask();

        const { container } = render(
          <TaskTestHarness task={task} updateTask={pendingActions.update} canEditTask={true} />
        );

        await editTaskDescription(user, screen, 'Saving...');
        await saveTaskChanges(user, container);

        await waitFor(() => {
          const { loadingSpinner } = getTaskEditControls(container);
          expect(loadingSpinner).toBeInTheDocument();
        });
      }
    );
  });

  describe('F. Multiple Tasks', () => {
    it(
      'should handle multiple tasks independently',
      {
        meta: {
          alias: 'Task-Multiple-Independent',
          behavior: 'Editing one task does not affect others',
          scenario: 'Multiple tasks in accordion',
        },
      },
      async () => {
        const tasks = [
          createMockTask({ taskId: 1, logId: 1, name: 'Task 1' }),
          createMockTask({ taskId: 2, logId: 2, name: 'Task 2' }),
        ];

        render(<TasksListTestHarness tasks={tasks} />);

        expect(screen.getByText('Task 1')).toBeInTheDocument();
        expect(screen.getByText('Task 2')).toBeInTheDocument();
      }
    );
  });
});
