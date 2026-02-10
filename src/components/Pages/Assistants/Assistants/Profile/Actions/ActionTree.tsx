/**
 * ActionTree - Recursive tree component for displaying action nodes.
 *
 * Features:
 * - Renders a list of root-level action nodes
 * - Each node recursively renders its children
 * - Optional empty state display
 * - Supports ToolLoop lazy loading
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ActionNodeItem } from './ActionNodeItem';
import type { ActionNode, GetToolLoopEventsFn } from '@/types/assistants/action';

export interface ActionTreeProps {
  /** Root-level action nodes to display */
  roots: ActionNode[];
  /** Whether to show empty state when no roots */
  showEmptyState?: boolean;
  /** Custom empty state message */
  emptyStateMessage?: string;
  /** Default expanded state for nodes (defaults to true for running nodes) */
  defaultExpanded?: boolean;
  /** Assistant ID for fetching ToolLoop events */
  assistantId?: string;
  /** Function to fetch ToolLoop events (optional) */
  getToolLoopEvents?: GetToolLoopEventsFn;
  /** Additional class names */
  className?: string;
}

export function ActionTree({
  roots,
  showEmptyState = false,
  emptyStateMessage = 'No actions yet',
  defaultExpanded,
  assistantId,
  getToolLoopEvents,
  className,
}: ActionTreeProps) {
  if (roots.length === 0 && showEmptyState) {
    return (
      <div
        className={cn(
          'flex items-center justify-center py-8 text-sm text-muted-foreground',
          className
        )}
      >
        {emptyStateMessage}
      </div>
    );
  }

  if (roots.length === 0) {
    return null;
  }

  return (
    <div
      className={cn('min-w-0 space-y-0.5 overflow-hidden', className)}
      style={{ contain: 'inline-size', maxWidth: '100%' }}
    >
      {roots.map((node) => (
        <ActionNodeItem
          key={node.id}
          node={node}
          depth={0}
          defaultExpanded={defaultExpanded}
          assistantId={assistantId}
          getToolLoopEvents={getToolLoopEvents}
        />
      ))}
    </div>
  );
}
