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
import type { SectionToggleSignal } from './ActionNodeItem';
import type { ActionNode, GetToolLoopEventsFn, LoadChildrenFn } from '@/types/assistants/action';
import { TooltipProvider } from '@/components/UI/tooltip';

export interface ActionTreeProps {
  /** Root-level action nodes to display */
  roots: ActionNode[];
  /** Whether to show empty state when no roots */
  showEmptyState?: boolean;
  /** Custom empty state message */
  emptyStateMessage?: string;
  /** Default expanded state for nodes (defaults to true for running nodes) */
  defaultExpanded?: boolean;
  /** Controlled: set of expanded node IDs */
  expandedNodeIds?: Set<string>;
  /** Controlled: callback when expansion state changes */
  onExpandedChange?: (nodeId: string, expanded: boolean) => void;
  /** Owner user ID for constructing context paths */
  ownerId?: string;
  /** Assistant ID for fetching ToolLoop events */
  assistantId?: string;
  /** Function to fetch ToolLoop events (optional) */
  getToolLoopEvents?: GetToolLoopEventsFn;
  /** Function to lazy-load child events for a node on expand */
  loadChildren?: LoadChildrenFn;
  /** Signal to force-expand/collapse all ToolLoop step sections */
  sectionToggleSignal?: SectionToggleSignal;
  /** IDs of nodes that directly matched the current search */
  matchedIds?: Set<string>;
  /** Current search term for text highlighting */
  searchTerm?: string;
  /** Stop an in-flight root action */
  onStopAction?: (callingId: string) => void;
  /** Blow a root action up into the focus overlay */
  onFocusAction?: (callingId: string) => void;
  /** Open a root action in a new browser tab */
  onOpenActionInNewTab?: (callingId: string) => void;
  /** Additional class names */
  className?: string;
}

export function ActionTree({
  roots,
  showEmptyState = false,
  emptyStateMessage = 'No actions yet',
  defaultExpanded,
  expandedNodeIds,
  onExpandedChange,
  assistantId,
  getToolLoopEvents,
  loadChildren,
  sectionToggleSignal,
  matchedIds,
  searchTerm,
  onStopAction,
  onFocusAction,
  onOpenActionInNewTab,
  className,
  ownerId,
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
    <TooltipProvider delayDuration={300}>
      <div
        className={cn('min-w-0 overflow-hidden', className)}
        style={{ contain: 'inline-size', maxWidth: '100%' }}
      >
        {roots.map((node, idx) => {
          const prev = idx > 0 ? roots[idx - 1] : undefined;
          const showDate = !prev || !isSameDay(prev.startTime, node.startTime);
          const isOpen = expandedNodeIds?.has(node.id) ?? false;

          return (
            <React.Fragment key={node.id}>
              {showDate && <TimelineDateSeparator timestamp={node.startTime} />}
              {/* Flat list of independent action cards — no timeline spine
                  between cards. Collapsed rows read as a flat list; expanding
                  promotes the row into a framed card so the steps + final
                  response read as a contained unit. */}
              <div
                className={cn(
                  'mb-1.5 rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-colors',
                  isOpen && node.status === 'running' && 'border-primary-tint-40',
                  isOpen && node.status === 'error' && 'border-destructive/40',
                  !isOpen && 'hover:border-border/80'
                )}
                data-testid="action-card"
              >
                <ActionNodeItem
                  node={node}
                  ownerId={ownerId}
                  depth={0}
                  defaultExpanded={defaultExpanded}
                  expandedNodeIds={expandedNodeIds}
                  onExpandedChange={onExpandedChange}
                  assistantId={assistantId}
                  getToolLoopEvents={getToolLoopEvents}
                  loadChildren={loadChildren}
                  sectionToggleSignal={sectionToggleSignal}
                  matchedIds={matchedIds}
                  searchTerm={searchTerm}
                  onStopAction={onStopAction}
                  onFocusAction={onFocusAction}
                  onOpenActionInNewTab={onOpenActionInNewTab}
                />
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/** True when two ISO timestamps fall on the same calendar day (local time). */
function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** Date divider rule shown between calendar-day groups of actions. */
function TimelineDateSeparator({ timestamp }: { timestamp: string }) {
  const label = new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <div className="mb-1 mt-2.5 flex items-center gap-2.5 first:mt-0">
      <span className="text-overline">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
