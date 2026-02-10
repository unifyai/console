/**
 * Tests for ActionsHistoryDialog component.
 *
 * Tests:
 * - Dialog visibility based on isOpen prop
 * - Displays action history
 * - Loading, empty, and error states
 * - Scroll to load more functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { ActionsHistoryDialog } from '@/components/Pages/Assistants/Assistants/Profile/Actions/ActionsHistoryDialog';
import type { AssistantActionActions, ActionNode } from '@/types/assistants/action';

// Mock the useAssistantActions hook
const mockUseAssistantActions = vi.fn();
vi.mock('@/hooks/Assistants/useAssistantActions', () => ({
  useAssistantActions: (...args: unknown[]) => mockUseAssistantActions(...args),
}));

// Mock ActionTree to simplify testing
vi.mock('@/components/Pages/Assistants/Assistants/Profile/Actions/ActionTree', () => ({
  ActionTree: ({ roots, defaultExpanded }: { roots: ActionNode[]; defaultExpanded?: boolean }) => (
    <div data-testid="mock-action-tree" data-default-expanded={defaultExpanded}>
      {roots.map((root) => (
        <div key={root.id} data-testid="action-root">
          {root.label}
        </div>
      ))}
    </div>
  ),
}));

describe('ActionsHistoryDialog', () => {
  const mockActions: AssistantActionActions = {
    getManagerMethodEvents: vi.fn().mockResolvedValue({ logs: [], offset: 0 }),
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    assistantId: 'test-assistant-id',
    actions: mockActions,
  };

  const createMockNode = (overrides: Partial<ActionNode> = {}): ActionNode => ({
    id: 'node-1',
    label: 'TestNode',
    type: 'manager',
    status: 'completed',
    startTime: '2024-01-01T10:00:00Z',
    hierarchy: ['TestNode'],
    hierarchyLabel: 'TestNode',
    children: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAssistantActions.mockReturnValue({
      roots: [],
      isLoading: false,
      error: null,
      loadMore: vi.fn(),
      hasMore: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Dialog visibility', () => {
    it(
      'renders dialog when isOpen is true',
      {
        meta: {
          alias: 'HistoryDialog-Open',
          scenario: 'Dialog is open',
          behavior: 'Dialog content is visible',
        },
      },
      () => {
        render(<ActionsHistoryDialog {...defaultProps} isOpen={true} />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Action History')).toBeInTheDocument();
      }
    );

    it(
      'does not render dialog when isOpen is false',
      {
        meta: {
          alias: 'HistoryDialog-Closed',
          scenario: 'Dialog is closed',
          behavior: 'Dialog content is not visible',
        },
      },
      () => {
        render(<ActionsHistoryDialog {...defaultProps} isOpen={false} />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      }
    );

    it(
      'calls onClose when dialog is closed',
      {
        meta: {
          alias: 'HistoryDialog-Close',
          scenario: 'User closes dialog',
          behavior: 'onClose callback is called',
        },
      },
      async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        render(<ActionsHistoryDialog {...defaultProps} onClose={onClose} />);

        // Find and click the close button
        const closeButton = screen.getByRole('button', { name: /close/i });
        await user.click(closeButton);

        expect(onClose).toHaveBeenCalled();
      }
    );
  });

  describe('Loading state', () => {
    it(
      'shows loading indicator when loading with no data',
      {
        meta: {
          alias: 'HistoryDialog-Loading',
          scenario: 'Data is loading',
          behavior: 'Loading spinner is displayed',
        },
      },
      () => {
        mockUseAssistantActions.mockReturnValue({
          roots: [],
          isLoading: true,
          error: null,
          loadMore: vi.fn(),
          hasMore: false,
        });

        render(<ActionsHistoryDialog {...defaultProps} />);

        expect(screen.getByText('Loading action history...')).toBeInTheDocument();
      }
    );
  });

  describe('Empty state', () => {
    it(
      'shows empty message when no actions',
      {
        meta: {
          alias: 'HistoryDialog-Empty',
          scenario: 'No action history',
          behavior: 'Empty state message is displayed',
        },
      },
      () => {
        mockUseAssistantActions.mockReturnValue({
          roots: [],
          isLoading: false,
          error: null,
          loadMore: vi.fn(),
          hasMore: false,
        });

        render(<ActionsHistoryDialog {...defaultProps} />);

        expect(screen.getByText('No action history found')).toBeInTheDocument();
      }
    );
  });

  describe('Error state', () => {
    it(
      'shows error message when fetch fails',
      {
        meta: {
          alias: 'HistoryDialog-Error',
          scenario: 'Fetch fails',
          behavior: 'Error message is displayed',
        },
      },
      () => {
        mockUseAssistantActions.mockReturnValue({
          roots: [],
          isLoading: false,
          error: new Error('Failed to fetch'),
          loadMore: vi.fn(),
          hasMore: false,
        });

        render(<ActionsHistoryDialog {...defaultProps} />);

        expect(screen.getByText('Failed to load action history')).toBeInTheDocument();
      }
    );
  });

  describe('Action tree display', () => {
    it(
      'renders action tree when data is available',
      {
        meta: {
          alias: 'HistoryDialog-WithData',
          scenario: 'Actions are available',
          behavior: 'Action tree is rendered',
        },
      },
      () => {
        const roots = [
          createMockNode({ id: 'root-1', label: 'Action 1' }),
          createMockNode({ id: 'root-2', label: 'Action 2' }),
        ];

        mockUseAssistantActions.mockReturnValue({
          roots,
          isLoading: false,
          error: null,
          loadMore: vi.fn(),
          hasMore: false,
        });

        render(<ActionsHistoryDialog {...defaultProps} />);

        expect(screen.getByTestId('mock-action-tree')).toBeInTheDocument();
        expect(screen.getByText('Action 1')).toBeInTheDocument();
        expect(screen.getByText('Action 2')).toBeInTheDocument();
      }
    );

    it(
      'passes defaultExpanded=false to ActionTree',
      {
        meta: {
          alias: 'HistoryDialog-DefaultCollapsed',
          scenario: 'History dialog renders tree',
          behavior: 'Tree nodes are collapsed by default',
        },
      },
      () => {
        const roots = [createMockNode()];

        mockUseAssistantActions.mockReturnValue({
          roots,
          isLoading: false,
          error: null,
          loadMore: vi.fn(),
          hasMore: false,
        });

        render(<ActionsHistoryDialog {...defaultProps} />);

        const actionTree = screen.getByTestId('mock-action-tree');
        expect(actionTree).toHaveAttribute('data-default-expanded', 'false');
      }
    );
  });

  describe('Pagination', () => {
    it(
      'shows end of history message when no more data',
      {
        meta: {
          alias: 'HistoryDialog-EndOfHistory',
          scenario: 'All history loaded',
          behavior: 'End of history indicator shown',
        },
      },
      () => {
        const roots = [createMockNode()];

        mockUseAssistantActions.mockReturnValue({
          roots,
          isLoading: false,
          error: null,
          loadMore: vi.fn(),
          hasMore: false,
        });

        render(<ActionsHistoryDialog {...defaultProps} />);

        expect(screen.getByText('End of history')).toBeInTheDocument();
      }
    );

    it(
      'shows loading more indicator when loading additional data',
      {
        meta: {
          alias: 'HistoryDialog-LoadingMore',
          scenario: 'Loading additional history',
          behavior: 'Loading more indicator shown',
        },
      },
      () => {
        const roots = [createMockNode()];

        mockUseAssistantActions.mockReturnValue({
          roots,
          isLoading: true,
          error: null,
          loadMore: vi.fn(),
          hasMore: true,
        });

        render(<ActionsHistoryDialog {...defaultProps} />);

        expect(screen.getByText('Loading more...')).toBeInTheDocument();
      }
    );
  });

  describe('Hook integration', () => {
    it(
      'passes correct options to useAssistantActions',
      {
        meta: {
          alias: 'HistoryDialog-HookOptions',
          scenario: 'Dialog is rendered',
          behavior: 'Hook receives correct configuration',
        },
      },
      () => {
        render(<ActionsHistoryDialog {...defaultProps} />);

        expect(mockUseAssistantActions).toHaveBeenCalledWith(
          'test-assistant-id',
          mockActions,
          expect.objectContaining({
            enabled: true,
            pollingInterval: 5000,
            initialLookbackMs: 24 * 60 * 60 * 1000, // 24 hours
          })
        );
      }
    );

    it(
      'disables hook when dialog is closed',
      {
        meta: {
          alias: 'HistoryDialog-DisabledWhenClosed',
          scenario: 'Dialog is closed',
          behavior: 'Hook is disabled',
        },
      },
      () => {
        render(<ActionsHistoryDialog {...defaultProps} isOpen={false} />);

        expect(mockUseAssistantActions).toHaveBeenCalledWith(
          'test-assistant-id',
          mockActions,
          expect.objectContaining({
            enabled: false,
          })
        );
      }
    );
  });
});
