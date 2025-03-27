import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { InterfaceUI } from '../../slices/selectors/interface';
import { useInterfaceMeta } from './useInterfaceMeta';

/**
 * Interface for interface-related UI actions
 */
export interface InterfaceUIActions {
  setActiveTabId: (tabName: string | null) => void;
}

/**
 * Custom hook to access interface UI state and actions
 * @param interfaceName The name of the interface to access
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing interface UI state and actions
 */
export function useInterfaceUI(interfaceName: string | null, projectName?: string | null) {
  // Use the meta hook to get common interface info
  const { 
    interfaceId, 
    activeProjectId, 
    interfaceExists 
  } = useInterfaceMeta(interfaceName, projectName);

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
      activeTabId
    };
  }, [interfaceExists, projectIdFromState, activeTabId]);

  // Memoize the UI actions to prevent unnecessary re-renders
  const uiActions = useMemo<InterfaceUIActions>(() => ({
    setActiveTabId: (tabName) => {
      if (activeProjectId && interfaceId) {
        // Check if the tab ID is already hierarchical
        const hierarchicalTabId = tabName && !tabName.includes('>')
          ? `${interfaceId}>${tabName}`
          : tabName;
        
        // Set the active tab at the global level
        if (hierarchicalTabId) {
          storeSetActiveTab(interfaceId, hierarchicalTabId);
        }
        
        // Update the interface's active tab
        storeUpdateInterface(interfaceId, { activeTabId: hierarchicalTabId });
      }
    }
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