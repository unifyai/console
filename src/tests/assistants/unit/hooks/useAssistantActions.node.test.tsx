/**
 * Unit tests for useAssistantActions hook.
 *
 * Tests cover:
 * - Initial loading of ManagerMethod events
 * - Tree building from events
 * - Polling behavior when enabled
 * - Incremental event fetching
 * - Auto-clear on new root action
 * - Error handling
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssistantActions } from '@/hooks/Assistants/useAssistantActions';
import type { ManagerMethodLog, AssistantActionActions } from '@/types/assistants/action';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_ASSISTANT_ID = 'assistant-123';

/**
 * Creates a mock ManagerMethod log entry.
 */
function createMockLog(overrides: Partial<ManagerMethodLog> = {}): ManagerMethodLog {
  const defaults: ManagerMethodLog = {
    id: 1,
    ts: new Date().toISOString(),
    entries: {
      manager: 'ContactManager',
      method: 'ask',
      phase: 'incoming',
      callingId: 'call-1',
      hierarchy: ['ContactManager.ask'],
      hierarchyLabel: 'ContactManager.ask(a1b2)',
      status: 'ok',
    },
  };

  return {
    ...defaults,
    ...overrides,
    entries: { ...defaults.entries, ...overrides.entries },
  };
}

/**
 * Creates mock actions with configurable getManagerMethodEvents function.
 */
