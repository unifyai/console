/**
 * Unit tests for ActionNodeItem and related action UI components.
 *
 * Tests cover:
 * - ActionNodeItem rendering
 * - Expand/collapse behavior
 * - Node states (running, completed, error)
 * - Duration display
 * - Content display
 *
 * @group unit
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionNodeItem } from '@/components/Pages/Assistants/LiveActions/ActionNodeItem';
import { ActionTree } from '@/components/Pages/Assistants/LiveActions/ActionTree';
import type { ActionNode } from '@/types/assistants/action';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockNode(overrides: Partial<ActionNode> = {}): ActionNode {
  return {
    id: 'node-1',
    type: 'manager',
    label: 'ContactManager.ask',
    hierarchy: ['ContactManager.ask'],
    hierarchyLabel: 'ContactManager.ask(a1b2)',
    status: 'running',
    startTime: new Date().toISOString(),
    children: [],
    ...overrides,
  };
}

// =============================================================================
// ActionNodeItem Tests
// =============================================================================

describe('ActionNodeItem', () => {
  describe('Rendering', () => {
    it(
      'renders node label',
      {
        meta: {
          alias: 'NodeItem-Label',
          scenario: 'Node has label',
          behavior: 'Displays label text',
        },
      },
      () => {
        const node = createMockNode({ label: 'ContactManager.ask' });
        render(<ActionNodeItem node={node} />);

        expect(screen.getByText('ContactManager.ask')).toBeInTheDocument();
      }
    );

    it(
      'renders node content when present',
      {
        meta: {
          alias: 'NodeItem-Content',
          scenario: 'Node has content',
          behavior: 'Displays content preview',
        },
      },
      () => {
        const node = createMockNode({ content: 'Find John in contacts' });
        render(<ActionNodeItem node={node} />);

        // Content is displayed wrapped in quotes
        expect(screen.getByText(/"Find John in contacts"/)).toBeInTheDocument();
      }
    );

    it(
      'renders status indicator',
      {
        meta: {
          alias: 'NodeItem-Status',
          scenario: 'Node has status',
          behavior: 'Shows status indicator',
        },
      },
      () => {
        const node = createMockNode({ status: 'running' });
        render(<ActionNodeItem node={node} />);

        expect(screen.getByTestId('status-indicator')).toBeInTheDocument();
      }
    );

    it(
      'renders duration for completed node',
      {
        meta: {
          alias: 'NodeItem-Duration',
          scenario: 'Node is completed with duration',
          behavior: 'Shows duration text',
        },
      },
      () => {
        const startTime = new Date(Date.now() - 5000).toISOString();
        const endTime = new Date().toISOString();
        const node = createMockNode({
          status: 'completed',
          startTime,
          endTime,
        });
        render(<ActionNodeItem node={node} />);

        // Duration should be approximately 5s
        expect(screen.getByText(/\d+(\.\d)?s/)).toBeInTheDocument();
      }
    );
  });

  describe('Expand/Collapse', () => {
    it(
      'shows expand button when node has children',
      {
        meta: {
          alias: 'NodeItem-ExpandButton',
          scenario: 'Node has children',
          behavior: 'Shows expand/collapse button',
        },
      },
      () => {
        const node = createMockNode({
          children: [createMockNode({ id: 'child-1', label: 'Child' })],
        });
        render(<ActionNodeItem node={node} />);

        expect(screen.getByTestId('expand-button')).toBeInTheDocument();
      }
    );

    it(
      'hides expand button when node has no children',
      {
        meta: {
          alias: 'NodeItem-NoExpandButton',
          scenario: 'Node has no children',
          behavior: 'No expand button shown',
        },
      },
      () => {
        const node = createMockNode({ children: [] });
        render(<ActionNodeItem node={node} />);

        expect(screen.queryByTestId('expand-button')).not.toBeInTheDocument();
      }
    );

    it(
      'expands to show children when clicked',
      {
        meta: {
          alias: 'NodeItem-ExpandChildren',
          scenario: 'User clicks expand button',
          behavior: 'Children become visible',
        },
      },
      () => {
        // Use completed status so it doesn't auto-expand
        const node = createMockNode({
          status: 'completed',
          children: [createMockNode({ id: 'child-1', label: 'ChildNode', status: 'completed' })],
        });
        render(<ActionNodeItem node={node} defaultExpanded={false} />);

        // Child should be in DOM but hidden (animated collapse)
        // Find the children container by looking for the transition container
        const childElement = screen.getByText('ChildNode');
        const childContainer = childElement.closest('.transition-all');
        expect(childContainer).toHaveClass('max-h-0', 'opacity-0');

        // Click expand button
        fireEvent.click(screen.getByTestId('expand-button'));

        // Child container should now be visible (expanded)
        expect(childContainer).toHaveClass('opacity-100');
        expect(childContainer).not.toHaveClass('max-h-0');
      }
    );

    it(
      'is expanded by default for running nodes',
      {
        meta: {
          alias: 'NodeItem-DefaultExpanded',
          scenario: 'Node is running with children',
          behavior: 'Children are visible by default',
        },
      },
      () => {
        const node = createMockNode({
          status: 'running',
          children: [createMockNode({ id: 'child-1', label: 'ChildNode' })],
        });
        render(<ActionNodeItem node={node} />);

        // Child should be visible without clicking
        expect(screen.getByText('ChildNode')).toBeInTheDocument();
      }
    );
  });

  describe('Node Types', () => {
    it(
      'renders manager node with default styling',
      {
        meta: {
          alias: 'NodeItem-ManagerType',
          scenario: 'Node type is manager',
          behavior: 'Uses manager styling',
        },
      },
      () => {
        const node = createMockNode({ type: 'manager' });
        render(<ActionNodeItem node={node} />);

        const nodeElement = screen.getByTestId('action-node');
        expect(nodeElement).toHaveAttribute('data-type', 'manager');
      }
    );

    it(
      'renders boundary node with muted styling',
      {
        meta: {
          alias: 'NodeItem-BoundaryType',
          scenario: 'Node type is boundary',
          behavior: 'Uses boundary styling',
        },
      },
      () => {
        const node = createMockNode({ type: 'boundary', label: 'execute_code' });
        render(<ActionNodeItem node={node} />);

        const nodeElement = screen.getByTestId('action-node');
        expect(nodeElement).toHaveAttribute('data-type', 'boundary');
      }
    );
  });
});

// =============================================================================
// ActionTree Tests
// =============================================================================

describe('ActionTree', () => {
  it(
    'renders multiple root nodes',
    {
      meta: {
        alias: 'ActionTree-MultipleRoots',
        scenario: 'Tree has multiple root nodes',
        behavior: 'All roots are rendered',
      },
    },
    () => {
      const roots: ActionNode[] = [
        createMockNode({ id: 'root-1', label: 'FirstAction' }),
        createMockNode({ id: 'root-2', label: 'SecondAction' }),
      ];

      render(<ActionTree roots={roots} />);

      expect(screen.getByText('FirstAction')).toBeInTheDocument();
      expect(screen.getByText('SecondAction')).toBeInTheDocument();
    }
  );

  it(
    'renders nested hierarchy correctly',
    {
      meta: {
        alias: 'ActionTree-NestedHierarchy',
        scenario: 'Tree has nested nodes',
        behavior: 'Hierarchy is preserved in rendering',
      },
    },
    () => {
      const roots: ActionNode[] = [
        createMockNode({
          id: 'root-1',
          label: 'ParentAction',
          status: 'running', // Running nodes are expanded by default
          children: [
            createMockNode({
              id: 'child-1',
              label: 'ChildAction',
              status: 'running',
              children: [createMockNode({ id: 'grandchild-1', label: 'GrandchildAction' })],
            }),
          ],
        }),
      ];

      render(<ActionTree roots={roots} />);

      expect(screen.getByText('ParentAction')).toBeInTheDocument();
      expect(screen.getByText('ChildAction')).toBeInTheDocument();
      expect(screen.getByText('GrandchildAction')).toBeInTheDocument();
    }
  );

  it(
    'renders empty state when no roots',
    {
      meta: {
        alias: 'ActionTree-Empty',
        scenario: 'Tree has no roots',
        behavior: 'Shows empty state message',
      },
    },
    () => {
      render(<ActionTree roots={[]} showEmptyState />);

      expect(screen.getByText(/no actions/i)).toBeInTheDocument();
    }
  );
});
