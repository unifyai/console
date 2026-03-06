/**
 * Hook for fetching and managing assistant action events.
 *
 * This hook handles:
 * - Initial loading of ManagerMethod events from Orchestra
 * - Live streaming of new events via SSE from Pub/Sub (primary real-time channel)
 * - On-demand refresh via explicit user action (refresh button)
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
  ToolLoopLog,
  AssistantActionActions,
  LoadChildrenFn,
} from '@/types/assistants/action';
import type { ResponseProps } from '@/types/common';

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

  /** Lazy-load child manager events for a specific node on demand */
  loadChildren: LoadChildrenFn;

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

const __DEV__ = process.env.NODE_ENV === 'development';
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
  const oldestTimestampRef = React.useRef<string | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const isMountedRef = React.useRef(true);
  const isInitialLoadDoneRef = React.useRef(false);
  const isLoadingMoreRef = React.useRef(false);
  const orphanOutgoingRef = React.useRef<Map<string, ManagerMethodLog>>(new Map());
  const orphanToolLoopRef = React.useRef<Map<string, ToolLoopLog[]>>(new Map());
  const seenEventIdsRef = React.useRef<Set<string>>(new Set());
  const prevAssistantIdRef = React.useRef(assistantId);
  const sseErrorTimestampsRef = React.useRef<number[]>([]);
  const loadGenerationRef = React.useRef(0);

  // SSE event batching: buffer events and flush on a short debounce
  const BATCH_FLUSH_MS = 100;
  const managerBatchRef = React.useRef<ManagerMethodLog[]>([]);
  const toolLoopBatchRef = React.useRef<ToolLoopLog[]>([]);
  const batchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

    if (__DEV__)
      console.log(
        `[DEBUG][useAssistantActions] Merging ${logs.length} log(s) into tree. First: callingId=${logs[0]?.entries?.callingId}, phase=${logs[0]?.entries?.phase}`
      );

    setRoots((prevRoots) => {
      const currentNodeMap = new Map(nodeMapRef.current);

      if (__DEV__) {
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
      }

      // Replay orphan outgoing events that arrived before their incoming.
      // Collect matches first, then delete — avoids mutating the map mid-iteration.
      const logsWithOrphans = [...logs];
      const replayedCallingIds: string[] = [];
      for (const log of logs) {
        const callingId = (log.entries as ManagerMethodLog['entries'])?.callingId;
        const phase = (log.entries as ManagerMethodLog['entries'])?.phase;
        if (phase === 'incoming' && callingId && orphanOutgoingRef.current.has(callingId)) {
          logsWithOrphans.push(orphanOutgoingRef.current.get(callingId)!);
          replayedCallingIds.push(callingId);
          if (__DEV__)
            console.log(
              `[DEBUG][useAssistantActions] Replayed stored orphan outgoing for callingId=${callingId}`
            );
        }
      }
      for (const id of replayedCallingIds) {
        orphanOutgoingRef.current.delete(id);
      }

      const result = mergeNewEvents(prevRoots, currentNodeMap, logsWithOrphans);
      if (__DEV__)
        console.log(
          `[DEBUG][useAssistantActions] After merge: ${result.roots.length} root(s), ${result.nodeMap.size} node(s), ${result.orphanOutgoing.length} orphan(s)`
        );

      // Replay any orphan ToolLoop events whose target node now exists
      if (orphanToolLoopRef.current.size > 0) {
        const replayedKeys: string[] = [];
        const orphanEntries = Array.from(orphanToolLoopRef.current.entries());
        for (let oe = 0; oe < orphanEntries.length; oe++) {
          const [key, pendingLogs] = orphanEntries[oe];
          const hierarchy = key.split('->');
          let targetNode: ActionNode | undefined;
          const mapNodes = Array.from(result.nodeMap.values());
          for (let mn = 0; mn < mapNodes.length; mn++) {
            const n = mapNodes[mn];
            if (
              n.hierarchy.length === hierarchy.length &&
              n.hierarchy.every((seg: string, i: number) => seg === hierarchy[i])
            ) {
              targetNode = n;
              break;
            }
          }
          if (targetNode) {
            const existing = targetNode.liveToolLoopLogs ?? [];
            const deduped = pendingLogs.filter(
              (pl: ToolLoopLog) => !existing.some((e) => e.id === pl.id)
            );
            if (deduped.length > 0) {
              targetNode.liveToolLoopLogs = [...existing, ...deduped].sort((a, b) => a.id - b.id);
            }
            replayedKeys.push(key);
            if (__DEV__)
              console.log(
                `[DEBUG][useAssistantActions] Replayed ${deduped.length} orphan ToolLoop log(s) for hierarchy=${key}`
              );
          }
        }
        for (let rk = 0; rk < replayedKeys.length; rk++) {
          orphanToolLoopRef.current.delete(replayedKeys[rk]);
        }
      }

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
        if (__DEV__)
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
  // Core: Merge ToolLoop events into matching nodes (batch-aware)
  // ===========================================================================

  const mergeToolLoopEvents = React.useCallback((logs: ToolLoopLog[]) => {
    if (logs.length === 0) return;

    setRoots((prevRoots) => {
      const currentNodeMap = nodeMapRef.current;
      let changed = false;

      for (const log of logs) {
        const hierarchy = log.entries.hierarchy;
        if (!hierarchy || hierarchy.length === 0) continue;

        let targetNode: ActionNode | undefined;
        const nodes = Array.from(currentNodeMap.values());
        for (let idx = 0; idx < nodes.length; idx++) {
          const n = nodes[idx];
          if (
            n.hierarchy.length === hierarchy.length &&
            n.hierarchy.every((seg: string, i: number) => seg === hierarchy[i])
          ) {
            targetNode = n;
            break;
          }
        }

        if (!targetNode) {
          // Store as orphan for replay when the node is created
          const key = hierarchy.join('->');
          const pending = orphanToolLoopRef.current.get(key) ?? [];
          if (!pending.some((l) => l.id === log.id)) {
            pending.push(log);
            orphanToolLoopRef.current.set(key, pending);
          }
          continue;
        }

        const existing = targetNode.liveToolLoopLogs ?? [];
        if (existing.some((l) => l.id === log.id)) continue;

        targetNode.liveToolLoopLogs = [...existing, log].sort((a, b) => a.id - b.id);
        changed = true;
      }

      return changed ? [...prevRoots] : prevRoots;
    });
  }, []);

  // ===========================================================================
  // Core: Flush batched SSE events
  // ===========================================================================

  const flushEventBatch = React.useCallback(() => {
    batchTimerRef.current = null;

    const managerLogs = managerBatchRef.current;
    const toolLogs = toolLoopBatchRef.current;
    managerBatchRef.current = [];
    toolLoopBatchRef.current = [];

    if (managerLogs.length > 0) {
      mergeLogsIntoTree(managerLogs);
    }
    if (toolLogs.length > 0) {
      mergeToolLoopEvents(toolLogs);
    }
  }, [mergeLogsIntoTree, mergeToolLoopEvents]);

  const scheduleFlush = React.useCallback(() => {
    if (batchTimerRef.current === null) {
      batchTimerRef.current = setTimeout(flushEventBatch, BATCH_FLUSH_MS);
    }
  }, [flushEventBatch]);

  // ===========================================================================
  // Initial load from Orchestra
  // ===========================================================================

  const initialLoad = React.useCallback(async () => {
    if (!isMountedRef.current) return;

    const myGeneration = ++loadGenerationRef.current;

    if (__DEV__)
      console.log(
        `[DEBUG][useAssistantActions] Initial load starting for assistant=${assistantId} (gen=${myGeneration})`
      );

    setIsLoading(true);
    setError(null);

    try {
      const startTime = new Date(Date.now() - lookbackMs).toISOString();

      // Single targeted API call for all root-level events (incoming + outgoing
      // + action). Includes action events so interactions (interject, stop, ask)
      // are captured for root nodes.
      const rootResponse = await actions.getManagerMethodEvents(
        assistantId,
        startTime,
        null,
        undefined,
        [`len(hierarchy) == 1`]
      );

      if (!isMountedRef.current || loadGenerationRef.current !== myGeneration) return;

      let allRootLogs: ManagerMethodLog[] = [];
      if ('detail' in rootResponse) {
        const detail = (rootResponse as ResponseProps).detail as string;
        const isNotFound = typeof detail === 'string' && detail.toLowerCase().includes('not found');
        if (!isNotFound) throw new Error(detail);
      } else {
        allRootLogs = ('logs' in rootResponse ? rootResponse.logs : []) as ManagerMethodLog[];
      }

      if (__DEV__)
        console.log(
          `[DEBUG][useAssistantActions] Root fetch: ${allRootLogs.length} event(s) (gen=${myGeneration})`
        );

      if (allRootLogs.length > 0) {
        const result = buildActionTree(allRootLogs);
        nodeMapRef.current = result.nodeMap;
        setRoots(result.roots);
        setNodeMap(result.nodeMap);

        const oldestLog = allRootLogs.reduce((oldest, log) => (log.ts < oldest.ts ? log : oldest));
        oldestTimestampRef.current = oldestLog.ts;
        setHasMore(true);

        if (__DEV__)
          console.log(
            `[DEBUG][useAssistantActions] Built tree: ${result.roots.length} root(s), ${result.nodeMap.size} node(s) (gen=${myGeneration})`
          );
      } else {
        oldestTimestampRef.current = startTime;
        setHasMore(false);
      }

      setLastUpdated(new Date());
      isInitialLoadDoneRef.current = true;
      setIsInitialLoadDone(true);
    } catch (err) {
      if (!isMountedRef.current || loadGenerationRef.current !== myGeneration) return;
      console.error(`[useAssistantActions] Initial load FAILED:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load actions');
    } finally {
      if (isMountedRef.current && loadGenerationRef.current === myGeneration) {
        setIsLoading(false);
      }
    }
  }, [actions, assistantId, lookbackMs]);

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
    if (__DEV__) console.log(`[DEBUG][useAssistantActions] Opening SSE connection to ${sseUrl}`);

    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!isMountedRef.current) return;
      if (__DEV__)
        console.log(
          `[DEBUG][useAssistantActions] SSE CONNECTED (readyState=${eventSource.readyState})`
        );
      setConnectionStatus('streaming');
    };

    eventSource.onmessage = (event) => {
      if (!isMountedRef.current) return;

      try {
        const parsed = JSON.parse(event.data);
        const entries = parsed?.data?.entries;

        if (__DEV__)
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
          managerBatchRef.current.push(log);
          scheduleFlush();
        } else if (parsed.type === 'ToolLoop') {
          const toolEntries = parsed.data.entries ?? parsed.data;
          if (!toolEntries?.hierarchy || !toolEntries?.message) return;

          const eventId = toolEntries.eventId;
          if (eventId && seenEventIdsRef.current.has(eventId)) return;
          if (eventId) {
            seenEventIdsRef.current.add(eventId);
            if (seenEventIdsRef.current.size > 5000) {
              const allIds = Array.from(seenEventIdsRef.current);
              seenEventIdsRef.current = new Set(allIds.slice(allIds.length - 4000));
            }
          }

          const eventTs = toolEntries.eventTimestamp ?? parsed.data.ts ?? new Date().toISOString();
          const toolLog: ToolLoopLog = {
            id: toolEntries.rowId ?? parsed.data.id ?? Date.now(),
            ts: eventTs,
            entries: {
              message: toolEntries.message,
              method: toolEntries.method ?? '',
              hierarchy: toolEntries.hierarchy,
              hierarchyLabel: toolEntries.hierarchyLabel ?? '',
              eventTimestamp: eventTs,
              toolAliases: toolEntries.toolAliases ?? null,
            },
          };

          toolLoopBatchRef.current.push(toolLog);
          scheduleFlush();
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
      if (__DEV__)
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
    };
  }, [assistantId, scheduleFlush]);

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

      // Fetch only root-level events for the extended time window.
      // Children are lazy-loaded on expand, same as current roots.
      const response = await actions.getManagerMethodEvents(
        assistantId,
        startTime,
        DEFAULT_EVENT_LIMIT,
        undefined,
        [`len(hierarchy) == 1`]
      );

      if (!isMountedRef.current) return;

      let allLogs: ManagerMethodLog[] = [];
      if (!('detail' in response)) {
        allLogs = ('logs' in response ? response.logs : []) as ManagerMethodLog[];
      }
      const olderLogs = allLogs.filter((log) => log.ts < endTime);

      if (olderLogs.length === 0) {
        setHasMore(false);
        return;
      }

      const oldestLog = olderLogs.reduce((oldest, log) => (log.ts < oldest.ts ? log : oldest));
      oldestTimestampRef.current = oldestLog.ts;

      setRoots((prevRoots) => {
        const result = mergeNewEvents(prevRoots, nodeMapRef.current, olderLogs);
        nodeMapRef.current = result.nodeMap;
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
  // Lazy children loading
  // ===========================================================================

  const loadChildren: LoadChildrenFn = React.useCallback(
    async (nodeId, hierarchy) => {
      if (!isMountedRef.current) return;

      const node = nodeMapRef.current.get(nodeId);
      if (!node || node.childrenLoaded) return;

      const rootSegment = hierarchy[0];
      if (!rootSegment) return;

      if (__DEV__)
        console.log(
          `[DEBUG][useAssistantActions] Loading children for node=${nodeId}, rootSegment=${rootSegment}`
        );

      try {
        const response = await actions.getManagerMethodEvents(assistantId, null, null, undefined, [
          `hierarchy[0] == '${rootSegment}'`,
          `len(hierarchy) > 1`,
        ]);

        if (!isMountedRef.current) return;

        if ('detail' in response) {
          console.warn(
            '[useAssistantActions] Load children error:',
            (response as ResponseProps).detail
          );
          return;
        }

        const logs = (response.logs || []) as ManagerMethodLog[];

        if (__DEV__)
          console.log(
            `[DEBUG][useAssistantActions] Loaded ${logs.length} descendant event(s) for node=${nodeId}`
          );

        if (logs.length > 0) {
          setRoots((prevRoots) => {
            const result = mergeNewEvents(prevRoots, nodeMapRef.current, logs);
            nodeMapRef.current = result.nodeMap;
            setNodeMap(result.nodeMap);

            // Mark the target and all its descendants as children-loaded
            // since the fetch included all hierarchy depths under this root.
            const markLoaded = (n: ActionNode) => {
              n.childrenLoaded = true;
              for (const child of n.children) markLoaded(child);
            };
            const targetNode = result.nodeMap.get(nodeId);
            if (targetNode) markLoaded(targetNode);

            return result.roots;
          });
        } else {
          if (node) node.childrenLoaded = true;
          setRoots((prev) => [...prev]);
        }

        setLastUpdated(new Date());
      } catch (err) {
        console.warn('[useAssistantActions] Load children error:', err);
      }
    },
    [actions, assistantId]
  );

  // ===========================================================================
  // Public refresh
  // ===========================================================================

  const refresh = React.useCallback(
    async (clearTree = false) => {
      isInitialLoadDoneRef.current = false;
      oldestTimestampRef.current = null;
      setHasMore(true);
      if (clearTree) {
        setRoots([]);
        setNodeMap(new Map());
        nodeMapRef.current = new Map();
        orphanOutgoingRef.current = new Map();
        orphanToolLoopRef.current = new Map();
        seenEventIdsRef.current = new Set();
        setIsLoading(true);
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
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
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
      orphanToolLoopRef.current = new Map();
      seenEventIdsRef.current = new Set();
      setError(null);
      setLastUpdated(null);
      setConnectionStatus('idle');
      isInitialLoadDoneRef.current = false;
      setIsInitialLoadDone(false);

      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
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

    if (__DEV__)
      console.log(`[DEBUG][useAssistantActions] Starting SSE for assistant=${assistantId}`);

    connectSSERef.current();

    // Health-check: detect dead connections (e.g., after HMR) and reconnect
    const healthCheckInterval = setInterval(() => {
      if (!isMountedRef.current) return;

      const es = eventSourceRef.current;
      if (!es || es.readyState === EventSource.CLOSED) {
        if (__DEV__)
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

  return {
    roots,
    hasActiveAction,
    isLoading,
    error,
    refresh,
    loadMore,
    loadChildren,
    hasMore,
    lastUpdated,
    connectionStatus,
  };
}
