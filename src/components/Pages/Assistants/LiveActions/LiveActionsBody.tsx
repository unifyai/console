/**
 * LiveActionsBody - Main content area for the Live Actions Viewer.
 *
 * Handles:
 * - Empty state (no assistant selected)
 * - Empty state (no events)
 * - Loading state
 * - Error state with retry
 * - Action tree display with filtering
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { ActionCardSkeleton } from '@/components/Common/Loaders/Skeletons';
import { Button } from '@/components/UI/button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { ActionTree } from './ActionTree';
import type { SectionToggleSignal } from './ActionNodeItem';
import type { ActionNode, GetToolLoopEventsFn, LoadChildrenFn } from '@/types/assistants/action';

export interface LiveActionsBodyProps {
  /** Whether an assistant is selected */
  hasAssistant: boolean;
  /** Root nodes of the action tree (unfiltered, for state checks) */
  roots: ActionNode[];
  /** Pre-filtered root nodes from the viewer */
  filteredRoots: ActionNode[];
  /** Whether a search is currently active */
  hasActiveSearch: boolean;
  /** IDs of nodes that directly matched the search */
  matchedIds?: Set<string>;
  /** Current search term (for text highlighting) */
  searchTerm?: string;
  /** Owner user ID for constructing context paths */
  ownerId: string | null;
  /** Assistant ID for ToolLoop queries */
  assistantId: string | null;
  /** Function to fetch ToolLoop events */
  getToolLoopEvents?: GetToolLoopEventsFn;
  /** Function to lazy-load child events for a node on expand */
  loadChildren?: LoadChildrenFn;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether the initial snapshot has completed. */
  hasLoaded: boolean;
  /** Whether this tab body is visible to the user. */
  isPaneVisible?: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Callback to retry after error */
  onRetry: () => void;
  /** Whether currently loading older events (infinite scroll) */
  isLoadingMore?: boolean;
  /** Whether there are more older events to load */
  hasMore?: boolean;
  /** Callback to load more older events */
  onLoadMore?: () => void;
  /** Callback to trigger node state changes */
  onExpandedChange?: (nodeId: string, expanded: boolean) => void;
  /** Set of currently expanded node IDs */
  expandedNodeIds?: Set<string>;
  /** Signal to force-expand/collapse all ToolLoop step sections */
  sectionToggleSignal?: SectionToggleSignal;
  /** Stop an in-flight root action */
  onStopAction?: (callingId: string) => void;
  /** Blow a root action up into the focus overlay */
  onFocusAction?: (callingId: string) => void;
  /** Open a root action in a new browser tab */
  onOpenActionInNewTab?: (callingId: string) => void;
  /** Additional class names */
  className?: string;
}

