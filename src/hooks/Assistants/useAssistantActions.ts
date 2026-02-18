/**
 * Hook for fetching and managing assistant action events.
 *
 * This hook handles:
 * - Initial loading of ManagerMethod events from Orchestra (last 3 hours)
 * - Live streaming of new events via SSE from Pub/Sub
 * - Automatic fallback to Orchestra polling when SSE is unavailable
 * - Building and maintaining the action tree structure
 * - Detecting active actions
 */

import * as React from 'react';
import {
  buildActionTree,
  mergeNewEvents,
  hasActiveRootAction,
  ACTION_LOOKBACK_MS,
} from '@/utils/assistants/assistant-actions';
import type {
  ActionNode,
  ManagerMethodLog,
  AssistantActionActions,
} from '@/types/assistants/action';

// =============================================================================
// Types
// =============================================================================

/** Connection strategy for live updates */
export type ActionConnectionStatus = 'idle' | 'streaming' | 'polling' | 'error';

export interface UseAssistantActionsOptions {
  /** Whether to enable fetching and live updates. Default: false */
  enabled?: boolean;

  /** Polling interval in milliseconds (used as fallback). Default: 10000 */
  pollingInterval?: number;

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

  /** Force refresh the action tree */
  refresh: () => Promise<void>;

  /** Load more historical events (for pagination) */
  loadMore: () => Promise<void>;

  /** Whether there are more events to load */
  hasMore: boolean;

  /** Last updated timestamp */
  lastUpdated: Date | null;

