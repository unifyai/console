/**
 * Hook for fetching and managing assistant action events.
 *
 * This hook handles:
 * - Initial loading of ManagerMethod events from the last hour
 * - Incremental polling for new events
 * - Building and maintaining the action tree structure
 * - Detecting active actions
 */

import * as React from 'react';
import {
  buildActionTree,
  mergeNewEvents,
  hasActiveRootAction,
} from '@/utils/assistants/assistant-actions';
import type {
  ActionNode,
  ManagerMethodLog,
  AssistantActionActions,
} from '@/types/assistants/action';

// =============================================================================
// Types
// =============================================================================

export interface UseAssistantActionsOptions {
  /** Whether to enable fetching and polling. Default: false */
  enabled?: boolean;

  /** Polling interval in milliseconds. Default: 2000 */
  pollingInterval?: number;

  /** Time window for initial load in milliseconds. Default: 1 hour */
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
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_POLLING_INTERVAL = 2000;
const DEFAULT_INITIAL_LOOKBACK_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_EVENT_LIMIT = 100;
const LOAD_MORE_LOOKBACK_MS = 60 * 60 * 1000; // Load 1 hour more each time

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
  const lookbackMs = initialLookbackMs ?? initialTimeWindow ?? DEFAULT_INITIAL_LOOKBACK_MS;

  // State
  const [roots, setRoots] = React.useState<ActionNode[]>([]);
  const [nodeMap, setNodeMap] = React.useState<Map<string, ActionNode>>(new Map());
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [hasMore, setHasMore] = React.useState(true);

  // Refs for tracking state across renders
  const lastSeenTimestampRef = React.useRef<string | null>(null);
  const oldestTimestampRef = React.useRef<string | null>(null);
  const pollingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = React.useRef(true);
  const isInitialLoadDoneRef = React.useRef(false);
  const isLoadingMoreRef = React.useRef(false);

  // Track assistantId to detect changes
  const prevAssistantIdRef = React.useRef(assistantId);

  // Derived state
  const hasActiveAction = React.useMemo(() => hasActiveRootAction(roots), [roots]);

  /**
   * Performs the initial load of events.
   */
  const initialLoad = React.useCallback(async () => {
    if (!isMountedRef.current) return;

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

      // Check for error response
      if ('detail' in response) {
        throw new Error(response.detail);
      }

      const logs = (response.logs || []) as ManagerMethodLog[];
      const result = buildActionTree(logs);
      setRoots(result.roots);
      setNodeMap(result.nodeMap);

      // Track timestamps for pagination
      if (logs.length > 0) {
        const latestLog = logs[logs.length - 1];
        const oldestLog = logs[0];
        lastSeenTimestampRef.current = latestLog.ts;
        oldestTimestampRef.current = oldestLog.ts;
        // If we got fewer logs than limit, there might not be more
        setHasMore(logs.length >= DEFAULT_EVENT_LIMIT);
      } else {
        lastSeenTimestampRef.current = startTime;
        oldestTimestampRef.current = startTime;
        setHasMore(false);
      }

      setLastUpdated(new Date());
      isInitialLoadDoneRef.current = true;
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load actions');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [actions, assistantId, lookbackMs]);

  /**
   * Checks if new logs contain a new root-level incoming event.
   * This indicates a new action tree is starting.
   */
  const hasNewRootIncoming = React.useCallback(
    (logs: ManagerMethodLog[], existingNodeMap: Map<string, ActionNode>): boolean => {
      for (const log of logs) {
        const entries = log.entries as ManagerMethodLog['entries'];
        if (
          entries?.phase === 'incoming' &&
          entries?.hierarchy?.length === 1 &&
          !existingNodeMap.has(entries.callingId)
        ) {
          return true;
        }
      }
      return false;
    },
    []
  );

  /**
   * Performs an incremental poll for new events.
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

      // Check for error response
      if ('detail' in response) {
        console.warn('[useAssistantActions] Polling error:', response.detail);
        return;
      }

      const logs = (response.logs || []) as ManagerMethodLog[];
      if (logs.length === 0) return;

      // Update last seen timestamp
      const latestLog = logs[logs.length - 1];
      lastSeenTimestampRef.current = latestLog.ts;

      // Check if there's a new root-level action starting
      setRoots((prevRoots) => {
        // Use a snapshot of nodeMap for checking
        const currentNodeMap = new Map(nodeMap);
        const isNewRootAction = hasNewRootIncoming(logs, currentNodeMap);

        if (isNewRootAction) {
          // Auto-clear: Start fresh with just the new events
          const result = buildActionTree(logs);
          setNodeMap(result.nodeMap);
          oldestTimestampRef.current = logs[0].ts;
          return result.roots;
        } else {
          // Merge new events into existing tree
          const result = mergeNewEvents(prevRoots, currentNodeMap, logs);
          setNodeMap(result.nodeMap);
          return result.roots;
        }
      });

      setLastUpdated(new Date());
    } catch (err) {
      // Silently ignore polling errors to avoid spam
      console.warn('[useAssistantActions] Polling error:', err);
    }
  }, [actions, assistantId, nodeMap, hasNewRootIncoming]);

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
      // Calculate the time range for older events
      const oldestTime = new Date(oldestTimestampRef.current).getTime();
      const startTime = new Date(oldestTime - LOAD_MORE_LOOKBACK_MS).toISOString();
      const endTime = oldestTimestampRef.current;

      const response = await actions.getManagerMethodEvents(
        assistantId,
        startTime,
        DEFAULT_EVENT_LIMIT
      );

      if (!isMountedRef.current) return;

      // Check for error response
      if ('detail' in response) {
        console.warn('[useAssistantActions] Load more error:', response.detail);
        return;
      }

      const logs = (response.logs || []) as ManagerMethodLog[];

      // Filter to only logs older than our current oldest
      const olderLogs = logs.filter((log) => log.ts < endTime);

      if (olderLogs.length === 0) {
        setHasMore(false);
        return;
      }

      // Update oldest timestamp
      const oldestLog = olderLogs[0];
      oldestTimestampRef.current = oldestLog.ts;

      // Merge older events into existing tree
      setRoots((prevRoots) => {
        const result = mergeNewEvents(prevRoots, nodeMap, olderLogs);
        setNodeMap(result.nodeMap);
        return result.roots;
      });

      // Check if there might be more
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
  }, [actions, assistantId, hasMore, nodeMap]);

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
      setError(null);
      setLastUpdated(null);
      isInitialLoadDoneRef.current = false;
      lastSeenTimestampRef.current = null;
    }

    if (enabled) {
      if (!isInitialLoadDoneRef.current) {
        initialLoad();
      }
    } else {
      // Clear tracking state when disabled
      isInitialLoadDoneRef.current = false;
      lastSeenTimestampRef.current = null;
    }
  }, [enabled, assistantId, initialLoad]);

  // Effect: Polling - start after initial load completes
  React.useEffect(() => {
    // Only start polling if enabled AND initial load is done
    if (!enabled || !isInitialLoadDoneRef.current) {
      return;
    }

    pollingIntervalRef.current = setInterval(poll, pollingInterval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [enabled, poll, pollingInterval, lastUpdated]); // lastUpdated triggers re-evaluation after initial load

  return {
    roots,
    hasActiveAction,
    isLoading,
    error,
    refresh,
    loadMore,
    hasMore,
    lastUpdated,
  };
}
