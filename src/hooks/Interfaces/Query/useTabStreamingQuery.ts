"use client";

import { useQuery, useQueryClient, useQueries, CancelledError, useIsFetching } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { 
  TabData, 
  GranularTabActions, 
  GranularTileActions, 
  FieldsActions, 
  LogsActions,
  ProjectsActions,
  ContextActions
} from "@/types/interfaces/grid";
import { useTabDataOptimistic, CompleteTabData } from './useTabDataOptimistic';
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";
import { selectTabByName } from "@/contexts/selectors/tab";

/**
 * Debug flag for tab prefetching logging
 * Set NEXT_PUBLIC_DEBUG_TAB_PREFETCHING=true to enable detailed prefetching logs
 */
const DEBUG_TAB_PREFETCHING = process.env.NEXT_PUBLIC_DEBUG_TAB_PREFETCHING === 'true';

/**
 * Conditional debug logger for tab prefetching
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_TAB_PREFETCHING) {
    console.log(...args);
  }
};

type StreamingActions = {
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  fieldsActions: FieldsActions;
  logsActions: LogsActions;
  projectsActions: ProjectsActions;
  contextActions: ContextActions;
};

export type TabStreamingState = {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  data: CompleteTabData | null;
  prefetchedTabs: Set<string>;
};

// Max concurrent prefetch tabs - rolling queue
const MAX_CONCURRENT_PREFETCH = 3;

/**
 * Hook for streaming tab data and prefetching non-active tabs
 * Uses the optimistic tab data builder for consistent caching
 */
