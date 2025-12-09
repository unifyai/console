"use client";

import { useMemo, useRef } from "react";
import { GranularInterfaceActions, GranularTabActions, TabData } from "@/types/interfaces/grid";
import { useCreateTabQuery, useUpdateTabQuery, useUpdateTabByIdQuery, useDeleteTabQuery } from "@/hooks/Interfaces/Query/useTabsQuery";
import { useInterface } from "../useInterface";
import { InterfaceDataActions } from "../useInterfaceData";
import { InterfaceUIActions } from "../useInterfaceUI";
import { v4 as uuidv4 } from 'uuid';
import { Tab } from "@/contexts/slices/selectors/tab";
import { useUpdateInterfaceUnifiedQuery } from "@/hooks/Interfaces/Query/useInterfacesQuery";
import { getTabId } from "@/contexts/selectors/tab";
import { useStoreApiContext } from "@/contexts/providers/StoreProvider";
import { selectTabsForInterface } from "@/contexts/selectors/tab";
import { useQueryClient } from "@tanstack/react-query";
import { CompleteTabData } from "@/hooks/Interfaces/Query/useTabDataOptimistic";

/**
 * Debug flag for state syncing logging
 * Set NEXT_PUBLIC_DEBUG_STATE_SYNCING=true to enable detailed state synchronization logs
 */
const DEBUG_STATE_SYNCING = process.env.NEXT_PUBLIC_DEBUG_STATE_SYNCING === 'true';

/**
 * Conditional debug logger for state syncing
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_STATE_SYNCING) {
    console.log(...args);
  }
};

/**
 * Extended interface for InterfaceUIActions with synchronized server updates
 */
export interface SyncedInterfaceUIActions extends InterfaceUIActions {
  setActiveTab: (tabIdOrName: string | null) => void;
}

/**
 * Extended interface for InterfaceDataActions with additional parameters
 */
export interface SyncedInterfaceDataActions extends InterfaceDataActions {
  // Add any other extended methods here that have additional parameters
}

/**
 * Extended interface for InterfaceActions with synchronized data actions
 */
export interface SyncedInterfaceActions {
  data: SyncedInterfaceDataActions | null;
  ui: SyncedInterfaceUIActions | null;
}

/**
 * A hook that provides interface actions that are synchronized with server state
 * through React Query and router refreshes.
 *
 * @param interfaceId - The ID of the interface
 * @param projectId - The ID of the project
 * @param interfaceActions - The granular interface actions for server-side operations
 * @param tabActions - The granular tab actions for server-side operations
 * @returns Object containing synchronized actions
 */
