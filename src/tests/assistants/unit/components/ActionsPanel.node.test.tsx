/**
 * Unit tests for ActionsPanel component.
 *
 * Tests cover:
 * - Loading state
 * - Error state with retry
 * - Empty state
 * - Data display with action tree
 * - Active indicator
 *
 * @group unit
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ActionsPanel } from '@/components/Pages/Assistants/Assistants/Profile/Actions/ActionsPanel';
import type { AssistantActionActions, ManagerMethodLog } from '@/types/assistants/action';

// =============================================================================
// Test Fixtures
// =============================================================================

const TEST_ASSISTANT_ID = 'assistant-123';

function createMockLog(overrides: Partial<ManagerMethodLog> = {}): ManagerMethodLog {
  return {
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
    ...overrides,
  } as ManagerMethodLog;
}

function createMockActions(getManagerMethodEventsMock = vi.fn()): AssistantActionActions {
  return {
    getManagerMethodEvents: getManagerMethodEventsMock,
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('ActionsPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it(
      'shows loading state while fetching',
      {
        meta: {
          alias: 'ActionsPanel-Loading',
          scenario: 'Initial fetch in progress',
          behavior: 'Shows loading indicator',
        },
      },
      async () => {
        // Mock that never resolves
        const mockGetEvents = vi.fn().mockImplementation(() => new Promise(() => {}));
        const mockActions = createMockActions(mockGetEvents);

        render(
          <ActionsPanel assistantId={TEST_ASSISTANT_ID} actions={mockActions} isExpanded={true} />
        );

        expect(screen.getByTestId('actions-loading')).toBeInTheDocument();
        expect(screen.getByText(/loading actions/i)).toBeInTheDocument();
      }
    );
  });

  describe('Error State', () => {
    it(
      'shows error state with retry button',
      {
        meta: {
          alias: 'ActionsPanel-Error',
          scenario: 'Fetch returns error',
          behavior: 'Shows error message and retry button',
        },
      },
      async () => {
        const mockGetEvents = vi.fn().mockResolvedValue({ detail: 'Server error' });
        const mockActions = createMockActions(mockGetEvents);

        render(
          <ActionsPanel assistantId={TEST_ASSISTANT_ID} actions={mockActions} isExpanded={true} />
        );

        await waitFor(() => {
          expect(screen.getByTestId('actions-error')).toBeInTheDocument();
        });

        expect(screen.getByText(/failed to load actions/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      }
    );

    it(
      'retries fetch when retry button clicked',
      {
        meta: {
          alias: 'ActionsPanel-Retry',
          scenario: 'User clicks retry after error',
          behavior: 'Triggers new fetch',
        },
      },
      async () => {
        const mockGetEvents = vi
          .fn()
          .mockResolvedValueOnce({ detail: 'Server error' })
          .mockResolvedValueOnce({ logs: [], count: 0 });
        const mockActions = createMockActions(mockGetEvents);

        render(
          <ActionsPanel assistantId={TEST_ASSISTANT_ID} actions={mockActions} isExpanded={true} />
        );

        await waitFor(() => {
          expect(screen.getByTestId('actions-error')).toBeInTheDocument();
        });

        // Click retry
        fireEvent.click(screen.getByRole('button', { name: /retry/i }));

        // Should have called getEvents twice
        await waitFor(() => {
          expect(mockGetEvents).toHaveBeenCalledTimes(2);
        });
      }
    );
  });

  describe('Empty State', () => {
    it(
      'shows empty state when no actions',
      {
        meta: {
          alias: 'ActionsPanel-Empty',
          scenario: 'No actions returned',
          behavior: 'Shows empty state message',
        },
      },
      async () => {
        const mockGetEvents = vi.fn().mockResolvedValue({ logs: [], count: 0 });
        const mockActions = createMockActions(mockGetEvents);

        render(
          <ActionsPanel assistantId={TEST_ASSISTANT_ID} actions={mockActions} isExpanded={true} />
        );

        await waitFor(() => {
          expect(screen.getByTestId('actions-empty')).toBeInTheDocument();
        });

        expect(screen.getByText(/no recent actions/i)).toBeInTheDocument();
      }
    );
  });

  describe('Data Display', () => {
    it(
      'renders action tree when data available',
      {
        meta: {
          alias: 'ActionsPanel-DataDisplay',
          scenario: 'Actions returned from API',
          behavior: 'Shows action tree with nodes',
        },
      },
      async () => {
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [
            createMockLog({
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

        render(
          <ActionsPanel assistantId={TEST_ASSISTANT_ID} actions={mockActions} isExpanded={true} />
        );

        await waitFor(() => {
          expect(screen.getByText('CodeActActor.act')).toBeInTheDocument();
        });
      }
    );

    it(
      'shows running status indicator when action is running',
      {
        meta: {
          alias: 'ActionsPanel-ActiveIndicator',
          scenario: 'Root action is running',
          behavior: 'Shows running status on action node',
        },
      },
      async () => {
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [
            createMockLog({
              entries: {
                manager: 'CodeActActor',
                method: 'act',
                phase: 'incoming', // Running - no outgoing
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

        render(
          <ActionsPanel assistantId={TEST_ASSISTANT_ID} actions={mockActions} isExpanded={true} />
        );

        // Should show a running action node
        await waitFor(() => {
          const actionNode = screen.getByTestId('action-node');
          expect(actionNode).toHaveAttribute('data-status', 'running');
        });
      }
    );

    it(
      'shows completed status when all actions are done',
      {
        meta: {
          alias: 'ActionsPanel-Idle',
          scenario: 'All actions completed',
          behavior: 'Shows completed status on action nodes',
        },
      },
      async () => {
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

        render(
          <ActionsPanel assistantId={TEST_ASSISTANT_ID} actions={mockActions} isExpanded={true} />
        );

        // Should show a completed action node
        await waitFor(() => {
          const actionNode = screen.getByTestId('action-node');
          expect(actionNode).toHaveAttribute('data-status', 'completed');
        });
      }
    );
  });

  describe('Polling Behavior', () => {
    it(
      'does not fetch when not expanded',
      {
        meta: {
          alias: 'ActionsPanel-NoFetchWhenCollapsed',
          scenario: 'Panel is collapsed',
          behavior: 'No API calls made',
        },
      },
      async () => {
        const mockGetEvents = vi.fn().mockResolvedValue({ logs: [], count: 0 });
        const mockActions = createMockActions(mockGetEvents);

        render(
          <ActionsPanel assistantId={TEST_ASSISTANT_ID} actions={mockActions} isExpanded={false} />
        );

        // Wait a bit
        await vi.advanceTimersByTimeAsync(500);

        expect(mockGetEvents).not.toHaveBeenCalled();
      }
    );
  });

  describe('Active State Callback', () => {
    it(
      'calls onActiveChange when active state changes',
      {
        meta: {
          alias: 'ActionsPanel-OnActiveChange',
          scenario: 'Active action is detected',
          behavior: 'onActiveChange callback is called with true',
        },
      },
      async () => {
        const mockGetEvents = vi.fn().mockResolvedValue({
          logs: [
            {
              id: 1,
              ts: new Date().toISOString(),
              entries: {
                manager: 'TestManager',
                method: 'ask',
                phase: 'incoming',
                callingId: 'active-1',
                hierarchy: ['TestManager.ask'],
                hierarchyLabel: 'TestManager.ask',
                status: 'ok',
              },
            },
          ],
          count: 1,
        });
        const mockActions = createMockActions(mockGetEvents);
        const onActiveChange = vi.fn();

        render(
          <ActionsPanel
            assistantId={TEST_ASSISTANT_ID}
            actions={mockActions}
            isExpanded={true}
            onActiveChange={onActiveChange}
          />
        );

        await waitFor(() => {
          expect(onActiveChange).toHaveBeenCalledWith(true);
        });
      }
    );
  });
});
