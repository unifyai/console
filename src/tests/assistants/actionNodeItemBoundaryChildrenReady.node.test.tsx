import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionNodeItem } from '@/components/Pages/Assistants/LiveActions/ActionNodeItem';
import { TooltipProvider } from '@/components/UI/tooltip';
import type { ActionNode } from '@/types/assistants/action';

// Regression coverage for the childrenReady gate at ActionNodeItem.tsx (~L3333).
// Boundary nodes never go through the loadChildren lazy-load mechanism (that's
// gated to node.type === 'manager'), so node.childrenLoaded is never set for
// them. Before the boundary-closing fix (console commit 2f92f3e6a) this was
// masked because boundary nodes stayed permanently 'running'. Now that they
// correctly close to 'completed', childrenReady must treat boundary nodes as
// ready regardless of childrenLoaded, or the loading spinner never clears.

function makeNode(overrides: Partial<ActionNode>): ActionNode {
  return {
    id: 'node-1',
    type: 'manager',
    label: 'node',
    hierarchy: ['node-1'],
    hierarchyLabel: 'node-1',
    status: 'completed',
    startTime: '2026-07-28T10:00:00Z',
    endTime: '2026-07-28T10:00:05Z',
    children: [],
    ...overrides,
  };
}

describe('ActionNodeItem childrenReady gate', () => {
  it('clears the loading spinner for a completed boundary node with terminal children', () => {
    const child = makeNode({
      id: 'child-1',
      hierarchy: ['node-1', 'child-1'],
      hierarchyLabel: 'child-1',
      status: 'completed',
    });
    const boundary = makeNode({
      id: 'boundary-1',
      type: 'boundary',
      hierarchy: ['boundary-1'],
      hierarchyLabel: 'boundary-1',
      status: 'completed',
      children: [child],
      // childrenLoaded intentionally left unset: boundary nodes never go
      // through the loadChildren lazy-load mechanism.
    });

    render(
      <TooltipProvider>
        <ActionNodeItem node={boundary} depth={0} defaultExpanded loadChildren={vi.fn()} />
      </TooltipProvider>
    );

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('still shows the loading spinner for a completed manager node whose children have not been lazy-loaded', () => {
    const manager = makeNode({
      id: 'manager-1',
      type: 'manager',
      status: 'completed',
      childrenLoaded: false,
    });

    render(
      <TooltipProvider>
        <ActionNodeItem node={manager} depth={0} defaultExpanded loadChildren={vi.fn()} />
      </TooltipProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
