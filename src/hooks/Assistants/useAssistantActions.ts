/**
 * Hook for fetching and managing assistant action events.
 *
 * This hook handles:
 * - Initial loading of ManagerMethod events from Orchestra
 * - Live streaming of new events via SSE from Pub/Sub (primary real-time channel)
 * - One-shot catch-up poll from Orchestra on SSE reconnect or tab visibility change
 * - Building and maintaining the action tree structure
 * - Detecting active actions
 */

import * as React from 'react';
import {
  buildActionTree,
  mergeNewEvents,
  hasActiveRootAction,
  ACTION_LOOKBACK_MS,
  isUserFacingAction,
} from '@/utils/assistants/assistant-actions';
import type {
  ActionNode,
  ManagerMethodLog,
  AssistantActionActions,
} from '@/types/assistants/action';

// =============================================================================
// Types
// =============================================================================

/** Connection status for live updates */
export type ActionConnectionStatus = 'idle' | 'streaming' | 'error';

export interface UseAssistantActionsOptions {
  /** Whether to enable fetching and live updates. Default: false */
  enabled?: boolean;

  /** Time window for initial load in milliseconds. Default: ACTION_LOOKBACK_MS (3 hours) */
  initialLookbackMs?: number;

  /** @deprecated Use initialLookbackMs instead */
  initialTimeWindow?: number;
}

export interface UseAssistantActionsResult {
  /** Root-level action nodes */
  roots: ActionNode[];

  /** Whether there's an active (running) root action */
  hasActiveAction: boolean;

  /** Whether the initial load is in progress */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;

  /** Force refresh the action tree. Pass clearTree=true to show a loading state. */
  refresh: (clearTree?: boolean) => Promise<void>;

  /** Load more historical events (for pagination) */
  loadMore: () => Promise<void>;

  /** Whether there are more events to load */
  hasMore: boolean;

  /** Last updated timestamp */
  lastUpdated: Date | null;

