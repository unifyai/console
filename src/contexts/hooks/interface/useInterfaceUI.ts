import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { InterfaceUI } from '../../slices/selectors/interface';
import { useInterfaceMeta } from './useInterfaceMeta';

/**
 * Interface for interface-related UI actions
 */
export interface InterfaceUIActions {
  setActiveTabId: (tabId: string | null) => void;
}

/**
 * Custom hook to access interface UI state and actions
 * @param interfaceIdOrName The ID or name of the interface to access
 * @param projectIdOrName Optional project ID or name
 * @returns Object containing interface UI state and actions
 */
export function useInterfaceUI(interfaceIdOrName: string | null, projectIdOrName?: string | null) {
  // Use the meta hook to get common interface info
  const { 
    interfaceId, 
    activeProjectId, 
    interfaceExists 
  } = useInterfaceMeta(interfaceIdOrName, projectIdOrName);

  // Granular subscriptions to UI properties
  const projectIdFromState = useStoreContext(state => {
    if (!interfaceExists || !interfaceId) return null;
    return state.interfacesById[interfaceId].projectId;
  });
  
  const activeTabId = useStoreContext(state => {
    if (!interfaceExists || !interfaceId) return null;
    return state.interfacesById[interfaceId].activeTabId;
  });

  // Get store actions for UI state management
  const storeUpdateInterface = useStoreContext(state => state.updateInterface);
  const storeSetActiveTab = useStoreContext(state => state.setActiveTab);

  // Memoize the UI state object to prevent unnecessary rerenders
  const ui = useMemo<Partial<InterfaceUI> | null>(() => {
    if (!interfaceExists) return null;
    
    return {
      projectId: projectIdFromState,
      activeTabId,
    };
  }, [
    interfaceExists, 
    projectIdFromState, 
    activeTabId,
  ]);

  // Memoize the UI actions to prevent unnecessary re-renders
  const uiActions = useMemo<InterfaceUIActions>(() => ({
    setActiveTabId: (tabId) => {
      if (activeProjectId && interfaceId) {
        // Set the active tab at the global level
        if (tabId) {
          storeSetActiveTab(interfaceId, tabId);
        }
        
        // Update the interface's active tab
        storeUpdateInterface(interfaceId, { activeTabId: tabId });
      }
    },

  }), [
    activeProjectId, 
    interfaceId, 
    storeSetActiveTab, 
    storeUpdateInterface
  ]);

  return {
    ui,
    uiActions,
    activeTabId
  };
} 