export function LiveActionsBody({
  hasAssistant,
  roots,
  filteredRoots,
  hasActiveSearch,
  matchedIds,
  searchTerm,
  ownerId,
  assistantId,
  getToolLoopEvents,
  loadChildren,
  isLoading,
  hasLoaded,
  isPaneVisible = true,
  error,
  onRetry,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  expandedNodeIds,
  onExpandedChange,
  sectionToggleSignal,
  onStopAction,
  onFocusAction,
  onOpenActionInNewTab,
  className,
}: LiveActionsBodyProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = React.useRef(isLoadingMore);
  const prevScrollHeightRef = React.useRef<number | null>(null);
  const prevRootsLengthRef = React.useRef(roots.length);
  const isUserScrolledUpRef = React.useRef(false);
  isLoadingMoreRef.current = isLoadingMore;

  // Handle scroll for infinite loading + track distance from bottom
  const handleScroll = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Infinite load: trigger when scrolled near the top
    if (hasMore && !isLoadingMoreRef.current && onLoadMore && container.scrollTop < 50) {
      prevScrollHeightRef.current = container.scrollHeight;
      onLoadMore();
    }

    // Track if user has scrolled away from bottom
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isUserScrolledUpRef.current = distFromBottom > 80;
  }, [hasMore, onLoadMore]);

  // Preserve scroll position when older events are prepended
  React.useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (prevScrollHeightRef.current !== null && roots.length > prevRootsLengthRef.current) {
      const scrollHeightDiff = container.scrollHeight - prevScrollHeightRef.current;
      if (scrollHeightDiff > 0) {
        container.scrollTop += scrollHeightDiff;
      }
      prevScrollHeightRef.current = null;
    }

    prevRootsLengthRef.current = roots.length;
  }, [roots.length]);

  // Auto-scroll to bottom when new roots arrive or content grows.
  // Only suppressed when the user has scrolled up (reading older content).
  // Cursor position doesn't matter -- if they're at the bottom, they're
  // following along and want to see new events regardless of hover state.
  React.useEffect(() => {
    if (isUserScrolledUpRef.current) return;
    const container = scrollContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [roots, filteredRoots]);

  // Observe inner content height changes (e.g. streaming ToolLoop events
  // inside an expanded child) and keep the outer container pinned to the
  // bottom. This covers growth that doesn't change the roots/filteredRoots
  // references — such as liveToolLoopLogs mutations on child nodes.
  const contentObserverRef = React.useRef<ResizeObserver | null>(null);
  const hasRoots = roots.length > 0;
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const content = container.firstElementChild as HTMLElement | null;
    if (!content) return;

    contentObserverRef.current = new ResizeObserver(() => {
      if (isUserScrolledUpRef.current) return;
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    });
    contentObserverRef.current.observe(content);
    return () => contentObserverRef.current?.disconnect();
  }, [hasRoots]);

  const hasSearchNoMatches = hasActiveSearch && filteredRoots.length === 0 && roots.length > 0;
  const showBlockingLoad = isPaneVisible && isLoading && (!hasLoaded || roots.length === 0);

  // No assistant selected state
  if (!hasAssistant) {
    return (
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground',
          className
        )}
        data-testid="live-actions-no-assistant"
      >
        <p className="cursor-default text-center">Select a teammate to watch live actions.</p>
      </div>
    );
  }

  // Loading state — skeleton rows during first load, time-window changes, and
  // manual refresh so the pane never flashes "No actions found" mid-fetch.
  if (showBlockingLoad) {
    return (
      <div
        className={cn('flex flex-1 flex-col gap-2 overflow-hidden p-3', className)}
        data-testid="live-actions-loading"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <ActionCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state (only show if no data)
  if (error && roots.length === 0) {
    return (
      <div
        className={cn('flex flex-1 flex-col items-center justify-center gap-3', className)}
        data-testid="live-actions-error"
      >
        <div className="flex items-center text-destructive">
          <AlertCircle className="mr-2 h-5 w-5" />
          <span className="text-sm">Failed to load actions</span>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Empty state (assistant selected but no events)
  if (roots.length === 0) {
    return (
      <div
        className={cn('flex flex-1 items-center justify-center text-muted-foreground', className)}
        data-testid="live-actions-empty"
      >
        <p className="text-sm">No actions found</p>
      </div>
    );
  }

  // Search with no matches
  if (hasSearchNoMatches) {
    return (
      <div
        className={cn('flex flex-1 items-center justify-center text-muted-foreground', className)}
        data-testid="live-actions-no-matches"
      >
        <p className="text-sm">No results match your search</p>
      </div>
    );
  }

  // Action tree
  return (
    <div
      className={cn('relative min-h-0 min-w-0 flex-1 overflow-hidden', className)}
      data-testid="live-actions-tree-container"
    >
      {/* Loading more indicator at top */}
      {isLoadingMore && (
        <div className="bg-background/80 absolute left-0 right-0 top-0 z-10 flex items-center justify-center py-2">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-caption">Loading earlier events...</span>
        </div>
      )}

      {/* Scrollable tree container */}
      <ScrollArea
        className="scroll-fade-y h-full"
        viewportRef={scrollContainerRef}
        viewportProps={{ onScroll: handleScroll }}
        viewportTestId="live-actions-scroll-container"
        viewportClassName="scroll-fade-y"
      >
        <div className="p-3">
          <ActionTree
            roots={filteredRoots}
            ownerId={ownerId || ''}
            assistantId={assistantId || ''}
            getToolLoopEvents={getToolLoopEvents}
            loadChildren={loadChildren}
            defaultExpanded={false}
            expandedNodeIds={expandedNodeIds}
            onExpandedChange={onExpandedChange}
            sectionToggleSignal={sectionToggleSignal}
            matchedIds={matchedIds}
            searchTerm={searchTerm}
            onStopAction={onStopAction}
            onFocusAction={onFocusAction}
            onOpenActionInNewTab={onOpenActionInNewTab}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
