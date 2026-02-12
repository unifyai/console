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
import { Button } from '@/components/UI/button';
import { ActionTree } from './ActionTree';
import { filterActionTree } from '@/utils/assistants/assistant-actions';
import type { ActionNode, GetToolLoopEventsFn } from '@/types/assistants/action';

export interface LiveActionsBodyProps {
  /** Whether an assistant is selected */
  hasAssistant: boolean;
  /** Root nodes of the action tree */
  roots: ActionNode[];
  /** Assistant ID for ToolLoop queries */
  assistantId: string | null;
  /** Function to fetch ToolLoop events */
  getToolLoopEvents?: GetToolLoopEventsFn;
  /** Current search term for filtering */
  searchTerm: string;
  /** Whether to auto-collapse completed nodes */
  autoCollapse: boolean;
  /** Whether data is loading */
  isLoading: boolean;
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
  /** Additional class names */
  className?: string;
}

export function LiveActionsBody({
  hasAssistant,
  roots,
  assistantId,
  getToolLoopEvents,
  searchTerm,
  autoCollapse,
  isLoading,
  error,
  onRetry,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  expandedNodeIds,
  onExpandedChange,
  className,
}: LiveActionsBodyProps) {
  // Filter tree based on search term
  const filteredRoots = React.useMemo(() => {
    return filterActionTree(roots, searchTerm);
  }, [roots, searchTerm]);

  // Scroll container ref for infinite scroll and position preservation
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = React.useRef(isLoadingMore);
  const prevScrollHeightRef = React.useRef<number | null>(null);
  const prevRootsLengthRef = React.useRef(roots.length);
  isLoadingMoreRef.current = isLoadingMore;

  // Handle scroll for infinite loading
  const handleScroll = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasMore || isLoadingMoreRef.current || !onLoadMore) return;

    // Trigger load more when scrolled near the top (within 50px)
    if (container.scrollTop < 50) {
      // Capture scroll height before loading more (for position preservation)
      prevScrollHeightRef.current = container.scrollHeight;
      onLoadMore();
    }
  }, [hasMore, onLoadMore]);

  // Preserve scroll position when older events are prepended
  React.useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // If we just loaded more events (roots length increased) and we have a saved scroll height
    if (prevScrollHeightRef.current !== null && roots.length > prevRootsLengthRef.current) {
      // Calculate how much content was added at the top
      const scrollHeightDiff = container.scrollHeight - prevScrollHeightRef.current;

      // Adjust scroll position to maintain the user's view
      if (scrollHeightDiff > 0) {
        container.scrollTop += scrollHeightDiff;
      }

      // Clear the saved scroll height
      prevScrollHeightRef.current = null;
    }

    // Update previous roots length
    prevRootsLengthRef.current = roots.length;
  }, [roots.length]);

  // Check for search with no matches
  const hasSearchNoMatches =
    searchTerm.trim() !== '' && filteredRoots.length === 0 && roots.length > 0;

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
        <p className="text-center">Select an assistant to watch them work</p>
      </div>
    );
  }

  // Loading state (initial load only)
  if (isLoading && roots.length === 0) {
    return (
      <div
        className={cn('flex flex-1 items-center justify-center text-muted-foreground', className)}
        data-testid="live-actions-loading"
      >
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">Loading actions...</span>
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
        <p className="text-sm">No recent actions</p>
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
        <p className="text-sm">No matching actions</p>
      </div>
    );
  }

  // Action tree
  return (
    <div
      className={cn('relative flex-1 overflow-hidden', className)}
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
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto p-3"
        style={{ scrollbarWidth: 'thin' }}
        onScroll={handleScroll}
        data-testid="live-actions-scroll-container"
      >
        <ActionTree
          roots={filteredRoots}
          assistantId={assistantId || ''}
          getToolLoopEvents={getToolLoopEvents}
          defaultExpanded={!autoCollapse}
          expandedNodeIds={expandedNodeIds}
          onExpandedChange={onExpandedChange}
        />
      </div>

      {/* Subtle loading indicator when refreshing with data */}
      {isLoading && roots.length > 0 && (
        <div className="absolute right-3 top-3">
          <Loader2 className="text-muted-foreground/50 h-4 w-4 animate-spin" />
        </div>
      )}
    </div>
  );
}
