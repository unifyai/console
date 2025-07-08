"use client";

import { useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useMemo } from "react";
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
  actions: StreamingActions
) {
  const queryClient = useQueryClient();
  const storeApi = useStoreApiContext();
  const [prefetchedTabs, setPrefetchedTabs] = useState<Set<string>>(new Set());
  const [currentlyPrefetching, setCurrentlyPrefetching] = useState<Set<string>>(new Set());
  const { buildCompleteTabData } = useTabDataOptimistic();

  // Get all tabs for the interface from cache first
  const { data: allTabs = [] } = useQuery<TabData[]>({
    queryKey: ["tabs", interfaceId],
    queryFn: () => actions.tabActions.list(interfaceId, false),
    enabled: !!interfaceId,
    staleTime: Infinity,        // Always refetch when component mounts
    gcTime: Infinity,
    refetchOnMount: false,      // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false,  // Don't refetch when network reconnects
    refetchInterval: false,     // No periodic refetching
  });

  // Stream data for the active tab using optimistic builder
  const activeTabQuery = useQuery<CompleteTabData>({
    queryKey: ["tabCompleteData", interfaceId, activeTabName, projectId],
    queryFn: async () => {
      if (!activeTabName || !projectId) {
        throw new Error("Missing required parameters for tab streaming");
      }

      const state = storeApi.getState();
      const activeTab = selectTabByName(state, interfaceId, activeTabName);
      if (!activeTab) {
        throw new Error(`Active tab ${activeTabName} not found`);
      }

      debugLog("[useTabStreamingQuery] Active tab:", activeTab);

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
          skipTileData: true,
        }
      );
    },
    enabled: !!(interfaceId && activeTabName && projectId),
    staleTime: Infinity,        // Never mark as stale automatically
    gcTime: Infinity,           // Never garbage collect
    refetchOnMount: false,      // Don't refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false,  // Don't refetch when network reconnects
    refetchInterval: false,     // No periodic refetching
  });

  // Get non-active tabs that need prefetching
  const nonActiveTabs = useMemo(() => 
    allTabs.filter(tab => tab.name !== activeTabName && tab.name),
    [allTabs, activeTabName]
  );

  // Calculate which tabs should be in the current prefetch queue
  const prefetchQueue = useMemo(() => {
    const unprefetchedTabs = nonActiveTabs.filter(tab => 
      !prefetchedTabs.has(tab.name!) && !currentlyPrefetching.has(tab.name!)
    );
    
    const availableSlots = MAX_CONCURRENT_PREFETCH - currentlyPrefetching.size;
    const tabsToAdd = unprefetchedTabs.slice(0, Math.max(0, availableSlots));
    
    // Combine currently prefetching tabs with new tabs to add
    const currentQueue = Array.from(currentlyPrefetching)
      .map(name => nonActiveTabs.find(tab => tab.name === name))
      .filter(Boolean) as TabData[];
      
    return [...currentQueue, ...tabsToAdd];
  }, [nonActiveTabs, prefetchedTabs, currentlyPrefetching]);

  // Update currently prefetching set when queue changes
  useEffect(() => {
    const newPrefetching = new Set(prefetchQueue.map(tab => tab.name!));
    if (newPrefetching.size !== currentlyPrefetching.size || 
        !Array.from(newPrefetching).every(name => currentlyPrefetching.has(name))) {
      debugLog(`[useTabStreamingQuery] Updating prefetch queue:`, Array.from(newPrefetching));
      setCurrentlyPrefetching(newPrefetching);
    }
  }, [prefetchQueue, currentlyPrefetching]);

  // Prefetch tabs in the current queue
  const prefetchQueries = useQueries({
    queries: prefetchQueue.map(tab => ({
      queryKey: ["tabCompleteData", interfaceId, tab.name, projectId],
      queryFn: async () => {
        if (!tab.name || !projectId || !tab.id) {
          throw new Error("Missing required parameters for tab prefetching");
        }

        debugLog(`[useTabStreamingQuery] Starting prefetch for tab: ${tab.name} (non-active)`);
        
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
            refetchFields: true,
            updateCache: true,
            skipTileData: false,
          }
        );

        // Ensure non-active tabs are marked as inactive
        if (completeData && completeData.tabData) {
          completeData.tabData.active = false;
        }

        return completeData;
      },
      enabled: !!(interfaceId && projectId && tab.name),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }))
  });

  // Track completed prefetches and update queues
  useEffect(() => {
    const newCompleted = new Set(prefetchedTabs);
    const stillPrefetching = new Set(currentlyPrefetching);
    
    prefetchQueries.forEach((query, index) => {
      const tabName = prefetchQueue[index]?.name;
      if (tabName) {
        if (query.isSuccess) {
          debugLog(`[useTabStreamingQuery] Completed prefetch for tab: ${tabName}`);
          newCompleted.add(tabName);
          stillPrefetching.delete(tabName);
        } else if (query.isError) {
          console.warn(`[useTabStreamingQuery] Failed to prefetch tab: ${tabName}`, query.error);
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
  }, [prefetchQueries, prefetchQueue, prefetchedTabs, currentlyPrefetching]);

  // Function to switch tabs instantly (using cached data)
  const switchTab = useCallback((tabName: string) => {
    const cachedData = queryClient.getQueryData<CompleteTabData>([
      "tabCompleteData", interfaceId, tabName, projectId
    ]);
    
    if (cachedData) {
      // Tab data is already cached, switching will be instant
      debugLog(`[switchTab] Tab ${tabName} is cached - instant switch available`);
      return true;
    } else {
      // Need to fetch data, will show loading state
      debugLog(`[switchTab] Tab ${tabName} not cached - will need to load`);
      return false;
    }
  }, [queryClient, interfaceId, projectId]);

  // Function to get cached tab data
  const getCachedTabData = useCallback((tabName: string) => {
    return queryClient.getQueryData<CompleteTabData>([
      "tabCompleteData", interfaceId, tabName, projectId
    ]);
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
                skipTileData: true,
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
    
    // Find the tab to get its ID
    const state = storeApi.getState();
    const tab = selectTabByName(state, interfaceId, tabName);
    if (!tab || !tab.id) {
      console.error(`[refreshTabData] Tab ${tabName} not found or missing ID`);
      return null;
    }
    
    // Invalidate existing cache
    queryClient.invalidateQueries({
      queryKey: ["tabCompleteData", interfaceId, tabName, projectId]
    });

    // Build fresh data
    const completeData = await buildCompleteTabData(
      interfaceId,
      tab.id,
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
        refetchProjects: options?.refetchProjects ?? false,
        refetchContexts: options?.refetchContexts ?? false,
        refetchFields: options?.refetchFields ?? true,
        updateCache: true,
      }
    );

    // Set correct active state based on whether this is the currently active tab
    if (completeData && completeData.tabData) {
      completeData.tabData.active = tabName === activeTabName;
    }

    return completeData;
  }, [queryClient, interfaceId, projectId, actions, buildCompleteTabData, activeTabName]);

  return {
    // Active tab data
    activeTab: {
      isLoading: activeTabQuery.isLoading,
      isError: activeTabQuery.isError,
      error: activeTabQuery.error,
      data: activeTabQuery.data,
    },
    
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
  };
} 