  /** Current connection strategy (streaming via SSE or polling fallback) */
  connectionStatus: ActionConnectionStatus;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_POLLING_INTERVAL = 10000;
const DEFAULT_EVENT_LIMIT = 100;
const LOAD_MORE_LOOKBACK_MS = ACTION_LOOKBACK_MS;

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAssistantActions(
  assistantId: string,
  actions: AssistantActionActions,
  options: UseAssistantActionsOptions = {}
): UseAssistantActionsResult {
  const {
    enabled = false,
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    initialLookbackMs,
    initialTimeWindow,
  } = options;

  // Support both option names (initialLookbackMs takes precedence)
  const lookbackMs = initialLookbackMs ?? initialTimeWindow ?? ACTION_LOOKBACK_MS;

  // State
  const [roots, setRoots] = React.useState<ActionNode[]>([]);
  const [nodeMap, setNodeMap] = React.useState<Map<string, ActionNode>>(new Map());
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const [connectionStatus, setConnectionStatus] = React.useState<ActionConnectionStatus>('idle');

  // Refs for tracking state across renders without stale closures
  const nodeMapRef = React.useRef<Map<string, ActionNode>>(new Map());
  const lastSeenTimestampRef = React.useRef<string | null>(null);
  const oldestTimestampRef = React.useRef<string | null>(null);
  const pollingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const isMountedRef = React.useRef(true);
  const isInitialLoadDoneRef = React.useRef(false);
  const isLoadingMoreRef = React.useRef(false);

  // Store orphan outgoing events that arrived before their matching incoming
  // (Pub/Sub does not guarantee ordering)
  const orphanOutgoingRef = React.useRef<Map<string, ManagerMethodLog>>(new Map());

  // Deduplication: track eventIds we've already processed (Pub/Sub may redeliver)
  const seenEventIdsRef = React.useRef<Set<string>>(new Set());

  // Track assistantId to detect changes
  const prevAssistantIdRef = React.useRef(assistantId);

  // Keep nodeMapRef in sync with state to avoid stale closures
  React.useEffect(() => {
    nodeMapRef.current = nodeMap;
  }, [nodeMap]);

  // Derived state
  const hasActiveAction = React.useMemo(() => hasActiveRootAction(roots), [roots]);

  /**
   * Merges a batch of ManagerMethod logs into the tree.
   * Used by both SSE onmessage and polling callbacks.
   */
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

      // Check if any of these events have a matching orphan outgoing stored
      // (i.e., an outgoing that arrived before its incoming)
      const logsWithOrphans = [...logs];
      for (const log of logs) {
        const callingId = (log.entries as ManagerMethodLog['entries'])?.callingId;
        const phase = (log.entries as ManagerMethodLog['entries'])?.phase;
        if (phase === 'incoming' && callingId && orphanOutgoingRef.current.has(callingId)) {
          // Re-inject the stored orphan outgoing so buildActionTree / mergeNewEvents can match it
          const orphan = orphanOutgoingRef.current.get(callingId)!;
          logsWithOrphans.push(orphan);
          orphanOutgoingRef.current.delete(callingId);
          // TODO: Remove debug logging
          console.log(
            `[DEBUG][useAssistantActions] Replayed stored orphan outgoing for callingId=${callingId}`
          );
        }
      }

      // Always merge — never replace the tree. The old `isNewRootAction`
      // path called buildActionTree with only the SSE batch, which wiped the
      // entire existing tree if PubSub re-delivered an old incoming event.
      const result = mergeNewEvents(prevRoots, currentNodeMap, logsWithOrphans);
      // TODO: Remove debug logging
      console.log(
        `[DEBUG][useAssistantActions] After merge: ${result.roots.length} root(s), ${result.nodeMap.size} node(s), ${result.orphanOutgoing.length} orphan(s)`
      );

      // Store any new orphan outgoing events for later matching
      for (const orphan of result.orphanOutgoing) {
        orphanOutgoingRef.current.set(orphan.callingId, {
          id: orphan.id,
          ts: orphan.timestamp,
          entries: {
            callingId: orphan.callingId,
            eventId: orphan.eventId,
            manager: orphan.manager,
            method: orphan.method,
            phase: orphan.phase,
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

      // Sync update ref so subsequent events in the same batch see fresh state
      nodeMapRef.current = result.nodeMap;
      setNodeMap(result.nodeMap);
      return result.roots;
    });

    setLastUpdated(new Date());
  }, []);

  /**
   * Performs the initial load of events from Orchestra.
   */
  const initialLoad = React.useCallback(async () => {
    if (!isMountedRef.current) return;

    // TODO: Remove debug logging
    console.log(`[DEBUG][useAssistantActions] Initial load starting for assistant=${assistantId}`);

    setIsLoading(true);
    setError(null);

    try {
      const startTime = new Date(Date.now() - lookbackMs).toISOString();
      const response = await actions.getManagerMethodEvents(
        assistantId,
        startTime,
        DEFAULT_EVENT_LIMIT
      );

      if (!isMountedRef.current) return;

      if ('detail' in response) {
        throw new Error(response.detail);
      }

      const logs = (response.logs || []) as ManagerMethodLog[];
      // TODO: Remove debug logging
      console.log(
        `[DEBUG][useAssistantActions] Initial load got ${logs.length} event(s) from Orchestra`
      );

      const result = buildActionTree(logs);
      setRoots(result.roots);
      setNodeMap(result.nodeMap);

      // TODO: Remove debug logging
      console.log(
        `[DEBUG][useAssistantActions] Built tree: ${result.roots.length} root(s), ${result.nodeMap.size} total node(s)`
      );

      if (logs.length > 0) {
        const latestLog = logs[logs.length - 1];
        const oldestLog = logs[0];
        lastSeenTimestampRef.current = latestLog.ts;
        oldestTimestampRef.current = oldestLog.ts;
        setHasMore(logs.length >= DEFAULT_EVENT_LIMIT);
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
      // TODO: Remove debug logging
      console.error(`[DEBUG][useAssistantActions] Initial load FAILED:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load actions');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [actions, assistantId, lookbackMs]);

  /**
   * Performs an incremental poll for new events (fallback path).
   */
  const poll = React.useCallback(async () => {
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
        console.warn('[useAssistantActions] Polling error:', response.detail);
        return;
      }

      const logs = (response.logs || []) as ManagerMethodLog[];
      if (logs.length === 0) return;

      // Update last seen timestamp
      const latestLog = logs[logs.length - 1];
      lastSeenTimestampRef.current = latestLog.ts;

      mergeLogsIntoTree(logs);
    } catch (err) {
      console.warn('[useAssistantActions] Polling error:', err);
    }
  }, [actions, assistantId, mergeLogsIntoTree]);

  /**
   * Starts polling as fallback when SSE is unavailable.
   */
  const startPolling = React.useCallback(() => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    // TODO: Remove debug logging
    console.log(
      `[DEBUG][useAssistantActions] Starting POLLING fallback (interval=${pollingInterval}ms)`
    );
    pollingIntervalRef.current = setInterval(poll, pollingInterval);
    setConnectionStatus('polling');
  }, [poll, pollingInterval]);

  /**
   * Stops polling.
   */
  const stopPolling = React.useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  /**
   * Opens an SSE connection to the actions stream endpoint.
   * Falls back to polling on error.
   */
  const connectSSE = React.useCallback(() => {
    // Close any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

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
      // SSE is active — stop polling if it was running as fallback
      stopPolling();
    };

    eventSource.onmessage = (event) => {
      if (!isMountedRef.current) return;

      try {
        const parsed = JSON.parse(event.data);
        const entries = parsed?.data?.entries;

        // TODO: Remove debug logging
        console.log(
          `[DEBUG][useAssistantActions] SSE message received: type=${parsed?.type}, callingId=${entries?.callingId}, phase=${entries?.phase}, label=${entries?.displayLabel || entries?.manager}`
        );

        // parsed is { type: 'ManagerMethod' | 'ToolLoop', data: { id, ts, entries } }
        if (!parsed?.data) return;

        if (parsed.type === 'ManagerMethod') {
          // Skip phase=null (progress) events — they are not used for tree building
          if (entries?.phase !== 'incoming' && entries?.phase !== 'outgoing') {
            // TODO: Remove debug logging
            console.log(
              `[DEBUG][useAssistantActions] Skipping phase=${entries?.phase} event (progress event)`
            );
            return;
          }

          // Deduplicate by eventId (Pub/Sub may redeliver the same message)
          const eventId = entries?.eventId;
          if (eventId && seenEventIdsRef.current.has(eventId)) {
            // TODO: Remove debug logging
            console.log(`[DEBUG][useAssistantActions] Duplicate eventId=${eventId}, skipping`);
            return;
          }
          if (eventId) {
            seenEventIdsRef.current.add(eventId);
            // Cap the set to prevent unbounded memory growth
            if (seenEventIdsRef.current.size > 5000) {
              const allIds = Array.from(seenEventIdsRef.current);
              seenEventIdsRef.current = new Set(allIds.slice(allIds.length - 4000));
            }
          }

          const log = parsed.data as ManagerMethodLog;
          mergeLogsIntoTree([log]);
        }
        // ToolLoop events can be handled here in the future
      } catch (err) {
        // TODO: Remove debug logging
        console.warn(`[DEBUG][useAssistantActions] SSE message parse error:`, err);
      }
    };

    eventSource.onerror = (err) => {
      if (!isMountedRef.current) return;

      // TODO: Remove debug logging
      console.warn(
        `[DEBUG][useAssistantActions] SSE ERROR (readyState=${eventSource.readyState}). Falling back to polling.`,
        err
      );

      // Close the failed SSE connection
      eventSource.close();
      eventSourceRef.current = null;

      // Fall back to polling
      if (isInitialLoadDoneRef.current) {
        startPolling();
      } else {
        setConnectionStatus('error');
      }
    };
  }, [assistantId, mergeLogsIntoTree, startPolling, stopPolling]);

  /**
   * Loads more historical events (older than currently loaded).
   */
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

  /**
   * Public refresh function.
   */
  const refresh = React.useCallback(async () => {
    isInitialLoadDoneRef.current = false;
    lastSeenTimestampRef.current = null;
    oldestTimestampRef.current = null;
    setHasMore(true);
    await initialLoad();
  }, [initialLoad]);

  // Effect: Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Effect: Initial load, enable/disable, and assistantId changes
  React.useEffect(() => {
    // Check if assistantId changed
    if (prevAssistantIdRef.current !== assistantId) {
      prevAssistantIdRef.current = assistantId;
      // Reset state
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

      // Close existing connections
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    if (enabled) {
      if (!isInitialLoadDoneRef.current) {
        initialLoad();
      }
    } else {
      // Clear tracking state when disabled
      isInitialLoadDoneRef.current = false;
      lastSeenTimestampRef.current = null;
      setConnectionStatus('idle');

      // Close connections when disabled
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [enabled, assistantId, initialLoad]);

  // Effect: Start SSE after initial load completes (with polling fallback).
  // We use isInitialLoadDone (state) to trigger this effect exactly once after
  // the initial load finishes, without re-triggering on every SSE message.
  const [isInitialLoadDone, setIsInitialLoadDone] = React.useState(false);

  React.useEffect(() => {
    if (!enabled || !isInitialLoadDone) return;

    // TODO: Remove debug logging
    console.log(`[DEBUG][useAssistantActions] Starting SSE (once) for assistant=${assistantId}`);

    // Try SSE first; it falls back to polling on error
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connectSSE is stable; only re-run on enable/assistant change
  }, [enabled, assistantId, isInitialLoadDone]);

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
