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
import { ActionFocusOverlay } from './ActionFocusOverlay';
import { useAssistantActions } from '@/hooks/Assistants/useAssistantActions';
import { fetchToolLoopEvents } from '@/lib/client/actions';
import {
  countActionNodes,
  areAllNodesExpanded,
  getExpandableNodeIds,
  filterActionTree,
} from '@/utils/assistants/assistant-actions';
import type { SectionToggleSignal } from './ActionNodeItem';
import {
  buildActionDeepLinkUrl,
  readActionDeepLink,
  type ActionDeepLink,
} from '@/utils/assistants/action-deep-link';
import type { ActionNode, AssistantActionActions } from '@/types/assistants/action';
import type { Assistant } from '@/types/assistants/assistant';
import { USE_MOCK_DATA, MOCK_ACTION_ROOTS } from '@/utils/assistants/action-mock-data';

export interface LiveActionsViewerProps {
  /** The currently selected assistant (null if none selected) */
  assistant: Assistant | null;
  /** Server actions for fetching events */
  actions: AssistantActionActions | null;
  /** Additional class names */
  className?: string;
  /** Notifies parent when hasActiveAction changes (for dashboard polling) */
  onHasActiveActionChange?: (active: boolean) => void;
  /** True when the Actions tab body is the active right-pane tab */
  isPaneVisible?: boolean;
  /** Reports root-level live activity that arrived while the pane was hidden. */
  onUnreadLiveActivityChange?: (hasUnread: boolean) => void;
}

function timeWindowStorageKey(agentId: string): string {
  return `console:assistants:actions-time-window:${agentId}`;
}

function readStoredTimeWindow(agentId: string | undefined): string {
  if (!agentId || typeof window === 'undefined') return DEFAULT_TIME_WINDOW_KEY;
  try {
    return sessionStorage.getItem(timeWindowStorageKey(agentId)) ?? DEFAULT_TIME_WINDOW_KEY;
  } catch {
    return DEFAULT_TIME_WINDOW_KEY;
  }
}

/**
 * A pending deep link's window wins over the stored one so the action it names
 * is inside the range that gets fetched.
 */
function resolveTimeWindow(agentId: string | undefined, deepLink: ActionDeepLink | null): string {
  const requested = deepLink?.timeWindowKey;
  if (requested && TIME_WINDOW_PRESETS.some((preset) => preset.key === requested)) {
    return requested;
  }
  return readStoredTimeWindow(agentId);
}

