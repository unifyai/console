"use client";

import { useMemo } from "react";
import { GranularInterfaceActions, GranularTabActions } from "@/types/evals/grid";
import { useCreateTabQuery, useUpdateTabQuery,  useDeleteTabQuery } from "@/hooks/Query/useTabsQuery";
import { useInterface } from "../useInterface";
import { InterfaceDataActions } from "../useInterfaceData";
import { InterfaceUIActions } from "../useInterfaceUI";
import { v4 as uuidv4 } from 'uuid';
import { Tab } from "@/contexts/slices/selectors/tab";
import { useUpdateInterfaceUnifiedQuery } from "@/hooks/Query/useInterfacesQuery";

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
  ui: InterfaceUIActions | null;
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
  
  // Mutation hooks for server state updates
  const updateInterfaceMutation = useUpdateInterfaceUnifiedQuery();
  const createTabMutation = useCreateTabQuery();
  const updateTabMutation = useUpdateTabQuery();
  const deleteTabMutation = useDeleteTabQuery();
  
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

      console.log("Creating tab:", {
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

      console.log(`Tab ${newTabName} created with ID ${tabId}`);

      // Also update the interface's active_tab_id on the server
      const result2 = await updateInterfaceMutation.mutateAsync({
        interfaceId: interfaceId,
        data: {
          active_tab_id: tabId
        },
        actions: interfaceActions as GranularInterfaceActions
      });

      console.log("Interface update result:", result2);
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
  const syncedUIActions = useMemo<InterfaceUIActions | null>(() => {
    if (!interfaceUIActions) return null;

    return {
      ...interfaceUIActions,
      // Use the specialized wrapper functions for each property
    } as InterfaceUIActions;
  }, [
    interfaceUIActions,
    interfaceId,
    interfaceActions,
    tabActions
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