export function useInterfaceSync(
  interfaceId: string | null,
  projectId: string | null,
  interfaceActions: GranularInterfaceActions | undefined,
  tabActions?: GranularTabActions | undefined,
): { actions: SyncedInterfaceActions | null } {
  // Get interface UI actions for router refresh coordination
  const {actions: interfaceOriginalActions } = useInterface(interfaceId, projectId);
  const { data: interfaceDataActions, ui: interfaceUIActions } = interfaceOriginalActions ?? { data: null, ui: null };
  
  // Get store API for state access
  const storeApi = useStoreApiContext();
  
  // Get query client for cache updates
  const queryClient = useQueryClient();
  
  // Mutation hooks for server state updates
  const updateInterfaceMutation = useUpdateInterfaceUnifiedQuery();
  const createTabMutation = useCreateTabQuery();
  const updateTabMutation = useUpdateTabQuery();
  const updateTabByIdMutation = useUpdateTabByIdQuery();
  const deleteTabMutation = useDeleteTabQuery();

  // Refs for debouncing active tab persistence (must be at hook top-level)
  const persistTimerRef = useRef<any>(null);
  const lastScheduledRef = useRef<string | null>(null);
  const lastPersistedRef = useRef<string | null>(null);

  // Helper: propagate interface context to tabs/tiles without explicit context
  const propagateInterfaceContext = async (context?: string | null) => {
    if (!interfaceId || !interfaceActions || !tabActions || !context) return;
    try {
      // Get all tabs for this interface
      const listTabsFn = await tabActions.list;
      const tabs = await listTabsFn(interfaceId);
      if (Array.isArray(tabs)) {
        for (const tab of tabs) {
          // If tab has no context, set it
          if (!tab.context || tab.context === "") {
            await updateTabByIdMutation.mutateAsync({
              id: tab.id as string,
              data: { context },
              actions: tabActions
            });
          }
        }
      }
    } catch (e) {
      console.warn("Failed to propagate interface context:", e);
    }
  };
  
  /**
   * Add a new tab to an interface with a generated UUID
   */
  const wrapAddTab = async (newTabName: string, initialState: Partial<Tab> = {}) => {
    if (!interfaceId || !interfaceDataActions || !tabActions) return;

    try {
      // Generate a UUID for the new tab
      const tabId = uuidv4();

      // First update the local state with the generated tabId
      interfaceDataActions.addTab(newTabName, {
        ...initialState,
        id: tabId,
        name: newTabName
      } as Tab);

      // Pass active to be true in the initial state
      initialState = {
        ...initialState,
        visible: true,
        active: true
      };

      debugLog("Creating tab:", {
        interface_id: interfaceId,
        name: newTabName,
        data: initialState,
        tab_id: tabId,
        actions: tabActions
      });

      // Create the tab on the server with the generated UUID
      const result = await createTabMutation.mutateAsync({
        interface_id: interfaceId,
        name: newTabName,
        data: initialState,
        tab_id: tabId,
        actions: tabActions
      });

      debugLog(`Tab ${newTabName} created with ID ${tabId}`);

      // Also update the interface's active_tab_id on the server
      const result2 = await updateInterfaceMutation.mutateAsync({
        interfaceId: interfaceId,
        data: {
          active_tab_id: tabId
        },
        actions: interfaceActions as GranularInterfaceActions
      });

      debugLog("Interface update result:", result2);
      return result;
      
    } catch (error) {
      console.error(`Failed to create tab ${newTabName}:`, error);
      
      // Rollback local state if server creation failed
      interfaceDataActions.removeTab(newTabName);
      
      // Inform the user of the error
      if (interfaceUIActions) {
        console.error(`Failed to create tab ${newTabName}: ${error}`);
      }
      
      return null;
    }
  };

  /**
   * Rename a tab
   */
  const wrapRenameTab = (tabName: string, newTabName: string) => {
    if (!tabName || !interfaceDataActions || !tabActions) return;

    // 1) Update local state immediately
    interfaceDataActions.renameTab(tabName, newTabName);

    // 2) Update the tab name on the server
    updateTabMutation.mutate({
      interface_id: interfaceId as string,
      name: tabName,
      data: {
        name: newTabName
      },
      actions: tabActions
    });
  };

  /**
   * Remove a tab from an interface
   */
  const wrapRemoveTab = (tabName: string) => {
    if (!tabName || !interfaceDataActions || !tabActions) return;

    // 1) Update local state immediately
    interfaceDataActions.removeTab(tabName);

    // 2) Optimistic server update
    deleteTabMutation.mutate({
      name: tabName,
      interface_id: interfaceId as string,
      actions: tabActions
    });
  };

  /**
   * Set active tab with server synchronization
   * Handles both tabId and tabName inputs
   */
  const wrapSetActiveTab = async (tabIdOrName: string | null) => {
    if (!interfaceId || !interfaceUIActions || !interfaceActions || !projectId) return;

    try {
      let tabId: string | null = null;
      
      if (tabIdOrName) {
        // Use the store API to get current state and convert tabIdOrName to tabId
        const currentState = storeApi.getState();
        tabId = getTabId(currentState, interfaceId, tabIdOrName);
      }

      if (!tabId && tabIdOrName) {
        console.warn(`Tab "${tabIdOrName}" not found in interface ${interfaceId}`);
        return;
      }

      // 1) Update local state immediately (optimistic update)
      interfaceUIActions.setActiveTab(tabIdOrName);

      // 2) Debounced server persistence to avoid spamming on rapid switches
      // If nothing to persist or same as last persisted/scheduled, skip
      if (!tabId) return;
      if (lastPersistedRef.current === tabId) {
        debugLog("Active tab already persisted; skipping", tabId);
        // proceed to cache sync below
      } else if (lastScheduledRef.current === tabId) {
        debugLog("Active tab persist already scheduled; skipping re-schedule", tabId);
      } else {
        lastScheduledRef.current = tabId;
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        persistTimerRef.current = setTimeout(async () => {
          try {
            await updateInterfaceMutation.mutateAsync({
              interfaceId: interfaceId,
              data: { active_tab_id: tabId },
              actions: interfaceActions as GranularInterfaceActions
            });
            lastPersistedRef.current = tabId;
          } catch (e) {
            // swallow error; UI stays consistent and a future change will retry
          } finally {
            lastScheduledRef.current = null;
            persistTimerRef.current = null;
          }
        }, 500);
      }

      // 3) Update React Query cache to sync tab active states
      const currentState = storeApi.getState();
      
      if (queryClient) {
        // Update the tabs list cache to mark correct tab as active
        const tabsQueryKey = ["tabs", interfaceId];
        const cachedTabs = queryClient.getQueryData(tabsQueryKey) as TabData[];
        
        if (cachedTabs) {
          const updatedTabs = cachedTabs.map(tab => ({
            ...tab,
            active: tab.id === tabId
          }));
          queryClient.setQueryData(tabsQueryKey, updatedTabs);
        }

        // Update individual tab complete data caches
        const allTabsInInterface = selectTabsForInterface(currentState, interfaceId);
        
        for (const tab of allTabsInInterface) {
          if (tab.name) {
            const tabCompleteDataKey = ["tabCompleteData", interfaceId, tab.name, projectId];
            const cachedCompleteData = queryClient.getQueryData(tabCompleteDataKey) as CompleteTabData;
            
            if (cachedCompleteData && cachedCompleteData.tabData) {
              const updatedCompleteData = {
                ...cachedCompleteData,
                tabData: {
                  ...cachedCompleteData.tabData,
                  active: tab.id === tabId
                }
              };
              queryClient.setQueryData(tabCompleteDataKey, updatedCompleteData);
            }
          }
        }
      }

      debugLog(`Active tab set to: ${tabIdOrName} (ID: ${tabId})`);
      
    } catch (error) {
      console.error(`Failed to set active tab to ${tabIdOrName}:`, error);
      
      // On error, we could rollback the optimistic update
      // but since we're using React Query, it should handle this automatically
    }
  };

  // Create the enhanced actions object with the wrapped setters
  const syncedDataActions = useMemo<SyncedInterfaceDataActions | null>(() => {
    if (!interfaceDataActions) return null;

    return {
      ...interfaceDataActions,
      // Use the specialized wrapper functions for each property
      addTab: wrapAddTab,
      renameTab: wrapRenameTab,
      removeTab: wrapRemoveTab
    } as SyncedInterfaceDataActions;
  }, [
    interfaceDataActions,
    interfaceId,
    interfaceActions,
    tabActions
  ]);

  // Create the enhanced actions object with the wrapped setters
  const syncedUIActions = useMemo<SyncedInterfaceUIActions | null>(() => {
    if (!interfaceUIActions) return null;

    return {
      ...interfaceUIActions,
      // Override setActiveTab with synced version
      setActiveTab: wrapSetActiveTab
    } as SyncedInterfaceUIActions;
  }, [
    interfaceUIActions,
    interfaceId,
    interfaceActions,
    wrapSetActiveTab
  ]);

  // Create the full actions object that incorporates the synced data actions
  const syncedActions = useMemo<SyncedInterfaceActions | null>(() => {
    if (!interfaceOriginalActions || !syncedDataActions) return null;

    return {
      ...interfaceOriginalActions,
      data: syncedDataActions,
      ui: syncedUIActions
    } as SyncedInterfaceActions;
  }, [interfaceOriginalActions, syncedDataActions, syncedUIActions]);

  // Export actions to be used by the component
  return {
    actions: syncedActions,
  };
} 