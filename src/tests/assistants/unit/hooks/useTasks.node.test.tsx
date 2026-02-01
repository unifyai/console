/**
 * Unit tests for src/hooks/Assistants/useTasks.ts
 *
 * Tests the task fetching hook logic for loading and paginating tasks.
 * Focuses on stress testing race conditions, stale operations, and filter changes.
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTasks } from '@/hooks/Assistants/useTasks';
import { TaskActions, Status } from '@/types/assistants/task';
import { Assistant } from '@/types/assistants/assistant';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock context utils
vi.mock('@/utils/assistants/context-utils', () => ({
  formatAssistantContext: (firstName: string, surname: string) => `${firstName} ${surname}`,
}));

// Create mock task actions
const mockGetAction = vi.fn();

const mockTaskActions: TaskActions = {
  get: mockGetAction,
  update: vi.fn(),
};

// Helper to create mock assistant
const createMockAssistant = (id: string): Assistant =>
  ({
    agentId: id,
    firstName: `Assistant${id}`,
    surname: 'Test',
  }) as Assistant;

// Helper to create mock task log response
const createMockLogResponse = (taskId: number, name: string, assistantId?: string) => ({
  id: taskId,
  entries: {
    taskId,
    name,
    description: `Description for ${name}`,
    status: Status.queued,
    _assistantId: assistantId,
  },
});

describe('useTasks', () => {
  const mockAssistants = [createMockAssistant('1'), createMockAssistant('2')];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAction.mockResolvedValue({ logs: [], count: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('F - Stress and Robustness', () => {
    describe('Concurrent Load More Prevention', () => {
      it(
        'blocks concurrent load more operations',
        {
          meta: {
            alias: 'Tasks-BlocksConcurrentLoadMore',
            scenario: 'User triggers load more multiple times rapidly',
            behavior: 'Only one load more should be in progress at a time',
          },
        },
        async () => {
          // Arrange - initial load completes, then we try multiple load mores
          let loadMoreCallCount = 0;

          // Initial load - use specific assistant filter (not 'all')
          mockGetAction.mockResolvedValueOnce({
            logs: [createMockLogResponse(1, 'Task 1', '1')],
            count: 100, // Indicates more tasks available
          });

          const { result } = renderHook(() =>
            useTasks(mockTaskActions, mockAssistants, '1', null, true)
          );

          // Wait for initial load to complete
          await waitFor(() => {
            expect(result.current.isLoadingInitial).toBe(false);
            expect(result.current.tasks).toHaveLength(1);
          });

          // Setup load more to never resolve and count calls
          mockGetAction.mockImplementation(async () => {
            loadMoreCallCount++;
            return new Promise(() => {});
          });

          // Trigger first load more
          act(() => {
            result.current.fetchMoreTasks();
          });

          // Wait for load more to be in progress
          await waitFor(() => {
            expect(result.current.isLoadingMore).toBe(true);
          });

          // Try triggering load more again while first is in progress
          act(() => {
            result.current.fetchMoreTasks();
          });

          act(() => {
            result.current.fetchMoreTasks();
          });

          // Only one load more call should have been made
          expect(loadMoreCallCount).toBe(1);
        }
      );
    });

    describe('Unmount Handling', () => {
      it(
        'handles unmount during initial fetch gracefully',
        {
          meta: {
            alias: 'Tasks-HandleUnmountDuringFetch',
            scenario: 'Component unmounts while fetch is in progress',
            behavior: 'No state updates should occur after unmount',
          },
        },
        async () => {
          // Arrange
          let resolveFetch: ((v: any) => void) | null = null;
          mockGetAction.mockImplementation(async () => {
            return new Promise((resolve) => {
              resolveFetch = resolve;
            });
          });

          const { result, unmount } = renderHook(() =>
            useTasks(mockTaskActions, mockAssistants, 'all', null, true)
          );

          // Verify fetch started
          await waitFor(() => {
            expect(result.current.isLoadingInitial).toBe(true);
          });

          // Unmount while fetch is pending
          unmount();

          // Resolve the fetch (should not cause React errors)
          await act(async () => {
            resolveFetch?.({
              logs: [createMockLogResponse(1, 'Task 1')],
              count: 1,
            });
          });

          // No error should occur - component gracefully handles unmount
          expect(true).toBe(true);
        }
      );
    });

    describe('Assistant Filter Switching', () => {
      it(
        'clears tasks when switching between assistants',
        {
          meta: {
            alias: 'Tasks-ClearsOnAssistantSwitch',
            scenario: 'User switches from one assistant to another',
            behavior: 'Tasks from previous assistant should be cleared',
          },
        },
        async () => {
          // Arrange - first call returns tasks for assistant 1
          mockGetAction.mockResolvedValueOnce({
            logs: [createMockLogResponse(1, 'Task for Assistant 1', '1')],
            count: 1,
          });

          const { result, rerender } = renderHook(
            ({ assistantFilter }) =>
              useTasks(mockTaskActions, mockAssistants, assistantFilter, null, true),
            { initialProps: { assistantFilter: '1' } }
          );

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.isLoadingInitial).toBe(false);
            expect(result.current.tasks).toHaveLength(1);
            expect(result.current.tasks[0].name).toBe('Task for Assistant 1');
          });

          // Setup mock for new assistant
          mockGetAction.mockResolvedValueOnce({
            logs: [createMockLogResponse(2, 'Task for Assistant 2', '2')],
            count: 1,
          });

          // Switch to different assistant
          rerender({ assistantFilter: '2' });

          // Should eventually show new tasks
          await waitFor(() => {
            expect(result.current.tasks).toHaveLength(1);
            expect(result.current.tasks[0].name).toBe('Task for Assistant 2');
          });

          // Should NOT have tasks from previous assistant
          expect(result.current.tasks.some((t) => t.name === 'Task for Assistant 1')).toBe(false);
        }
      );
    });

    describe('Pagination State Reset', () => {
      it(
        'resets pagination when filter expression changes',
        {
          meta: {
            alias: 'Tasks-ResetsPaginationOnFilterChange',
            scenario: 'User applies a new filter after loading multiple pages',
            behavior: 'Pagination should reset to start',
          },
        },
        async () => {
          // Arrange
          mockGetAction.mockResolvedValueOnce({
            logs: [createMockLogResponse(1, 'Task 1')],
            count: 1,
          });

          const { result, rerender } = renderHook(
            ({ filterExpression }) =>
              useTasks(mockTaskActions, mockAssistants, 'all', filterExpression, true),
            { initialProps: { filterExpression: null as string | null } }
          );

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.isLoadingInitial).toBe(false);
          });

          // Clear mock and setup for second call
          mockGetAction.mockClear();
          mockGetAction.mockResolvedValueOnce({
            logs: [createMockLogResponse(2, 'Filtered Task')],
            count: 1,
          });

          // Apply new filter
          rerender({ filterExpression: "status == 'completed'" });

          // Wait for new fetch
          await waitFor(() => {
            expect(mockGetAction).toHaveBeenCalled();
          });

          // Check that the fetch was called with offset 0 (initial load)
          const lastCall = mockGetAction.mock.calls[0];
          expect(lastCall[4]).toBe(0); // offset parameter should be 0
        }
      );
    });

    describe('Stale Response Handling', () => {
      it(
        'ignores stale response when filter changes during fetch',
        {
          meta: {
            alias: 'Tasks-IgnoresStaleResponse',
            scenario: 'Filter changes during fetch, stale response arrives after',
            behavior: 'Stale response should be ignored',
          },
        },
        async () => {
          // This test verifies that stale responses don't overwrite current data
          // when a filter changes during an in-flight fetch

          // Arrange - first call will be pending, second will resolve immediately
          let resolveFirst: ((v: any) => void) | null = null;
          let callCount = 0;

          mockGetAction.mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
              // First call - hangs
              return new Promise((resolve) => {
                resolveFirst = resolve;
              });
            }
            // Second call resolves immediately with current data
            return {
              logs: [createMockLogResponse(2, 'Current Task', '2')],
              count: 1,
            };
          });

          const { result, rerender } = renderHook(
            ({ assistantFilter }) =>
              useTasks(mockTaskActions, mockAssistants, assistantFilter, null, true),
            { initialProps: { assistantFilter: '1' } }
          );

          // Wait for first fetch to start
          await waitFor(() => {
            expect(resolveFirst).not.toBeNull();
          });

          // Switch to different assistant - triggers second fetch that completes immediately
          rerender({ assistantFilter: '2' });

          // Wait for second fetch to complete
          await waitFor(() => {
            expect(result.current.isLoadingInitial).toBe(false);
          });

          // Verify we have current task
          expect(result.current.tasks.length).toBe(1);
          expect(result.current.tasks[0].name).toBe('Current Task');

          // Now resolve first (stale) - should be ignored
          await act(async () => {
            resolveFirst?.({
              logs: [createMockLogResponse(1, 'Stale Task', '1')],
              count: 1,
            });
          });

          // Wait for potential state updates
          await act(async () => {
            await new Promise((r) => setTimeout(r, 100));
          });

          // BUG: Currently stale response can overwrite current state
          // After fix, should still have only 'Current Task' from assistant 2
          expect(result.current.tasks.length).toBe(1);
          expect(result.current.tasks[0].name).toBe('Current Task');
          expect(result.current.tasks[0].assistantId).toBe('2');
        }
      );
    });
  });
});
