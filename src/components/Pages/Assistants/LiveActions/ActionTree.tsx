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

  const lastIndex = roots.length - 1;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn('min-w-0 overflow-hidden', className)}
        style={{ contain: 'inline-size', maxWidth: '100%' }}
      >
        {roots.map((node, idx) => {
          const prev = idx > 0 ? roots[idx - 1] : undefined;
          const showDate = !prev || !isSameDay(prev.startTime, node.startTime);
          const isNewest = idx === lastIndex;

          return (
            <React.Fragment key={node.id}>
              {showDate && <TimelineDateSeparator timestamp={node.startTime} />}
              <div className="relative flex gap-3">
                {/* Timeline gutter: continuous spine + status-colored node dot.
                    The newest item carries a "Latest" badge row above its header,
                    so its dot sits lower to stay aligned with the header line. */}
                <div className="relative w-3 shrink-0" aria-hidden="true">
                  <span
                    className={cn(
                      'absolute left-1/2 w-0.5 -translate-x-1/2 bg-border',
                      isNewest ? '-top-1.5 h-[2.125rem]' : '-bottom-1.5 -top-1.5'
                    )}
                  />
                  <span
                    className={cn(
                      'absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 bg-card',
                      isNewest ? 'top-7' : 'top-2',
                      dotToneClass(node.status),
                      node.status === 'running' && 'ring-primary/20 animate-pulse ring-4'
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  {isNewest && (
                    <div className="mb-1 flex justify-end">
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.05em] text-primary-foreground">
                        Latest
                      </span>
                    </div>
                  )}
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
                  />
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/** Status-driven border color for the timeline node dot. */
function dotToneClass(status: ActionNode['status']): string {
  switch (status) {
    case 'running':
      return 'border-primary';
    case 'error':
      return 'border-destructive';
    default:
      return 'border-[color:var(--status-success)]';
  }
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
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