export function useTabStreamingQuery(
  interfaceId: string,
  activeTabName: string | null,
  projectId: string | null,
  actions: StreamingActions,
  options?: {
    enableNonActivePrefetch?: boolean;
    prefetchMode?: 'light' | 'full';
    deferMs?: number;
    concurrency?: number;
  }
) {
  const queryClient = useQueryClient();
  const storeApi = useStoreApiContext();
  const [prefetchedTabs, setPrefetchedTabs] = useState<Set<string>>(new Set());
  const [currentlyPrefetching, setCurrentlyPrefetching] = useState<Set<string>>(new Set());
  const [failedPrefetchTabs, setFailedPrefetchTabs] = useState<Set<string>>(new Set());
  const [prefetchReady, setPrefetchReady] = useState(false);
  const { buildCompleteTabData } = useTabDataOptimistic();
  const isFetchingAny = useIsFetching();
  const [prefetchConcurrency, setPrefetchConcurrency] = useState(1);
  const lastActivityRef = useRef<number>(Date.now());

  // Network connection detection for adaptive concurrency
  const connection: any = typeof navigator !== 'undefined' ? (navigator as any).connection : null;
  const saveData = connection?.saveData === true;
  const effectiveType = connection?.effectiveType as string | undefined;

  const {
    enableNonActivePrefetch = true,
    prefetchMode = 'light',
    deferMs = 800,
    concurrency = MAX_CONCURRENT_PREFETCH,
  } = options || {};

  // Get all tabs for the interface via API route (cancelable + cacheable)
  const { data: allTabsData = [] } = useQuery<TabData[]>({
    queryKey: ["tabs", interfaceId],
    queryFn: async ({ signal }) => {
      try {
        const res = await fetch(`/api/tab?interface_id=${encodeURIComponent(interfaceId)}&checkpoint=false`, {
          method: "GET",
          signal: signal as AbortSignal,
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Tabs ${res.status}`);
        const json = await res.json();
        const arr = Array.isArray(json) ? json : [];
        debugLog("[useTabStreamingQuery] Loaded tabs list", {
          interfaceId,
          count: Array.isArray(arr) ? arr.length : 0,
          names: Array.isArray(arr) ? arr.map((t: any) => t?.name) : []
        });
        return arr;
      } catch (e: any) {
        const msg = String(e?.message || e);
        if ((signal as AbortSignal | undefined)?.aborted || /Abort|aborted|Connection closed/i.test(msg)) {
          throw new CancelledError();
        }
        throw e;
      }
    },
    enabled: !!interfaceId,
    staleTime: 2 * 60 * 1000, // 2 minutes - tabs list
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });
  
  // Ensure allTabs is always an array, even if query fails and returns error object
  const allTabs = useMemo(() => Array.isArray(allTabsData) ? allTabsData : [], [allTabsData]);

  // Debounce active tab to avoid firing on rapid switches
  const [stableActiveTabName, setStableActiveTabName] = useState<string | null>(activeTabName ?? null);
  useEffect(() => {
    const t = setTimeout(() => {
      setStableActiveTabName(activeTabName ?? null);
      debugLog('[useTabStreamingQuery] stableActiveTabName updated', { activeTabName, stableActiveTabName: activeTabName ?? null });
    }, 250);
    return () => clearTimeout(t);
  }, [activeTabName]);

  // Cancel heavy queries immediately on tab change
  useEffect(() => {
    if (!activeTabName) return;
    queryClient.cancelQueries({
      predicate: (q: any) => {
        const k0 = q?.queryKey?.[0] as string;
        return k0 === 'tabCompleteData' || k0 === 'logs';
      }
    });
  }, [activeTabName, queryClient]);

  // Determine whether active query should be enabled
  const enabledActive = !!(interfaceId && activeTabName && projectId && stableActiveTabName === activeTabName);
  debugLog('[useTabStreamingQuery] Active query enabled check', { enabled: enabledActive, interfaceId, activeTabName, stableActiveTabName, projectId });

  // Stream data for the active tab using optimistic builder
  const activeTabQuery = useQuery<CompleteTabData>({
    queryKey: ["tabCompleteData", interfaceId, activeTabName, projectId],
    queryFn: async ({ signal }) => {
      if (!activeTabName || !projectId) {
        throw new Error("Missing required parameters for tab streaming");
      }

      const state = storeApi.getState();
      const activeTab = selectTabByName(state, interfaceId, activeTabName);
      if (!activeTab) {
        throw new Error(`Active tab ${activeTabName} not found`);
      }

      debugLog("[useTabStreamingQuery] Active tab:", activeTab);
      debugLog("[useTabStreamingQuery] Active build options", {
        skipTileData: false,
        listTiles: true
      });

      return buildCompleteTabData(
        interfaceId,
        activeTab.id!,
        activeTabName,
        projectId,
        {
          tabActions: actions.tabActions,
          tileActions: actions.tileActions,
          fieldsActions: actions.fieldsActions,
          logsActions: actions.logsActions,
          projectsActions: actions.projectsActions,
          contextActions: actions.contextActions,
        },
        {
          refetchProjects: false,
          refetchContexts: false,
          refetchFields: true,
          updateCache: true,
          skipTileData: false,  // Load full data for active tab
          signal: signal as AbortSignal,
        }
      );
    },
    enabled: enabledActive,
    staleTime: Infinity,        // Never mark as stale automatically (success path)
    gcTime: 15 * 60 * 1000,     // Garbage collect after 15 minutes to prevent unbounded memory
    retry: 3,                   // Be more resilient to transient timeouts
    retryDelay: (attempt) => Math.min(2000 * Math.pow(2, attempt - 1), 20000),
    refetchOnMount: false,      // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false,  // Don't refetch when network reconnects
    refetchInterval: false,     // No periodic refetching
  });

  // Hydrate Zustand store with tiles when an active tab full build completes
  useEffect(() => {
    const data = activeTabQuery.data;
    if (!data || data.mode !== 'full') return;
    const tabId = data.tabData?.id;
    if (!tabId) return;

    const tiles = Array.isArray(data.tiles) ? data.tiles : [];
    if (tiles.length === 0) return;

    // Use store actions to initialize any missing tiles and attach to the tab
    const state = storeApi.getState();
    const initTile = state.initTile; // (tabId, tileId, initialState)
    if (!initTile) return;

    try {
      tiles.forEach((t) => {
        if (!t?.id) return;
        // initTile is idempotent (skips if exists); provide minimal initial state
        initTile(String(tabId), String(t.id), {
          id: String(t.id),
          name: t.name,
          type: t.type,
          position: t.position as any,
          minW: (t as any)?.minW,
          minH: (t as any)?.minH,
          visible: (t as any)?.visible ?? true,
          tabId: String(tabId),
        } as any);
      });
      // Seed React Query tiles list to satisfy any listTiles consumers without refetch
      try {
        queryClient.setQueryData(["tiles", String(tabId), null], tiles);
        queryClient.setQueryData(["tiles", String(tabId)], tiles);
      } catch (_) {}
      debugLog('[useTabStreamingQuery] Hydrated tiles into store for tab', { tabId, count: tiles.length });
    } catch (e) {
      console.warn('[useTabStreamingQuery] Failed to hydrate tiles into store', e);
    }
  }, [activeTabQuery.data, storeApi, queryClient]);

  // Auto-refetch guard: if user re-activates a tab that previously failed or has no data, force a refetch once
  useEffect(() => {
    if (!enabledActive || !activeTabName || !projectId) return;
    const key = ["tabCompleteData", interfaceId, activeTabName, projectId] as const;
    const state = queryClient.getQueryState(key as any);
    const data = queryClient.getQueryData(key as any) as CompleteTabData | undefined;
    const needsRefetch = (state?.status === 'error') || (!data && !activeTabQuery.isLoading);
    if (needsRefetch) {
      debugLog('[useTabStreamingQuery] Forcing refetch on activation due to prior error/empty', { activeTabName });
      queryClient.invalidateQueries({ queryKey: key as any, refetchType: 'active' });
    }
  }, [enabledActive, activeTabName, interfaceId, projectId, activeTabQuery.isLoading, queryClient]);

  // Exponential backoff auto-retry when the active tab errors
  const errorRetryAttemptsRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!enabledActive || !activeTabName) return;
    if (!activeTabQuery.isError) return;
    // Backoff schedule per-tab
    const attempts = errorRetryAttemptsRef.current[activeTabName] || 0;
    if (attempts >= 4) return;
    const delay = Math.min(2000 * Math.pow(2, attempts), 20000);
    debugLog('[useTabStreamingQuery] Scheduling auto-retry for active tab', { activeTabName, attempts: attempts + 1, delay });
    const timer = setTimeout(() => {
      // Prefer refetch over invalidate to preserve backoff semantics
      (activeTabQuery as any).refetch?.();
    }, delay);
    errorRetryAttemptsRef.current[activeTabName] = attempts + 1;
    return () => clearTimeout(timer);
  }, [enabledActive, activeTabName, activeTabQuery.isError]);

  // Reset retry counter on success or when switching tabs
  useEffect(() => {
    if (activeTabQuery.data && activeTabName) {
      delete errorRetryAttemptsRef.current[activeTabName];
    }
  }, [activeTabQuery.data, activeTabName]);

  // Get non-active tabs that need prefetching
  const nonActiveTabs = useMemo(() => 
    allTabs.filter(tab => tab.name !== activeTabName && tab.name),
    [allTabs, activeTabName]
  );

  // Prioritize non-active tabs by proximity to the active tab for better UX
  const prioritizedNonActiveTabs = useMemo(() => {
    if (!activeTabName) return nonActiveTabs;
    const indexByName = new Map(allTabs.map((t, i) => [t.name!, i]));
    const activeIdx = indexByName.get(activeTabName) ?? 0;
    return [...nonActiveTabs].sort((a, b) => {
      const ai = indexByName.get(a.name!) ?? 0;
      const bi = indexByName.get(b.name!) ?? 0;
      return Math.abs(ai - activeIdx) - Math.abs(bi - activeIdx);
    });
  }, [nonActiveTabs, allTabs, activeTabName]);

  // Calculate which tabs should be in the current prefetch queue
  const prefetchQueue = useMemo(() => {
    if (!prefetchReady || !enableNonActivePrefetch) return [] as TabData[];

    const unprefetchedTabs = prioritizedNonActiveTabs.filter(tab => 
      !prefetchedTabs.has(tab.name!) && !currentlyPrefetching.has(tab.name!) && !failedPrefetchTabs.has(tab.name!)
    );
    const effectiveConcurrency = Math.max(0, Math.min(concurrency ?? MAX_CONCURRENT_PREFETCH, prefetchConcurrency));
    const availableSlots = Math.max(0, effectiveConcurrency - currentlyPrefetching.size);
    const tabsToAdd = unprefetchedTabs.slice(0, availableSlots);
    
    // Combine currently prefetching tabs with new tabs to add
    const currentQueue = Array.from(currentlyPrefetching)
      .map(name => prioritizedNonActiveTabs.find(tab => tab.name === name))
      .filter(Boolean) as TabData[];
      
    return [...currentQueue, ...tabsToAdd];
  }, [prefetchReady, enableNonActivePrefetch, prioritizedNonActiveTabs, prefetchedTabs, currentlyPrefetching, failedPrefetchTabs, concurrency, prefetchConcurrency]);

  // Update currently prefetching set when queue changes
  useEffect(() => {
    const newPrefetching = new Set(prefetchQueue.map(tab => tab.name!));
    if (newPrefetching.size !== currentlyPrefetching.size || 
        !Array.from(newPrefetching).every(name => currentlyPrefetching.has(name))) {
      debugLog(`[useTabStreamingQuery] Updating prefetch queue:`, Array.from(newPrefetching));
      setCurrentlyPrefetching(newPrefetching);
    }
  }, [prefetchQueue, currentlyPrefetching]);

  // Defer enabling non-active prefetch to prioritize active tab paint
  useEffect(() => {
    if (!enableNonActivePrefetch) {
      setPrefetchReady(false);
      return;
    }
    const timer = setTimeout(() => setPrefetchReady(true), deferMs);
    return () => clearTimeout(timer);
  }, [enableNonActivePrefetch, deferMs, interfaceId, projectId]);

  // Activity listeners for idle detection
  useEffect(() => {
    const markActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousemove', markActivity);
    window.addEventListener('keydown', markActivity);
    window.addEventListener('wheel', markActivity, { passive: true } as any);
    window.addEventListener('touchstart', markActivity, { passive: true } as any);
    document.addEventListener('visibilitychange', markActivity);
    return () => {
      window.removeEventListener('mousemove', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('wheel', markActivity as any);
      window.removeEventListener('touchstart', markActivity as any);
      document.removeEventListener('visibilitychange', markActivity);
    };
  }, []);

  // Idle-time ramp: gradually increase prefetch concurrency when idle; drop to 1 on activity
  // Also respects network constraints (Data Saver, 2g/3g)
  useEffect(() => {
    if (!enableNonActivePrefetch) return;
    
    // Determine max concurrency based on network conditions
    const networkMaxConcurrency = saveData || /2g|3g/.test(effectiveType || '') 
      ? 1 
      : (concurrency ?? MAX_CONCURRENT_PREFETCH);
    
    const interval = setInterval(() => {
      const now = Date.now();
      const idleForMs = now - lastActivityRef.current;
      const isVisible = typeof document === 'undefined' ? true : document.visibilityState === 'visible';
      const idle = isVisible && idleForMs > 2000 && isFetchingAny === 0;
      if (idle) {
        setPrefetchConcurrency(prev => Math.min(networkMaxConcurrency, Math.max(1, prev + 1)));
      } else {
        setPrefetchConcurrency(prev => (prev > 1 ? 1 : prev));
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [enableNonActivePrefetch, isFetchingAny, concurrency, saveData, effectiveType]);

  // Backoff and retry failed prefetches when idle
  useEffect(() => {
    if (!enableNonActivePrefetch || failedPrefetchTabs.size === 0) return;
    const timers: NodeJS.Timeout[] = [];
    failedPrefetchTabs.forEach((name) => {
      const timer = setTimeout(() => {
        debugLog(`[useTabStreamingQuery] Retrying failed prefetch for tab: ${name}`);
        setFailedPrefetchTabs(prev => {
          const next = new Set(prev);
          next.delete(name); // Remove from failed set so it can be re-queued
          return next;
        });
      }, 8000); // 8 second backoff
      timers.push(timer);
    });
    return () => timers.forEach(clearTimeout);
  }, [failedPrefetchTabs, enableNonActivePrefetch]);

  // Prefetch tabs in the current queue
  const prefetchQueries = useQueries({
    queries: prefetchQueue.map(tab => ({
      // Use separate key for light prefetch to avoid cache collision with full active builds
      queryKey: ["tabCompleteDataLight", interfaceId, tab.name, projectId],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        if (!tab.name || !projectId || !tab.id) {
          throw new Error("Missing required parameters for tab prefetching");
        }

        debugLog(`[useTabStreamingQuery] Starting prefetch for tab: ${tab.name} (non-active)`);
        debugLog("[useTabStreamingQuery] Prefetch build options", {
          prefetchMode,
          skipTileData: prefetchMode !== 'full',
          listTiles: prefetchMode === 'full'
        });
        
      const completeData = await buildCompleteTabData(
          interfaceId,
          tab.id,
          tab.name,
          projectId,
          {
            tabActions: actions.tabActions,
            tileActions: actions.tileActions,
            fieldsActions: actions.fieldsActions,
            logsActions: actions.logsActions,
            projectsActions: actions.projectsActions,
            contextActions: actions.contextActions,
          },
          {
            refetchProjects: false,
            refetchContexts: false,
            refetchFields: prefetchMode === 'full',
            updateCache: true,
            skipTileData: prefetchMode !== 'full',
            // Do not list tiles for non-active light prefetch to avoid server-action POSTs
            listTiles: prefetchMode === 'full',
            signal: signal as AbortSignal,
          }
        );

        // Ensure non-active tabs are marked as inactive
        if (completeData && completeData.tabData) {
          completeData.tabData.active = false;
        }

        return completeData;
      },
      enabled: !!(interfaceId && projectId && tab.name),
      staleTime: 10 * 60 * 1000, // 10 minutes for prefetch
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 0, // Don't retry prefetch failures immediately
      networkMode: 'always' as const, // Always attempt prefetch even if offline
    }))
  });

  // Track completed prefetches and update queues
  useEffect(() => {
    const newCompleted = new Set(prefetchedTabs);
    const stillPrefetching = new Set(currentlyPrefetching);
    const newFailed = new Set(failedPrefetchTabs);
    
    prefetchQueries.forEach((query, index) => {
      const tabName = prefetchQueue[index]?.name;
      if (tabName) {
        if (query.isSuccess) {
          debugLog(`[useTabStreamingQuery] Completed prefetch for tab: ${tabName}`);
          newCompleted.add(tabName);
          stillPrefetching.delete(tabName);
        } else if (query.isError) {
          if (query.error instanceof CancelledError) {
            debugLog(`[useTabStreamingQuery] Prefetch canceled for tab: ${tabName}`);
          } else {
            console.warn(`[useTabStreamingQuery] Failed to prefetch tab: ${tabName}`, query.error);
            newFailed.add(tabName);
          }
          stillPrefetching.delete(tabName);
        }
      }
    });
    
    // Update state if there are changes
    if (newCompleted.size !== prefetchedTabs.size) {
      setPrefetchedTabs(newCompleted);
    }
    
    if (stillPrefetching.size !== currentlyPrefetching.size ||
        !Array.from(stillPrefetching).every(name => currentlyPrefetching.has(name))) {
      setCurrentlyPrefetching(stillPrefetching);
    }

    if (newFailed.size !== failedPrefetchTabs.size ||
        !Array.from(newFailed).every(name => failedPrefetchTabs.has(name))) {
      setFailedPrefetchTabs(newFailed);
    }
  }, [prefetchQueries, prefetchQueue, prefetchedTabs, currentlyPrefetching, failedPrefetchTabs]);

  // Function to switch tabs instantly (using cached data)
  const switchTab = useCallback((tabName: string) => {
    const cachedData = queryClient.getQueryData<CompleteTabData>([
      "tabCompleteData", interfaceId, tabName, projectId
    ]);
    
    // Only treat as instant if we have a full build; light prefetch doesn't count
    const isInstant = !!(cachedData && cachedData.mode === 'full');
    
    if (isInstant) {
      // Tab data is already cached with full tiles, switching will be instant
      debugLog(`[switchTab] Tab ${tabName} is cached (mode=${cachedData?.mode}) - instant switch available`);
      return true;
    } else {
      // Need to fetch data, will show loading state
      debugLog(`[switchTab] Tab ${tabName} not cached as full (mode=${cachedData?.mode}) - will need to load`);
      return false;
    }
  }, [queryClient, interfaceId, projectId]);

  // Function to get cached tab data
  const getCachedTabData = useCallback((tabName: string) => {
    const data = queryClient.getQueryData<CompleteTabData>([
      "tabCompleteData", interfaceId, tabName, projectId
    ]);
    // Only return full builds; light prefetch doesn't have complete data
    return (data && data.mode === 'full') ? data : undefined;
  }, [queryClient, interfaceId, projectId]);

  // Function to prefetch specific tab (if not already prefetched or in queue)
  const prefetchTab = useCallback(async (tabName: string) => {
    if (!prefetchedTabs.has(tabName) && !currentlyPrefetching.has(tabName) && projectId) {
      debugLog(`[prefetchTab] Manually prefetching tab: ${tabName} (non-active)`);
      
      // Find the tab to get its ID
      const state = storeApi.getState();
      const tab = selectTabByName(state, interfaceId, tabName);
      if (!tab || !tab.id) {
        console.error(`[prefetchTab] Tab ${tabName} not found or missing ID`);
        return;
      }
      
      // Add to currently prefetching set temporarily
      setCurrentlyPrefetching(prev => new Set([...Array.from(prev), tabName]));
      
      try {
        await queryClient.prefetchQuery({
          queryKey: ["tabCompleteData", interfaceId, tabName, projectId],
          queryFn: async () => {
            const completeData = await buildCompleteTabData(
              interfaceId,
              tab.id!,
              tabName,
              projectId,
              {
                tabActions: actions.tabActions,
                tileActions: actions.tileActions,
                fieldsActions: actions.fieldsActions,
                logsActions: actions.logsActions,
                projectsActions: actions.projectsActions,
                contextActions: actions.contextActions,
              },
              {
                refetchProjects: false,
                refetchContexts: false,
                refetchFields: true,
                updateCache: true,
                skipTileData: false,  // Load full data for manual prefetch too
                listTiles: true,
              }
            );

            // Ensure manually prefetched tabs are marked as inactive (since they're not active)
            if (completeData && completeData.tabData && tabName !== activeTabName) {
              completeData.tabData.active = false;
            }

            return completeData;
          },
          staleTime: Infinity,
        });
        
        setPrefetchedTabs(prev => new Set([...Array.from(prev), tabName]));
      } catch (e: any) {
        if (e instanceof CancelledError) {
          debugLog(`[prefetchTab] Prefetch canceled for ${tabName}`);
        } else {
          console.warn(`[prefetchTab] Prefetch failed for ${tabName}`, e);
        }
      } finally {
        // Remove from currently prefetching
        setCurrentlyPrefetching(prev => {
          const newSet = new Set(prev);
          newSet.delete(tabName);
          return newSet;
        });
      }
    }
  }, [queryClient, interfaceId, projectId, actions, prefetchedTabs, currentlyPrefetching, buildCompleteTabData, activeTabName]);

  // Function to refresh tab data (useful for sync operations)
  const refreshTabData = useCallback(async (tabName: string, options?: {
    refetchProjects?: boolean;
    refetchContexts?: boolean;
    refetchFields?: boolean;
  }) => {
    if (!projectId) return null;

    debugLog(`[refreshTabData] Refreshing tab data for: ${tabName}`);
    
    // Simply invalidate and let React Query refetch automatically
    // This prevents double-fetching and reduces server action spam
    await queryClient.invalidateQueries({
      queryKey: ["tabCompleteData", interfaceId, tabName, projectId]
    });

    // Also invalidate related caches if requested
    if (options?.refetchFields) {
      await queryClient.invalidateQueries({
        queryKey: ["fields", projectId],
        refetchType: 'active'
      });
    }
    
    if (options?.refetchContexts) {
      await queryClient.invalidateQueries({
        queryKey: ["contexts", projectId],
        refetchType: 'active'
      });
    }

    if (options?.refetchProjects) {
      await queryClient.invalidateQueries({
        queryKey: ["projects"],
        refetchType: 'active'
      });
    }

    // Return the fresh data from the cache after React Query refetches
    return queryClient.getQueryData<CompleteTabData>(["tabCompleteData", interfaceId, tabName, projectId]) || null;
  }, [queryClient, interfaceId, projectId]);

  return {
    // Active tab data
    activeTab: {
      isLoading: activeTabQuery.isLoading,
      isError: activeTabQuery.isError,
      error: activeTabQuery.error,
      data: activeTabQuery.data,
    },
    // During the debounce window we haven't enabled the active query yet
    activationPending: stableActiveTabName !== activeTabName,
    
    // Prefetching state
    prefetchedTabs,
    prefetchProgress: {
      total: nonActiveTabs.length,
      completed: prefetchedTabs.size,
      inProgress: currentlyPrefetching.size,
    },
    
    // Tab switching utilities
    switchTab,
    getCachedTabData,
    prefetchTab,
    refreshTabData,
    
    // All available tabs
    allTabs,

    // Expose current effective prefetch concurrency (for debug/telemetry)
    prefetchConcurrency,
  };
} 