export function LiveActionsViewer({
  assistant,
  actions,
  className,
  onHasActiveActionChange,
  isPaneVisible = true,
  onUnreadLiveActivityChange,
}: LiveActionsViewerProps) {
  // ==========================================================================
  // State
  // ==========================================================================

  const [searchTerm, setSearchTerm] = React.useState('');
  const [expandedNodeIds, setExpandedNodeIds] = React.useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [sectionToggleSignal, setSectionToggleSignal] = React.useState<SectionToggleSignal>({
    open: false,
    gen: 0,
  });
  // A `?action=` deep link opens that root in the focus overlay once it loads.
  // Held in a ref and cleared on first use so closing the overlay doesn't
  // immediately reopen it while the param is still on the URL.
  const pendingDeepLinkRef = React.useRef<ActionDeepLink | null>(readActionDeepLink());
  const [focusedActionId, setFocusedActionId] = React.useState<string | null>(null);
  const [focusOpenedFromDeepLink, setFocusOpenedFromDeepLink] = React.useState(false);

  const [timeWindowKey, setTimeWindowKey] = React.useState(() =>
    resolveTimeWindow(assistant?.agentId, pendingDeepLinkRef.current)
  );

  // Store expand state before search for restoration
  const preSearchExpandedRef = React.useRef<Set<string> | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const prevRootIdsRef = React.useRef<Set<string>>(new Set());
  // When true, the next roots load skips auto-expand (historic pulls should
  // start collapsed).  Stays true across the intermediate empty-roots state
  // that refresh(true) causes, and resets once real data arrives.
  // Start suppressed so the initial bulk load of roots renders collapsed;
  // it flips off after the first batch so genuinely new live SSE roots still
  // auto-expand.
  const suppressAutoExpandRef = React.useRef(true);
  const wasPaneVisibleRef = React.useRef(isPaneVisible);
  const pendingAutoExpandRef = React.useRef<Set<string>>(new Set());

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  const hasAssistant = assistant !== null && actions !== null;

  // Subscribe whenever an assistant is selected so Chat can observe live work
  // while the Actions tab is hidden. Visibility only gates auto-expand UX.
  const shouldSubscribe = hasAssistant;

  // Compute the lookback ms from the selected preset (dynamic for Today/Yesterday)
  const lookbackMs = React.useMemo(() => {
    const preset = TIME_WINDOW_PRESETS.find((p) => p.key === timeWindowKey);
    return preset ? preset.getMs() : 3 * 3_600_000;
  }, [timeWindowKey]);

  const {
    roots,
    hasActiveAction,
    isLoading,
    hasLoaded,
    error,
    refresh,
    loadMore,
    loadChildren,
    hasMore,
    connectionStatus,
    hasUnreadLiveActivity,
    stopAction,
  } = useAssistantActions(
    hasAssistant ? assistant.userId : '',
    hasAssistant ? assistant.agentId : '',
    actions || { getManagerMethodEvents: async () => ({ logs: [], count: 0 }) },
    {
      enabled: shouldSubscribe,
      initialLookbackMs: lookbackMs,
      isPaneVisible,
    }
  );

  React.useEffect(() => {
    onHasActiveActionChange?.(hasActiveAction);
  }, [hasActiveAction, onHasActiveActionChange]);

  React.useEffect(() => {
    onUnreadLiveActivityChange?.(hasUnreadLiveActivity);
  }, [hasUnreadLiveActivity, onUnreadLiveActivityChange]);

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
    if (expandableNodeIds.size === 0) return false;
    return areAllNodesExpanded(displayRoots, expandedNodeIds);
  }, [displayRoots, expandedNodeIds, expandableNodeIds]);

  const { filteredRoots, matchedIds } = React.useMemo(
    () => filterActionTree(displayRoots, searchTerm),
    [displayRoots, searchTerm]
  );

  // Resolved from the live tree rather than snapshotted, so the overlay keeps
  // streaming while it is open. Goes null if the root leaves the window.
  const focusedNode = React.useMemo(
    () => (focusedActionId ? (displayRoots.find((r) => r.id === focusedActionId) ?? null) : null),
    [displayRoots, focusedActionId]
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
  const prevAgentForTimeWindowRef = React.useRef(assistant?.agentId);
  const handleTimeWindowChange = React.useCallback((key: string) => {
    setTimeWindowKey(key);
  }, []);

  React.useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevAgentForTimeWindowRef.current = assistant?.agentId;
      return;
    }
    if (prevAgentForTimeWindowRef.current !== assistant?.agentId) {
      prevAgentForTimeWindowRef.current = assistant?.agentId;
      return;
    }
    suppressAutoExpandRef.current = true;
    setExpandedNodeIds(new Set());
    // The focused root may not exist in the new window at all.
    setFocusedActionId(null);
    setFocusOpenedFromDeepLink(false);
    refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindowKey, assistant?.agentId]);

  // Manual refresh handler (polls from Orchestra on demand).
  // Mirrors the historic-pull behaviour: nodes start collapsed and
  // auto-expand is suppressed so the refreshed tree isn't noisy.
  const [isManualRefreshing, setIsManualRefreshing] = React.useState(false);
  const handleManualRefresh = React.useCallback(async () => {
    if (isManualRefreshing) return;
    setIsManualRefreshing(true);
    suppressAutoExpandRef.current = true;
    setExpandedNodeIds(new Set());
    try {
      await refresh(true);
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

  const handleFocusAction = React.useCallback((callingId: string) => {
    setFocusedActionId(callingId);
    setFocusOpenedFromDeepLink(false);
  }, []);

  const handleCloseFocusedAction = React.useCallback(() => {
    setFocusedActionId(null);
    setFocusOpenedFromDeepLink(false);
  }, []);

  const handleOpenActionInNewTab = React.useCallback(
    (callingId: string) => {
      if (!assistant) return;
      window.open(
        buildActionDeepLinkUrl(assistant.agentId, callingId, timeWindowKey),
        '_blank',
        'noopener,noreferrer'
      );
    },
    [assistant, timeWindowKey]
  );

  const totalMatches = searchTerm.trim() !== '' ? matchedIds.size : 0;

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Auto-expand newly arriving root action nodes (live SSE only).
  // Historic pulls (time-window change) and manual refreshes set
  // suppressAutoExpandRef so bulk-loaded roots start collapsed.
  React.useEffect(() => {
    const currentIds = new Set(roots.map((r) => r.id));

    if (suppressAutoExpandRef.current) {
      prevRootIdsRef.current = currentIds;
      if (currentIds.size > 0) suppressAutoExpandRef.current = false;
      return;
    }

    // Skip transient empty state (e.g. clearTree during refresh) so that
    // prevRootIdsRef isn't reset — otherwise every root looks "new" when
    // the real data arrives and all nodes would auto-expand.
    if (currentIds.size === 0) return;

    const newIds: string[] = [];
    currentIds.forEach((id) => {
      if (!prevRootIdsRef.current.has(id)) newIds.push(id);
    });
    prevRootIdsRef.current = currentIds;

    if (newIds.length === 0) return;

    if (isPaneVisible) {
      setExpandedNodeIds((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.add(id));
        return next;
      });
      setSectionToggleSignal((prev) => ({ open: true, gen: prev.gen + 1 }));
    } else {
      newIds.forEach((id) => pendingAutoExpandRef.current.add(id));
    }
  }, [roots, isPaneVisible]);

  // When the Actions tab becomes visible, expand running roots and any
  // live roots that arrived while the tab was hidden.
  React.useEffect(() => {
    const becameVisible = isPaneVisible && !wasPaneVisibleRef.current;
    wasPaneVisibleRef.current = isPaneVisible;
    if (!becameVisible) return;

    const toExpand = new Set(pendingAutoExpandRef.current);
    roots.filter((root) => root.status === 'running').forEach((root) => toExpand.add(root.id));
    pendingAutoExpandRef.current.clear();

    if (toExpand.size === 0) return;

    setExpandedNodeIds((prev) => new Set([...prev, ...toExpand]));
    setSectionToggleSignal((prev) => ({ open: true, gen: prev.gen + 1 }));
  }, [isPaneVisible, roots]);

  // Open the deep-linked root once the snapshot that should contain it lands.
  // Runs at most once per pending link, whether or not the root turned up, so
  // a stale `?action=` can't keep reopening the overlay.
  React.useEffect(() => {
    const pending = pendingDeepLinkRef.current;
    if (!pending || !hasLoaded) return;
    pendingDeepLinkRef.current = null;

    if (!roots.some((root) => root.id === pending.callingId)) return;
    setFocusedActionId(pending.callingId);
    setFocusOpenedFromDeepLink(true);
  }, [hasLoaded, roots]);

  // Reset search/expand UI when assistant changes; time window restores from session storage.
  React.useEffect(() => {
    setSearchTerm('');
    setExpandedNodeIds(new Set());
    setLastUpdated(null);
    setFocusedActionId(null);
    setFocusOpenedFromDeepLink(false);
    preSearchExpandedRef.current = null;
    prevRootIdsRef.current = new Set();
    suppressAutoExpandRef.current = true;
    pendingAutoExpandRef.current.clear();
    setTimeWindowKey(resolveTimeWindow(assistant?.agentId, pendingDeepLinkRef.current));
  }, [assistant?.agentId]);

  React.useEffect(() => {
    if (!assistant?.agentId) return;
    try {
      sessionStorage.setItem(timeWindowStorageKey(assistant.agentId), timeWindowKey);
    } catch {
      /* optional persistence */
    }
  }, [assistant?.agentId, timeWindowKey]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div
      ref={containerRef}
      className={cn('flex h-full min-h-0 min-w-0 flex-col bg-transparent', className)}
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
        ownerId={assistant?.userId || null}
        assistantId={assistant?.agentId || null}
        getToolLoopEvents={hasAssistant ? fetchToolLoopEvents : undefined}
        loadChildren={loadChildren}
        isLoading={isLoading}
        hasLoaded={hasLoaded}
        isPaneVisible={isPaneVisible}
        error={error}
        onRetry={() => void refresh(true)}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        expandedNodeIds={expandedNodeIds}
        onExpandedChange={handleExpandedChange}
        sectionToggleSignal={sectionToggleSignal}
        onStopAction={hasAssistant ? (callingId) => void stopAction(callingId) : undefined}
        onFocusAction={hasAssistant ? handleFocusAction : undefined}
        onOpenActionInNewTab={hasAssistant ? handleOpenActionInNewTab : undefined}
        className="flex-1"
      />

      {focusedNode && (
        <ActionFocusOverlay
          node={focusedNode}
          ownerId={assistant?.userId}
          assistantId={assistant?.agentId}
          getToolLoopEvents={hasAssistant ? fetchToolLoopEvents : undefined}
          loadChildren={loadChildren}
          searchTerm={searchTerm.trim() !== '' ? searchTerm : undefined}
          matchedIds={searchTerm.trim() !== '' ? matchedIds : undefined}
          onStopAction={hasAssistant ? (callingId) => void stopAction(callingId) : undefined}
          onOpenInNewTab={hasAssistant ? () => handleOpenActionInNewTab(focusedNode.id) : undefined}
          onClose={handleCloseFocusedAction}
          initiallyMaximized={focusOpenedFromDeepLink}
        />
      )}

      {/* Footer - only shown when assistant is selected */}
      {hasAssistant && (
        <LiveActionsFooter
          assistantName={assistant.firstName}
          isWorking={hasActiveAction}
          runningCount={counts.running}
          awaitingCount={counts.awaiting}
          completedCount={counts.completed}
          lastUpdated={lastUpdated}
          connectionStatus={connectionStatus}
          isMockData={USE_MOCK_DATA}
        />
      )}
    </div>
  );
}