  /** Current connection status (streaming via SSE or error) */
  connectionStatus: ActionConnectionStatus;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_EVENT_LIMIT = 100;
const LOAD_MORE_LOOKBACK_MS = ACTION_LOOKBACK_MS;

// SSE error threshold: if N errors in M ms, give up on SSE
const SSE_MAX_ERRORS = 5;
const SSE_ERROR_WINDOW_MS = 60_000;

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAssistantActions(
  assistantId: string,
  actions: AssistantActionActions,
  options: UseAssistantActionsOptions = {}
): UseAssistantActionsResult {
  const { enabled = false, initialLookbackMs, initialTimeWindow } = options;

  const lookbackMs = initialLookbackMs ?? initialTimeWindow ?? ACTION_LOOKBACK_MS;

  // State
  const [roots, setRoots] = React.useState<ActionNode[]>([]);
  const [nodeMap, setNodeMap] = React.useState<Map<string, ActionNode>>(new Map());
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const [connectionStatus, setConnectionStatus] = React.useState<ActionConnectionStatus>('idle');
  const [isInitialLoadDone, setIsInitialLoadDone] = React.useState(false);

  // Refs
  const nodeMapRef = React.useRef<Map<string, ActionNode>>(new Map());
  const lastSeenTimestampRef = React.useRef<string | null>(null);
  const oldestTimestampRef = React.useRef<string | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const isMountedRef = React.useRef(true);
  const isInitialLoadDoneRef = React.useRef(false);
  const isLoadingMoreRef = React.useRef(false);
  const orphanOutgoingRef = React.useRef<Map<string, ManagerMethodLog>>(new Map());
  const seenEventIdsRef = React.useRef<Set<string>>(new Set());
  const prevAssistantIdRef = React.useRef(assistantId);
  const sseErrorTimestampsRef = React.useRef<number[]>([]);

  // Keep nodeMapRef in sync with state
  React.useEffect(() => {
    nodeMapRef.current = nodeMap;
  }, [nodeMap]);

  const hasActiveAction = React.useMemo(() => hasActiveRootAction(roots), [roots]);

  // ===========================================================================
  // Core: Merge logs into tree
  // ===========================================================================

  const mergeLogsIntoTree = React.useCallback((logs: ManagerMethodLog[]) => {
    if (logs.length === 0) return;

    // TODO: Remove debug logging
    console.log(
      `[DEBUG][useAssistantActions] Merging ${logs.length} log(s) into tree. First: callingId=${logs[0]?.entries?.callingId}, phase=${logs[0]?.entries?.phase}`
    );

    setRoots((prevRoots) => {
      const currentNodeMap = new Map(nodeMapRef.current);

      // TODO: Remove debug logging
      console.log(
        `[DEBUG][useAssistantActions] Tree state before merge: ${prevRoots.length} root(s), ${currentNodeMap.size} node(s) in map`
      );
      for (const log of logs) {
        const e = log.entries as ManagerMethodLog['entries'];
        const existing = currentNodeMap.get(e?.callingId);
        console.log(
          `[DEBUG][useAssistantActions]   Event: callingId=${e?.callingId}, phase=${e?.phase}, existingNode=${existing ? `status=${existing.status}` : 'NOT FOUND'}`
        );
      }

      // Replay orphan outgoing events that arrived before their incoming
      const logsWithOrphans = [...logs];
      for (const log of logs) {
        const callingId = (log.entries as ManagerMethodLog['entries'])?.callingId;
        const phase = (log.entries as ManagerMethodLog['entries'])?.phase;
        if (phase === 'incoming' && callingId && orphanOutgoingRef.current.has(callingId)) {
          const orphan = orphanOutgoingRef.current.get(callingId)!;
          logsWithOrphans.push(orphan);
          orphanOutgoingRef.current.delete(callingId);
          // TODO: Remove debug logging
          console.log(
            `[DEBUG][useAssistantActions] Replayed stored orphan outgoing for callingId=${callingId}`
          );
        }
      }

      const result = mergeNewEvents(prevRoots, currentNodeMap, logsWithOrphans);
      // TODO: Remove debug logging
      console.log(
        `[DEBUG][useAssistantActions] After merge: ${result.roots.length} root(s), ${result.nodeMap.size} node(s), ${result.orphanOutgoing.length} orphan(s)`
      );

      for (const orphan of result.orphanOutgoing) {
        orphanOutgoingRef.current.set(orphan.callingId, {
          id: orphan.id,
          ts: orphan.timestamp,
          entries: {
            callingId: orphan.callingId,
            eventId: orphan.eventId,
            manager: orphan.manager,
            method: orphan.method,
            phase: orphan.phase as 'incoming' | 'outgoing' | null,
            hierarchy: orphan.hierarchy,
            hierarchyLabel: orphan.hierarchyLabel,
            displayLabel: orphan.displayLabel,
            status: orphan.status,
            answer: orphan.content,
            error: orphan.error,
            errorType: orphan.errorType,
            traceback: orphan.traceback,
          },
        });
        // TODO: Remove debug logging
        console.log(
          `[DEBUG][useAssistantActions] Stored orphan outgoing for callingId=${orphan.callingId}`
        );
      }

      nodeMapRef.current = result.nodeMap;
      setNodeMap(result.nodeMap);
      return result.roots;
    });

    setLastUpdated(new Date());
  }, []);

  // ===========================================================================
  // Initial load from Orchestra
  // ===========================================================================

  const initialLoad = React.useCallback(async () => {
    if (!isMountedRef.current) return;

    // TODO: Remove debug logging
    console.log(`[DEBUG][useAssistantActions] Initial load starting for assistant=${assistantId}`);

    setIsLoading(true);
    setError(null);

    try {
      const startTime = new Date(Date.now() - lookbackMs).toISOString();
      const response = await actions.getManagerMethodEvents(assistantId, startTime, null);

      if (!isMountedRef.current) return;

      if ('detail' in response) {
        throw new Error(response.detail);
      }

      const logs = (response.logs || []) as ManagerMethodLog[];
      // TODO: Remove debug logging
      console.log(
        `[DEBUG][useAssistantActions] Initial load got ${logs.length} event(s) from Orchestra`
      );

      let result = buildActionTree(logs);

      // TODO: Remove debug logging
      console.log(
        `[DEBUG][useAssistantActions] Built tree: ${result.roots.length} root(s), ${result.nodeMap.size} total node(s), ${result.promotedCallingIds.length} promoted`
      );

      // Targeted backfill for promoted boundaries (headless trees)
      if (result.promotedCallingIds.length > 0 && actions.backfillByCallingIds) {
        // TODO: Remove debug logging
        console.log(
          `[DEBUG][useAssistantActions] Backfilling ${result.promotedCallingIds.length} promoted node(s)`
        );

        const backfillResponse = await actions.backfillByCallingIds(
          assistantId,
          result.promotedCallingIds
        );

        if (!isMountedRef.current) return;

        if (!('detail' in backfillResponse)) {
          const backfillLogs = (backfillResponse.logs || []) as ManagerMethodLog[];
          if (backfillLogs.length > 0) {
            result = mergeNewEvents(result.roots, result.nodeMap, backfillLogs);
          }
        }
      }

      setRoots(result.roots);
      setNodeMap(result.nodeMap);

      if (logs.length > 0) {
        const latestLog = logs[logs.length - 1];
        const oldestLog = logs[0];
        lastSeenTimestampRef.current = latestLog.ts;
        oldestTimestampRef.current = oldestLog.ts;
        setHasMore(true);
      } else {
        lastSeenTimestampRef.current = startTime;
        oldestTimestampRef.current = startTime;
        setHasMore(false);
      }

      setLastUpdated(new Date());
      isInitialLoadDoneRef.current = true;
      setIsInitialLoadDone(true);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error(`[useAssistantActions] Initial load FAILED:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load actions');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [actions, assistantId, lookbackMs]);

  // ===========================================================================
  // One-shot catch-up poll (used on SSE reconnect & tab visibility)
  // ===========================================================================

  const catchUpPoll = React.useCallback(async () => {
    if (!isMountedRef.current || !isInitialLoadDoneRef.current) return;
    if (!lastSeenTimestampRef.current) return;

    try {
      const response = await actions.getManagerMethodEvents(
        assistantId,
        lastSeenTimestampRef.current,
        DEFAULT_EVENT_LIMIT
      );

      if (!isMountedRef.current) return;

      if ('detail' in response) {
        console.warn('[useAssistantActions] Catch-up poll error:', response.detail);
        return;
      }

      const logs = (response.logs || []) as ManagerMethodLog[];
      if (logs.length === 0) return;

      const latestLog = logs[logs.length - 1];
      lastSeenTimestampRef.current = latestLog.ts;

      mergeLogsIntoTree(logs);
      // TODO: Remove debug logging
      console.log(`[DEBUG][useAssistantActions] Catch-up poll merged ${logs.length} event(s)`);
    } catch (err) {
      console.warn('[useAssistantActions] Catch-up poll error:', err);
    }
  }, [actions, assistantId, mergeLogsIntoTree]);

  // ===========================================================================
  // SSE Connection
  // ===========================================================================

  const connectSSE = React.useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    sseErrorTimestampsRef.current = [];

    const sseUrl = `/api/assistant/${assistantId}/actions/stream`;
    // TODO: Remove debug logging
    console.log(`[DEBUG][useAssistantActions] Opening SSE connection to ${sseUrl}`);

    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!isMountedRef.current) return;
      // TODO: Remove debug logging
      console.log(
        `[DEBUG][useAssistantActions] SSE CONNECTED (readyState=${eventSource.readyState})`
      );
      setConnectionStatus('streaming');

      // Catch up on any events missed while disconnected
      catchUpPoll();
    };

    eventSource.onmessage = (event) => {
      if (!isMountedRef.current) return;

      try {
        const parsed = JSON.parse(event.data);
        const entries = parsed?.data?.entries;

        // TODO: Remove debug logging
        console.log(
          `[DEBUG][useAssistantActions] SSE message: type=${parsed?.type}, callingId=${entries?.callingId}, phase=${entries?.phase}, label=${entries?.displayLabel || entries?.manager}`
        );

        if (!parsed?.data) return;

        if (parsed.type === 'ManagerMethod') {
          const isLifecycleEvent = entries?.phase === 'incoming' || entries?.phase === 'outgoing';
          const isActionEvent = isUserFacingAction(entries?.action);

          if (!isLifecycleEvent && !isActionEvent) {
            return;
          }

          // Deduplicate by eventId (Pub/Sub may redeliver)
          const eventId = entries?.eventId;
          if (eventId && seenEventIdsRef.current.has(eventId)) {
            return;
          }
          if (eventId) {
            seenEventIdsRef.current.add(eventId);
            if (seenEventIdsRef.current.size > 5000) {
              const allIds = Array.from(seenEventIdsRef.current);
              seenEventIdsRef.current = new Set(allIds.slice(allIds.length - 4000));
            }
          }

          const log = parsed.data as ManagerMethodLog;
          mergeLogsIntoTree([log]);
        }
      } catch (err) {
        console.warn('[useAssistantActions] SSE message parse error:', err);
      }
    };

    eventSource.onerror = () => {
      if (!isMountedRef.current) return;

      const now = Date.now();
      sseErrorTimestampsRef.current.push(now);
      sseErrorTimestampsRef.current = sseErrorTimestampsRef.current.filter(
        (t) => now - t < SSE_ERROR_WINDOW_MS
      );

      const recentErrors = sseErrorTimestampsRef.current.length;
      // TODO: Remove debug logging
      console.warn(
        `[DEBUG][useAssistantActions] SSE ERROR (readyState=${eventSource.readyState}, ${recentErrors} errors in last ${SSE_ERROR_WINDOW_MS / 1000}s)`
      );

      if (recentErrors >= SSE_MAX_ERRORS) {
        console.warn(
          `[useAssistantActions] SSE failed ${SSE_MAX_ERRORS} times in ${SSE_ERROR_WINDOW_MS / 1000}s — giving up`
        );
        eventSource.close();
        eventSourceRef.current = null;
        setConnectionStatus('error');
        return;
      }

      // Transient error — EventSource auto-reconnects.
      // onopen will fire a catch-up poll when it reconnects.
    };
  }, [assistantId, mergeLogsIntoTree, catchUpPoll]);

  // ===========================================================================
  // Load more (pagination)
  // ===========================================================================

  const loadMore = React.useCallback(async () => {
    if (!isMountedRef.current || !isInitialLoadDoneRef.current) return;
    if (isLoadingMoreRef.current || !hasMore) return;
    if (!oldestTimestampRef.current) return;

    isLoadingMoreRef.current = true;
    setIsLoading(true);

    try {
      const oldestTime = new Date(oldestTimestampRef.current).getTime();
      const startTime = new Date(oldestTime - LOAD_MORE_LOOKBACK_MS).toISOString();
      const endTime = oldestTimestampRef.current;

      const response = await actions.getManagerMethodEvents(
        assistantId,
        startTime,
        DEFAULT_EVENT_LIMIT
      );

      if (!isMountedRef.current) return;

      if ('detail' in response) {
        console.warn('[useAssistantActions] Load more error:', response.detail);
        return;
      }

      const logs = (response.logs || []) as ManagerMethodLog[];
      const olderLogs = logs.filter((log) => log.ts < endTime);

      if (olderLogs.length === 0) {
        setHasMore(false);
        return;
      }

      const oldestLog = olderLogs[0];
      oldestTimestampRef.current = oldestLog.ts;

      setRoots((prevRoots) => {
        const result = mergeNewEvents(prevRoots, nodeMapRef.current, olderLogs);
        setNodeMap(result.nodeMap);
        return result.roots;
      });

      setHasMore(olderLogs.length >= DEFAULT_EVENT_LIMIT);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('[useAssistantActions] Load more error:', err);
    } finally {
      isLoadingMoreRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [actions, assistantId, hasMore]);

  // ===========================================================================
  // Public refresh
  // ===========================================================================

  const refresh = React.useCallback(
    async (clearTree = false) => {
      isInitialLoadDoneRef.current = false;
      lastSeenTimestampRef.current = null;
      oldestTimestampRef.current = null;
      setHasMore(true);
      if (clearTree) {
        setRoots([]);
        setNodeMap(new Map());
        nodeMapRef.current = new Map();
        orphanOutgoingRef.current = new Map();
        seenEventIdsRef.current = new Set();
      }
      await initialLoad();
    },
    [initialLoad]
  );

  // ===========================================================================
  // Effects
  // ===========================================================================

  // Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Initial load + assistantId changes
  React.useEffect(() => {
    if (prevAssistantIdRef.current !== assistantId) {
      prevAssistantIdRef.current = assistantId;
      setRoots([]);
      setNodeMap(new Map());
      nodeMapRef.current = new Map();
      orphanOutgoingRef.current = new Map();
      seenEventIdsRef.current = new Set();
      setError(null);
      setLastUpdated(null);
      setConnectionStatus('idle');
      isInitialLoadDoneRef.current = false;
      setIsInitialLoadDone(false);
      lastSeenTimestampRef.current = null;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }

    if (enabled) {
      if (!isInitialLoadDoneRef.current) {
        initialLoad();
      }
    } else {
      isInitialLoadDoneRef.current = false;
      lastSeenTimestampRef.current = null;
      setConnectionStatus('idle');

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [enabled, assistantId, initialLoad]);

  // Start SSE after initial load completes
  const connectSSERef = React.useRef(connectSSE);
  React.useEffect(() => {
    connectSSERef.current = connectSSE;
  }, [connectSSE]);

  React.useEffect(() => {
    if (!enabled || !isInitialLoadDone) return;

    // TODO: Remove debug logging
    console.log(`[DEBUG][useAssistantActions] Starting SSE for assistant=${assistantId}`);

    connectSSERef.current();

    // Health-check: detect dead connections (e.g., after HMR) and reconnect
    const healthCheckInterval = setInterval(() => {
      if (!isMountedRef.current) return;

      const es = eventSourceRef.current;
      if (!es || es.readyState === EventSource.CLOSED) {
        // TODO: Remove debug logging
        console.log(`[DEBUG][useAssistantActions] Health check: SSE dead, reconnecting...`);
        connectSSERef.current();
      }
    }, 15000);

    return () => {
      clearInterval(healthCheckInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setConnectionStatus('idle');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, assistantId, isInitialLoadDone]);

  // Visibility-based catch-up: when the tab regains focus, do a one-shot
  // poll from Orchestra to fill any SSE messages missed while hidden
  // (handles multi-tab message splitting and background tab gaps).
  const catchUpPollRef = React.useRef(catchUpPoll);
  React.useEffect(() => {
    catchUpPollRef.current = catchUpPoll;
  }, [catchUpPoll]);

  React.useEffect(() => {
    if (!enabled || !isInitialLoadDone) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isInitialLoadDoneRef.current) {
        // TODO: Remove debug logging
        console.log(`[DEBUG][useAssistantActions] Tab became visible — running catch-up poll`);
        catchUpPollRef.current();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, isInitialLoadDone]);

  return {
    roots,
    hasActiveAction,
    isLoading,
    error,
    refresh,
    loadMore,
    hasMore,
    lastUpdated,
    connectionStatus,
  };
}
