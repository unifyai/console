/**
 * LiveActionsViewer - Container component for the Live Actions panel.
 *
 * This component replaces the Task List in the main layout and provides
 * a full-height view of assistant actions with:
 * - Header with search, expand/collapse, and auto-fold controls
 * - Body with action tree and various states
 * - Footer with status indicators
 *
 * Features:
 * - Polls for new events when an assistant is selected
 * - Supports search filtering
 * - Supports expand/collapse all
 * - Auto-collapses completed nodes (configurable)
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { LiveActionsHeader } from './LiveActionsHeader';
import { LiveActionsBody } from './LiveActionsBody';
import { LiveActionsFooter } from './LiveActionsFooter';
import { useAssistantActions } from '@/hooks/Assistants/useAssistantActions';
import {
  countActionNodes,
  areAllNodesExpanded,
  getExpandableNodeIds,
} from '@/utils/assistants/assistant-actions';
import type { AssistantActionActions } from '@/types/assistants/action';
import type { Assistant } from '@/types/assistants/assistant';

export interface LiveActionsViewerProps {
  /** The currently selected assistant (null if none selected) */
  assistant: Assistant | null;
  /** Server actions for fetching events */
  actions: AssistantActionActions | null;
  /** Additional class names */
  className?: string;
}

export function LiveActionsViewer({ assistant, actions, className }: LiveActionsViewerProps) {
  // ==========================================================================
  // State
  // ==========================================================================

  const [searchTerm, setSearchTerm] = React.useState('');
  const [autoCollapse, setAutoCollapse] = React.useState(true);
  const [expandedNodeIds, setExpandedNodeIds] = React.useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [isVisible, setIsVisible] = React.useState(true);

  // Store expand state before search for restoration
  const preSearchExpandedRef = React.useRef<Set<string> | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // ==========================================================================
  // Visibility-based Polling
  // ==========================================================================

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Consider visible if any part of the element is in view
        const isInView = entries.some((entry) => entry.isIntersecting);
        setIsVisible(isInView);
      },
      { threshold: 0 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  const hasAssistant = assistant !== null && actions !== null;

  // Only poll when visible AND assistant is selected
  const shouldPoll = hasAssistant && isVisible;

  const { roots, hasActiveAction, isLoading, error, refresh, loadMore, hasMore, connectionStatus } =
    useAssistantActions(
      hasAssistant ? assistant.agentId : '',
      actions || { getManagerMethodEvents: async () => ({ logs: [], count: 0 }) },
      {
        enabled: shouldPoll,
        pollingInterval: 10000,
      }
    );

  // Track loading more state separately for UI
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const loadMoreRef = React.useRef(loadMore);
  loadMoreRef.current = loadMore;

  const handleLoadMore = React.useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      await loadMoreRef.current();
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore]);

  // Track last updated time based on loading state changes
  const prevIsLoadingRef = React.useRef(isLoading);
  React.useEffect(() => {
    // Update timestamp when loading completes (transition from true to false)
    if (prevIsLoadingRef.current && !isLoading && !error) {
      setLastUpdated(new Date());
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, error]);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  const counts = React.useMemo(() => countActionNodes(roots), [roots]);

  const expandableNodeIds = React.useMemo(() => getExpandableNodeIds(roots), [roots]);

  const allExpanded = React.useMemo(() => {
    if (expandableNodeIds.size === 0) return true;
    return areAllNodesExpanded(roots, expandedNodeIds);
  }, [roots, expandedNodeIds, expandableNodeIds]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleSearchChange = React.useCallback(
    (term: string) => {
      setSearchTerm((prev) => {
        // Save expand state when starting search
        if (prev.trim() === '' && term.trim() !== '') {
          preSearchExpandedRef.current = new Set(expandedNodeIds);
        }
        // Restore expand state when clearing search
        if (prev.trim() !== '' && term.trim() === '') {
          if (preSearchExpandedRef.current) {
            setExpandedNodeIds(preSearchExpandedRef.current);
            preSearchExpandedRef.current = null;
          }
        }
        return term;
      });
    },
    [expandedNodeIds]
  );

  const handleExpandAll = React.useCallback(() => {
    setExpandedNodeIds(new Set(expandableNodeIds));
  }, [expandableNodeIds]);

  const handleCollapseAll = React.useCallback(() => {
    setExpandedNodeIds(new Set());
  }, []);

  const handleAutoCollapseChange = React.useCallback((enabled: boolean) => {
    // Note: Per design decision, changing this setting does NOT
    // auto-expand/collapse existing nodes mid-session
    setAutoCollapse(enabled);
  }, []);

  const handleExpandedChange = React.useCallback((nodeId: string, expanded: boolean) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (expanded) {
        next.add(nodeId);
      } else {
        next.delete(nodeId);
      }
      return next;
    });
  }, []);

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Track which nodes were running so we can auto-collapse on completion
  const prevRunningRef = React.useRef<Set<string>>(new Set());

  // Auto-expand running nodes, auto-collapse nodes that just completed
  React.useEffect(() => {
    if (roots.length === 0) return;

    const currentRunning = new Set<string>();
    const collectRunning = (nodes: typeof roots) => {
      for (const node of nodes) {
        if (node.status === 'running') currentRunning.add(node.id);
        collectRunning(node.children);
      }
    };
    collectRunning(roots);

    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      currentRunning.forEach((id) => next.add(id));
      if (autoCollapse) {
        prevRunningRef.current.forEach((id) => {
          if (!currentRunning.has(id)) next.delete(id);
        });
      }
      return next;
    });

    prevRunningRef.current = currentRunning;
  }, [roots, autoCollapse]);

  // Reset state when assistant changes
  React.useEffect(() => {
    setSearchTerm('');
    setExpandedNodeIds(new Set());
    setLastUpdated(null);
    preSearchExpandedRef.current = null;
  }, [assistant?.agentId]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div
      ref={containerRef}
      className={cn('flex h-full flex-col bg-background', className)}
      data-testid="live-actions-viewer"
    >
      {/* Header - always shown when assistant is selected */}
      {hasAssistant && (
        <LiveActionsHeader
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          allExpanded={allExpanded}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          expandCollapseDisabled={expandableNodeIds.size === 0}
          autoCollapse={autoCollapse}
          onAutoCollapseChange={handleAutoCollapseChange}
        />
      )}

      {/* Body - main content area */}
      <LiveActionsBody
        hasAssistant={hasAssistant}
        roots={roots}
        assistantId={assistant?.agentId || null}
        getToolLoopEvents={actions?.getToolLoopEvents}
        searchTerm={searchTerm}
        autoCollapse={autoCollapse}
        isLoading={isLoading}
        error={error}
        onRetry={refresh}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        expandedNodeIds={expandedNodeIds}
        onExpandedChange={handleExpandedChange}
        className="flex-1"
      />

      {/* Footer - only shown when assistant is selected */}
      {hasAssistant && (
        <LiveActionsFooter
          assistantName={assistant.firstName}
          isWorking={hasActiveAction}
          runningCount={counts.running}
          completedCount={counts.completed}
          lastUpdated={lastUpdated}
          connectionStatus={connectionStatus}
        />
      )}
    </div>
  );
}
