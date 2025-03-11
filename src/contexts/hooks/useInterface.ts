import { useMemo } from 'react';
import { useStoreContext } from '../providers/StoreProvider';
import { Interface } from '../slices/selectors/interface';
import { Tab } from '../slices/selectors/tab';
import { useShallow } from 'zustand/react/shallow';

// Define the default return value for the useInterface hook
const DEFAULT_USE_INTERFACE_RETURN = {
  interface: null,
  actions: null,
  exists: false
};

/**
 * Interface for interface-related actions
 */
export interface InterfaceActions {
  // Basic interface management
  initInterface: (initialState?: Partial<Interface>) => void;
  updateInterface: (updates: Partial<Interface>) => void;
  removeInterface: () => void;
  
  // Property setters
  setName: (name: string) => void;
  
  // Tab management
  setTabIds: (tabs: string[]) => void;
  
  // Helper methods
  getTabIds: () => string[];
}

/**
 * Custom hook to access interface state and actions
 * @param interfaceId The ID of the interface to access
 * @param projectId Optional project ID (if not provided, active project will be used)
 * @returns Object containing interface state, actions, and existence flag
 */
export function useInterface(interfaceId: string | null, projectId?: string | null) {
  // Call all hooks unconditionally at the top level
  
  // Get active project ID if not provided
  const activeProjectId = useStoreContext(state => 
    projectId !== undefined ? projectId : state.activeProjectId
  );

  // Instead of subscribing to the entire interface object,
  // we subscribe to individual properties. This way, changes in
  // unrelated fields won't cause a new reference for everything.

  // We first check if project or interface exist. If not, all below are null/undefined.
  const hasInterface = useStoreContext(state => {
    if (!interfaceId || !activeProjectId) return false;
    const proj = state.projectsById[activeProjectId];
    return !!(proj && proj.interfaces && proj.interfaces[interfaceId]);
  });

  const name = useStoreContext(state => {
    if (!hasInterface || !activeProjectId || !interfaceId) return null;
    return state.projectsById[activeProjectId].interfaces[interfaceId].name;
  });
  const activeTabId = useStoreContext(state => {
    if (!hasInterface || !activeProjectId || !interfaceId) return null;
    return state.projectsById[activeProjectId].interfaces[interfaceId].activeTabId || null;
  });
  const tabIds = useStoreContext(state => {
    if (!hasInterface || !activeProjectId || !interfaceId) return [];
    return state.projectsById[activeProjectId].interfaces[interfaceId].tabIds;
  });
  const tabs = useStoreContext((
    useShallow((state) => {
    if (!hasInterface || !activeProjectId || !interfaceId) return null;
    return state.projectsById[activeProjectId].interfaces[interfaceId].tabs || null;
  })));
  const tableArguments = useStoreContext((
    useShallow((state) => {
    if (!hasInterface || !activeProjectId || !interfaceId) return null;
    return state.projectsById[activeProjectId].interfaces[interfaceId].tableArguments || null;
  })));

  // Get store actions
  const storeInitInterface = useStoreContext(state => state.initInterface);
  const storeUpdateInterface = useStoreContext(state => state.updateInterface);
  const storeRemoveInterface = useStoreContext(state => state.removeInterface);
  const storeInitTab = useStoreContext(state => state.initTab);
  const storeRemoveTab = useStoreContext(state => state.removeTab);
  const storeUpdateTab = useStoreContext(state => state.updateTab);
  const storeSetActiveTab = useStoreContext(state => state.setActiveTab);

  // Memoize all actions to prevent unnecessary re-renders
  const actions = useMemo<InterfaceActions>(() => ({
    // Basic interface management
    initInterface: (initialState) => {
      if (activeProjectId && interfaceId) {
        storeInitInterface(activeProjectId, interfaceId, initialState);
      }
    },
    
    updateInterface: (updates) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(activeProjectId, interfaceId, updates);
      }
    },
    
    removeInterface: () => {
      if (activeProjectId && interfaceId) {
        storeRemoveInterface(activeProjectId, interfaceId);
      }
    },
    
    // Property setters
    setName: (name) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(activeProjectId, interfaceId, { name });
      }
    },

    // New method to set tabs
    setTabIds: (tabIds: string[]) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(activeProjectId, interfaceId, { tabIds });
      }
    },

    // Helper methods
    getTabIds: () => tabIds,

  }), [
    interfaceId,
    activeProjectId,
    activeTabId,
    tabIds,
    tableArguments,
    storeInitInterface, 
    storeUpdateInterface, 
    storeRemoveInterface,
    storeInitTab,
    storeRemoveTab,
    storeUpdateTab,
    storeSetActiveTab,
  ]);
  
  // We build a final 'interface' object from the narrower fields
  // so the calling component has a shape similar to before, if needed.
  const finalInterface = useMemo(() => {
    if (!hasInterface) return null;
    return { name, tabs, activeTabId, tabIds, tableArguments } as Interface;
  }, [hasInterface, name, tabs, activeTabId, tabIds, tableArguments]);

  // Use interfaceId to conditionally return values, but only after all hooks are called
  if (interfaceId === null) {
    return DEFAULT_USE_INTERFACE_RETURN;
  }

  return {
    interface: finalInterface,
    actions,
    exists: hasInterface,
  };
}