function createMockActions(getManagerMethodEventsMock = vi.fn()): AssistantActionActions {
  return {
    getManagerMethodEvents: getManagerMethodEventsMock,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('useAssistantActions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initial Loading', () => {
    it(
      'fetches events on mount when enabled',
      {
        meta: {
          alias: 'Actions-FetchOnMount',
          scenario: 'Hook mounts with enabled=true',
          behavior: 'Fetches ManagerMethod events from actions',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [
            createMockLog({
              ts: '2024-01-15T10:30:00.000Z',
              entries: {
                manager: 'CodeActActor',
                method: 'act',
                phase: 'incoming',
                callingId: 'root-1',
                hierarchy: ['CodeActActor.act'],
                hierarchyLabel: 'CodeActActor.act(r001)',
                status: 'ok',
              },
            }),
          ],
          count: 1,
        });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(mockGetEvents).toHaveBeenCalled();
        expect(result.current.roots).toHaveLength(1);
        expect(result.current.roots[0].label).toBe('CodeActActor.act');
      }
    );

    it(
      'does not fetch when enabled=false',
      {
        meta: {
          alias: 'Actions-NoFetchWhenDisabled',
          scenario: 'Hook mounts with enabled=false',
          behavior: 'Does not fetch events',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({ logs: [], count: 0 });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: false })
        );

        // Wait a bit
        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
        });

        // Assert
        expect(mockGetEvents).not.toHaveBeenCalled();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.roots).toHaveLength(0);
      }
    );

    it(
      'starts fetching when enabled changes to true',
      {
        meta: {
          alias: 'Actions-FetchOnEnable',
          scenario: 'enabled changes from false to true',
          behavior: 'Starts fetching events',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [createMockLog()],
          count: 1,
        });
        const mockActions = createMockActions(mockGetEvents);

        // Act - start disabled
        const { result, rerender } = renderHook(
          ({ enabled }) => useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled }),
          { initialProps: { enabled: false } }
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
        });
        expect(mockGetEvents).not.toHaveBeenCalled();

        // Enable
        rerender({ enabled: true });

        await waitFor(() => {
          expect(mockGetEvents).toHaveBeenCalled();
        });
        expect(result.current.roots).toHaveLength(1);
      }
    );
  });

  describe('Tree Building', () => {
    it(
      'builds nested tree from hierarchical events',
      {
        meta: {
          alias: 'Actions-NestedTree',
          scenario: 'Events have parent-child hierarchy',
          behavior: 'Tree is built with correct nesting',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [
            createMockLog({
              id: 1,
              ts: '2024-01-15T10:30:00.000Z',
              entries: {
                manager: 'CodeActActor',
                method: 'act',
                phase: 'incoming',
                callingId: 'root-1',
                hierarchy: ['CodeActActor.act'],
                hierarchyLabel: 'CodeActActor.act(r001)',
                status: 'ok',
              },
            }),
            createMockLog({
              id: 2,
              ts: '2024-01-15T10:30:01.000Z',
              entries: {
                manager: 'ContactManager',
                method: 'ask',
                phase: 'incoming',
                callingId: 'child-1',
                hierarchy: ['CodeActActor.act', 'ContactManager.ask'],
                hierarchyLabel: 'CodeActActor.act->ContactManager.ask(c001)',
                status: 'ok',
              },
            }),
          ],
          count: 2,
        });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert
        await waitFor(() => {
          expect(result.current.roots).toHaveLength(1);
        });
        expect(result.current.roots[0].children).toHaveLength(1);
        expect(result.current.roots[0].children[0].label).toBe('ContactManager.ask');
      }
    );

    it(
      'matches incoming/outgoing events correctly',
      {
        meta: {
          alias: 'Actions-MatchPairs',
          scenario: 'Incoming and outgoing events for same calling_id',
          behavior: 'Node status updated to completed',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [
            createMockLog({
              id: 1,
              ts: '2024-01-15T10:30:00.000Z',
              entries: {
                manager: 'ContactManager',
                method: 'ask',
                phase: 'incoming',
                callingId: 'call-1',
                hierarchy: ['ContactManager.ask'],
                hierarchyLabel: 'ContactManager.ask(c001)',
                question: 'Find John',
                status: 'ok',
              },
            }),
            createMockLog({
              id: 2,
              ts: '2024-01-15T10:30:05.000Z',
              entries: {
                manager: 'ContactManager',
                method: 'ask',
                phase: 'outgoing',
                callingId: 'call-1',
                hierarchy: ['ContactManager.ask'],
                hierarchyLabel: 'ContactManager.ask(c001)',
                answer: 'Found 3 contacts',
                status: 'ok',
              },
            }),
          ],
          count: 2,
        });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert
        await waitFor(() => {
          expect(result.current.roots).toHaveLength(1);
        });
        expect(result.current.roots[0].status).toBe('completed');
        expect(result.current.roots[0].content).toBe('Found 3 contacts');
      }
    );
  });

  describe('Polling', () => {
    it(
      'polls for new events at configured interval',
      {
        meta: {
          alias: 'Actions-Polling',
          scenario: 'Hook is enabled and time passes',
          behavior: 'Fetches new events periodically',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({ logs: [], count: 0 });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, {
            enabled: true,
            pollingInterval: 2000,
          })
        );

        // Wait for initial fetch
        await waitFor(() => {
          expect(mockGetEvents).toHaveBeenCalledTimes(1);
        });

        // Advance past polling interval
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2500);
        });

        // Assert - should have polled at least once more
        expect(mockGetEvents.mock.calls.length).toBeGreaterThanOrEqual(2);
      }
    );

    it(
      'stops polling when disabled',
      {
        meta: {
          alias: 'Actions-StopPolling',
          scenario: 'enabled changes to false',
          behavior: 'Stops polling for events',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({ logs: [], count: 0 });
        const mockActions = createMockActions(mockGetEvents);

        // Act - start enabled
        const { rerender } = renderHook(
          ({ enabled }) =>
            useAssistantActions(TEST_ASSISTANT_ID, mockActions, {
              enabled,
              pollingInterval: 1000,
            }),
          { initialProps: { enabled: true } }
        );

        // Wait for initial fetch
        await waitFor(() => {
          expect(mockGetEvents).toHaveBeenCalledTimes(1);
        });

        // Disable
        rerender({ enabled: false });
        const countAfterDisable = mockGetEvents.mock.calls.length;

        // Advance time
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000);
        });

        // Assert - should not have additional fetches
        expect(mockGetEvents.mock.calls.length).toBe(countAfterDisable);
      }
    );
  });

  describe('Active Action Detection', () => {
    it(
      'reports hasActiveAction correctly',
      {
        meta: {
          alias: 'Actions-HasActive',
          scenario: 'Root node is running',
          behavior: 'hasActiveAction returns true',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [
            createMockLog({
              ts: '2024-01-15T10:30:00.000Z',
              entries: {
                manager: 'CodeActActor',
                method: 'act',
                phase: 'incoming', // Running - no outgoing yet
                callingId: 'root-1',
                hierarchy: ['CodeActActor.act'],
                hierarchyLabel: 'CodeActActor.act(r001)',
                status: 'ok',
              },
            }),
          ],
          count: 1,
        });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert
        await waitFor(() => {
          expect(result.current.hasActiveAction).toBe(true);
        });
      }
    );

    it(
      'reports hasActiveAction false when all completed',
      {
        meta: {
          alias: 'Actions-NoActive',
          scenario: 'All root nodes are completed',
          behavior: 'hasActiveAction returns false',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [
            createMockLog({
              id: 1,
              ts: '2024-01-15T10:30:00.000Z',
              entries: {
                manager: 'CodeActActor',
                method: 'act',
                phase: 'incoming',
                callingId: 'root-1',
                hierarchy: ['CodeActActor.act'],
                hierarchyLabel: 'CodeActActor.act(r001)',
                status: 'ok',
              },
            }),
            createMockLog({
              id: 2,
              ts: '2024-01-15T10:30:05.000Z',
              entries: {
                manager: 'CodeActActor',
                method: 'act',
                phase: 'outgoing',
                callingId: 'root-1',
                hierarchy: ['CodeActActor.act'],
                hierarchyLabel: 'CodeActActor.act(r001)',
                answer: 'Done',
                status: 'ok',
              },
            }),
          ],
          count: 2,
        });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.hasActiveAction).toBe(false);
      }
    );
  });

  describe('Error Handling', () => {
    it(
      'handles API errors gracefully',
      {
        meta: {
          alias: 'Actions-ErrorHandling',
          scenario: 'API returns error',
          behavior: 'Sets error state, continues functioning',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({ detail: 'Access denied' });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.error).toBeTruthy();
        expect(result.current.roots).toHaveLength(0);
      }
    );

    it(
      'handles network errors gracefully',
      {
        meta: {
          alias: 'Actions-NetworkError',
          scenario: 'Network error during fetch',
          behavior: 'Sets error state',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockRejectedValue(new Error('Network error'));
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.error).toBeTruthy();
      }
    );
  });

  describe('Cleanup', () => {
    it(
      'stops polling on unmount',
      {
        meta: {
          alias: 'Actions-CleanupOnUnmount',
          scenario: 'Hook unmounts while polling',
          behavior: 'Polling stops, no memory leaks',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({ logs: [], count: 0 });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { unmount } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, {
            enabled: true,
            pollingInterval: 1000,
          })
        );

        // Wait for initial fetch
        await waitFor(() => {
          expect(mockGetEvents).toHaveBeenCalledTimes(1);
        });

        // Unmount
        unmount();
        const countAfterUnmount = mockGetEvents.mock.calls.length;

        // Advance time
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000);
        });

        // Assert - should not have additional fetches
        expect(mockGetEvents.mock.calls.length).toBe(countAfterUnmount);
      }
    );
  });

  describe('loadMore functionality', () => {
    it(
      'returns hasMore and loadMore in result',
      {
        meta: {
          alias: 'Actions-LoadMoreInterface',
          scenario: 'Hook is rendered',
          behavior: 'Returns loadMore function and hasMore state',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [createMockLog({ id: 1 }), createMockLog({ id: 2 })],
          count: 2,
        });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.loadMore).toBeDefined();
        expect(typeof result.current.loadMore).toBe('function');
        expect(typeof result.current.hasMore).toBe('boolean');
      }
    );

    it(
      'sets hasMore to false when fewer logs than limit returned',
      {
        meta: {
          alias: 'Actions-NoMoreLogs',
          scenario: 'API returns fewer logs than limit',
          behavior: 'hasMore is set to false',
        },
      },
      async () => {
        // Arrange - return only 2 logs (less than 100 limit)
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [createMockLog({ id: 1 }), createMockLog({ id: 2 })],
          count: 2,
        });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.hasMore).toBe(false);
      }
    );
  });

  describe('option naming', () => {
    it(
      'accepts initialLookbackMs option',
      {
        meta: {
          alias: 'Actions-LookbackOption',
          scenario: 'Using initialLookbackMs option',
          behavior: 'Hook uses the provided lookback time',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({ logs: [], count: 0 });
        const mockActions = createMockActions(mockGetEvents);
        const lookbackMs = 2 * 60 * 60 * 1000; // 2 hours

        // Act
        renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, {
            enabled: true,
            initialLookbackMs: lookbackMs,
          })
        );

        // Assert
        await waitFor(() => {
          expect(mockGetEvents).toHaveBeenCalled();
        });

        const [, startTime] = mockGetEvents.mock.calls[0];
        const callTime = new Date(startTime).getTime();
        const expectedTime = Date.now() - lookbackMs;
        // Allow 1 second tolerance
        expect(Math.abs(callTime - expectedTime)).toBeLessThan(1000);
      }
    );
  });

  describe('loadMore pagination', () => {
    it(
      'loadMore fetches older events and merges into tree',
      {
        meta: {
          alias: 'Actions-LoadMoreFetches',
          scenario: 'User scrolls up to load more',
          behavior: 'Older events are fetched and merged into the tree',
        },
      },
      async () => {
        // Arrange - initial load returns one event
        const initialLog = createMockLog({
          id: 2,
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'call-2',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(r002)',
            status: 'ok',
          },
        });

        const olderLog = createMockLog({
          id: 1,
          ts: '2024-01-15T09:30:00.000Z', // 1 hour earlier
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(r001)',
            status: 'ok',
          },
        });

        const mockGetEvents = vi
          .fn()
          // First call - initial load with 100 items (hasMore = true)
          .mockResolvedValueOnce({
            logs: Array(100).fill(initialLog),
            count: 100,
          })
          // Second call - loadMore returns older event
          .mockResolvedValueOnce({
            logs: [olderLog],
            count: 1,
          });

        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Wait for initial load
        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.hasMore).toBe(true);

        // Call loadMore
        await act(async () => {
          await result.current.loadMore();
        });

        // Assert - should have fetched older events
        expect(mockGetEvents).toHaveBeenCalledTimes(2);
      }
    );

    it(
      'loadMore sets hasMore to false when no older events found',
      {
        meta: {
          alias: 'Actions-LoadMoreNoMore',
          scenario: 'loadMore returns no older events',
          behavior: 'hasMore is set to false',
        },
      },
      async () => {
        // Arrange
        const initialLogs = Array(100).fill(
          createMockLog({
            id: 1,
            ts: '2024-01-15T10:30:00.000Z',
            entries: {
              manager: 'CodeActActor',
              method: 'act',
              phase: 'incoming',
              callingId: 'call-1',
              hierarchy: ['CodeActActor.act'],
              hierarchyLabel: 'CodeActActor.act(r001)',
              status: 'ok',
            },
          })
        );

        const mockGetEvents = vi
          .fn()
          .mockResolvedValueOnce({ logs: initialLogs, count: 100 })
          // loadMore returns empty
          .mockResolvedValueOnce({ logs: [], count: 0 });

        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.hasMore).toBe(true);

        // Call loadMore
        await act(async () => {
          await result.current.loadMore();
        });

        // Assert
        expect(result.current.hasMore).toBe(false);
      }
    );

    it(
      'loadMore is no-op when hasMore is false',
      {
        meta: {
          alias: 'Actions-LoadMoreNoop',
          scenario: 'hasMore is false',
          behavior: 'loadMore does nothing',
        },
      },
      async () => {
        // Arrange - initial load returns fewer than limit
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [createMockLog({ id: 1 })],
          count: 1,
        });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });
        expect(result.current.hasMore).toBe(false);

        const callCount = mockGetEvents.mock.calls.length;

        // Call loadMore
        await act(async () => {
          await result.current.loadMore();
        });

        // Assert - no additional calls
        expect(mockGetEvents.mock.calls.length).toBe(callCount);
      }
    );
  });

  describe('lastUpdated timestamp', () => {
    it(
      'updates lastUpdated after successful fetch',
      {
        meta: {
          alias: 'Actions-LastUpdated',
          scenario: 'Successful data fetch',
          behavior: 'lastUpdated is set to current time',
        },
      },
      async () => {
        // Arrange
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [createMockLog({ id: 1 })],
          count: 1,
        });
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert
        await waitFor(() => {
          expect(result.current.lastUpdated).not.toBeNull();
        });
        expect(result.current.lastUpdated).toBeInstanceOf(Date);
      }
    );

    it(
      'lastUpdated is null before first successful fetch',
      {
        meta: {
          alias: 'Actions-LastUpdatedNull',
          scenario: 'Before initial fetch completes',
          behavior: 'lastUpdated is null',
        },
      },
      async () => {
        // Arrange - slow API
        const mockGetEvents = vi
          .fn()
          .mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ logs: [], count: 0 }), 5000))
          );
        const mockActions = createMockActions(mockGetEvents);

        // Act
        const { result } = renderHook(() =>
          useAssistantActions(TEST_ASSISTANT_ID, mockActions, { enabled: true })
        );

        // Assert - should be null initially
        expect(result.current.lastUpdated).toBeNull();
      }
    );
  });
});
