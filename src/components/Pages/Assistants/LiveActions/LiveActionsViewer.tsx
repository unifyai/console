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
 * - All nodes start collapsed; manual expand/collapse only
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  LiveActionsHeader,
  TIME_WINDOW_PRESETS,
  DEFAULT_TIME_WINDOW_KEY,
} from './LiveActionsHeader';
import { LiveActionsBody } from './LiveActionsBody';
import { LiveActionsFooter } from './LiveActionsFooter';
import { useAssistantActions } from '@/hooks/Assistants/useAssistantActions';
import {
  countActionNodes,
  areAllNodesExpanded,
  getExpandableNodeIds,
  filterActionTree,
} from '@/utils/assistants/assistant-actions';
import type { SectionToggleSignal } from './ActionNodeItem';
import type { AssistantActionActions } from '@/types/assistants/action';
import type { Assistant } from '@/types/assistants/assistant';
import { USE_MOCK_DATA, MOCK_ACTION_ROOTS } from '@/utils/assistants/action-mock-data';

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
  const [expandedNodeIds, setExpandedNodeIds] = React.useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [isVisible, setIsVisible] = React.useState(true);
  const [sectionToggleSignal, setSectionToggleSignal] = React.useState<SectionToggleSignal>({
    open: false,
    gen: 0,
  });
  const [timeWindowKey, setTimeWindowKey] = React.useState(DEFAULT_TIME_WINDOW_KEY);

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

  // Compute the lookback ms from the selected preset (dynamic for Today/Yesterday)
  const lookbackMs = React.useMemo(() => {
    const preset = TIME_WINDOW_PRESETS.find((p) => p.key === timeWindowKey);
    return preset ? preset.getMs() : 3 * 3_600_000;
  }, [timeWindowKey]);

  const {
    roots,
    hasActiveAction,
    isLoading,
    error,
    refresh,
    loadMore,
    loadChildren,
    hasMore,
    connectionStatus,
  } = useAssistantActions(
    hasAssistant ? assistant.agentId : '',
    actions || { getManagerMethodEvents: async () => ({ logs: [], count: 0 }) },
    {
      enabled: shouldPoll,
      initialLookbackMs: lookbackMs,
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

  const displayRoots = USE_MOCK_DATA ? MOCK_ACTION_ROOTS : roots;

  const counts = React.useMemo(() => countActionNodes(displayRoots), [displayRoots]);

  const expandableNodeIds = React.useMemo(() => getExpandableNodeIds(displayRoots), [displayRoots]);

  const allExpanded = React.useMemo(() => {
    if (expandableNodeIds.size === 0) return true;
    return areAllNodesExpanded(displayRoots, expandedNodeIds);
  }, [displayRoots, expandedNodeIds, expandableNodeIds]);

  const { filteredRoots, matchedIds } = React.useMemo(
    () => filterActionTree(displayRoots, searchTerm),
    [displayRoots, searchTerm]
  );

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
    setSectionToggleSignal((prev) => ({ open: true, gen: prev.gen + 1 }));
  }, [expandableNodeIds]);

  const handleCollapseAll = React.useCallback(() => {
    setExpandedNodeIds(new Set());
    setSectionToggleSignal((prev) => ({ open: false, gen: prev.gen + 1 }));
  }, []);

  // When the time window preset changes, clear events and re-fetch with the new window.
  const isFirstRenderRef = React.useRef(true);
  const handleTimeWindowChange = React.useCallback((key: string) => {
    setTimeWindowKey(key);
  }, []);

  React.useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    // Clear tree so the loading state shows while re-fetching
    refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindowKey]);

  // Manual refresh handler (polls from Orchestra on demand)
  const [isManualRefreshing, setIsManualRefreshing] = React.useState(false);
  const handleManualRefresh = React.useCallback(async () => {
    if (isManualRefreshing) return;
    setIsManualRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsManualRefreshing(false);
    }
  }, [refresh, isManualRefreshing]);

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

  const totalMatches = searchTerm.trim() !== '' ? matchedIds.size : 0;

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Reset state when assistant changes
  React.useEffect(() => {
    setSearchTerm('');
    setExpandedNodeIds(new Set());
    setLastUpdated(null);
    preSearchExpandedRef.current = null;
    setTimeWindowKey(DEFAULT_TIME_WINDOW_KEY);
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
          searchMatchCount={searchTerm.trim() !== '' ? totalMatches : undefined}
          allExpanded={allExpanded}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          expandCollapseDisabled={expandableNodeIds.size === 0}
          timeWindowKey={timeWindowKey}
          onTimeWindowChange={handleTimeWindowChange}
          onRefresh={handleManualRefresh}
          isRefreshing={isManualRefreshing}
          isLoading={isLoading}
        />
      )}

      {/* Body - main content area */}
      <LiveActionsBody
        hasAssistant={hasAssistant}
        roots={displayRoots}
        filteredRoots={filteredRoots}
        hasActiveSearch={searchTerm.trim() !== ''}
        matchedIds={searchTerm.trim() !== '' ? matchedIds : undefined}
        searchTerm={searchTerm.trim() !== '' ? searchTerm : undefined}
        assistantId={assistant?.agentId || null}
        getToolLoopEvents={actions?.getToolLoopEvents}
        loadChildren={loadChildren}
        isLoading={isLoading}
        error={error}
        onRetry={refresh}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        expandedNodeIds={expandedNodeIds}
        onExpandedChange={handleExpandedChange}
        sectionToggleSignal={sectionToggleSignal}
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
          isMockData={USE_MOCK_DATA}
        />
      )}
    </div>
  );
}
