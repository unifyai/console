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
} from '@/utils/assistants/assistant-actions';
import type { SectionToggleSignal } from './ActionNodeItem';
import type { ActionNode, AssistantActionActions } from '@/types/assistants/action';
import type { Assistant } from '@/types/assistants/assistant';

// ─── Mock Data (local dev only) ─────────────────────────────────────────────

const MOCK_ACTIONS: ActionNode[] = [
  {
    id: 'mock-1',
    type: 'manager',
    label: 'act',
    displayLabel: 'Taking Action',
    hierarchy: ['CodeActActor', 'act'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'running',
    startTime: new Date(Date.now() - 45_000).toISOString(),
    requestContent:
      'Search the web for the latest global headlines as of today, Sunday March 8, 2026. Return a concise summary of the top headlines across major news categories (politics, world events, business, tech, etc.).',
    childrenLoaded: true,
    children: [
      {
        id: 'mock-1-1',
        type: 'manager',
        label: 'execute_code',
        displayLabel: 'Running Code',
        hierarchy: ['CodeActActor', 'act', 'execute_code'],
        hierarchyLabel: 'CodeActActor.act → execute_code',
        status: 'completed',
        startTime: new Date(Date.now() - 40_000).toISOString(),
        endTime: new Date(Date.now() - 32_000).toISOString(),
        requestContent: 'Set up news scraping environment',
        content:
          'import requests\nfrom bs4 import BeautifulSoup\n\nresult = requests.get("https://news.google.com")\nprint(f"Status: {result.status_code}")',
        childrenLoaded: true,
        children: [],
      },
      {
        id: 'mock-1-2',
        type: 'manager',
        label: 'search_web',
        displayLabel: 'Searching the Web',
        hierarchy: ['CodeActActor', 'act', 'search_web'],
        hierarchyLabel: 'CodeActActor.act → search_web',
        status: 'running',
        startTime: new Date(Date.now() - 10_000).toISOString(),
        requestContent:
          'Search the web for the latest global headlines as of today, Sunday March 8, 2026.',
        childrenLoaded: true,
        children: [
          {
            id: 'mock-1-2-1',
            type: 'manager',
            label: 'fetch_results',
            displayLabel: 'Searching the Web',
            hierarchy: ['CodeActActor', 'act', 'search_web', 'fetch_results'],
            hierarchyLabel: 'CodeActActor.act → search_web → fetch_results',
            status: 'running',
            startTime: new Date(Date.now() - 8_000).toISOString(),
            requestContent: 'Fetching search results for "global headlines March 8 2026"',
            childrenLoaded: true,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'mock-2',
    type: 'manager',
    label: 'store_skills',
    displayLabel: 'Storing Reusable Skills',
    hierarchy: ['SkillManager', 'store'],
    hierarchyLabel: 'SkillManager.store',
    status: 'completed',
    startTime: new Date(Date.now() - 120_000).toISOString(),
    endTime: new Date(Date.now() - 95_000).toISOString(),
    requestContent: 'Store the email summary template as a reusable skill for future use.',
    content: 'Stored email_summary_template as a reusable skill.',
    childrenLoaded: true,
    children: [],
  },
  {
    id: 'mock-3',
    type: 'manager',
    label: 'ask',
    displayLabel: 'Answering Question',
    hierarchy: ['ContactManager', 'ask'],
    hierarchyLabel: 'ContactManager.ask',
    status: 'completed',
    startTime: new Date(Date.now() - 300_000).toISOString(),
    endTime: new Date(Date.now() - 270_000).toISOString(),
    requestContent: 'When is the meeting with the product team scheduled for?',
    content: 'The meeting is scheduled for 3 PM tomorrow.',
    childrenLoaded: true,
    children: [
      {
        id: 'mock-3-1',
        type: 'manager',
        label: 'lookup_contact',
        displayLabel: 'Checking Contact Book',
        hierarchy: ['ContactManager', 'ask', 'lookup_contact'],
        hierarchyLabel: 'ContactManager.ask → lookup_contact',
        status: 'completed',
        startTime: new Date(Date.now() - 295_000).toISOString(),
        endTime: new Date(Date.now() - 285_000).toISOString(),
        requestContent: 'Look up the product team meeting in the calendar.',
        content: 'Found calendar entry: "Product Team Sync" — tomorrow 3:00 PM–3:45 PM.',
        childrenLoaded: true,
        children: [],
      },
    ],
  },
  {
    id: 'mock-4',
    type: 'manager',
    label: 'read_file',
    displayLabel: 'Reading File',
    hierarchy: ['FileManager', 'read'],
    hierarchyLabel: 'FileManager.read',
    status: 'completed',
    startTime: new Date(Date.now() - 400_000).toISOString(),
    endTime: new Date(Date.now() - 395_000).toISOString(),
    requestContent: 'Read the weekly standup notes from last Friday.',
    childrenLoaded: true,
    children: [],
  },
  {
    id: 'mock-5',
    type: 'manager',
    label: 'process_memory',
    displayLabel: 'Processing Memory Chunk',
    hierarchy: ['KnowledgeManager', 'process'],
    hierarchyLabel: 'KnowledgeManager.process',
    status: 'completed',
    startTime: new Date(Date.now() - 500_000).toISOString(),
    endTime: new Date(Date.now() - 480_000).toISOString(),
    requestContent:
      'Process and index the conversation transcript from the client onboarding call.',
    childrenLoaded: true,
    children: [],
  },
  {
    id: 'mock-6',
    type: 'manager',
    label: 'work_on_task',
    displayLabel: 'Working on Task',
    hierarchy: ['TaskScheduler', 'execute'],
    hierarchyLabel: 'TaskScheduler.execute',
    status: 'completed',
    startTime: new Date(Date.now() - 600_000).toISOString(),
    endTime: new Date(Date.now() - 550_000).toISOString(),
    requestContent: 'Draft the weekly report and send it to the team.',
    content: 'Completed: Draft weekly report and send to team.',
    childrenLoaded: true,
    children: [
      {
        id: 'mock-6-1',
        type: 'manager',
        label: 'draft_report',
        displayLabel: 'Working on Task',
        hierarchy: ['TaskScheduler', 'execute', 'draft_report'],
        hierarchyLabel: 'TaskScheduler.execute → draft_report',
        status: 'completed',
        startTime: new Date(Date.now() - 595_000).toISOString(),
        endTime: new Date(Date.now() - 570_000).toISOString(),
        requestContent: 'Draft the weekly summary from standup notes and project updates.',
        content:
          '# Weekly Report — March 7, 2026\n\n## Highlights\n- Shipped v2.3 of the dashboard\n- Client onboarding completed for Acme Corp\n- Infrastructure migration 80% done\n\n## Blockers\n- Waiting on legal review for data processing agreement',
        childrenLoaded: true,
        children: [],
      },
      {
        id: 'mock-6-2',
        type: 'manager',
        label: 'send_email',
        displayLabel: 'Working on Task',
        hierarchy: ['TaskScheduler', 'execute', 'send_email'],
        hierarchyLabel: 'TaskScheduler.execute → send_email',
        status: 'completed',
        startTime: new Date(Date.now() - 565_000).toISOString(),
        endTime: new Date(Date.now() - 555_000).toISOString(),
        requestContent: 'Send the drafted weekly report to team@company.com.',
        content: 'Email sent successfully to team@company.com.',
        childrenLoaded: true,
        children: [],
      },
    ],
  },
];

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

  const isDev = process.env.NODE_ENV === 'development';
  const displayRoots =
    isDev && hasAssistant && roots.length === 0 && !isLoading ? MOCK_ACTIONS : roots;

  const counts = React.useMemo(() => countActionNodes(displayRoots), [displayRoots]);

  const expandableNodeIds = React.useMemo(() => getExpandableNodeIds(displayRoots), [displayRoots]);

  const allExpanded = React.useMemo(() => {
    if (expandableNodeIds.size === 0) return true;
    return areAllNodesExpanded(displayRoots, expandedNodeIds);
  }, [displayRoots, expandedNodeIds, expandableNodeIds]);

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
        assistantId={assistant?.agentId || null}
        getToolLoopEvents={actions?.getToolLoopEvents}
        loadChildren={loadChildren}
        searchTerm={searchTerm}
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
        />
      )}
    </div>
  );
}
