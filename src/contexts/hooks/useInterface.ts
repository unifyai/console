import { useMemo } from 'react';
import { useStoreContext } from '../providers/StoreProvider';
import { Interface } from '../slices/selectors/interface';
import { Tab } from '../slices/selectors/tab';

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
  initTab: (tabId: string, initialState?: any) => void;
  removeTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: any) => void;
  setActiveTab: (tabId: string | null) => void;
  setTabs: (tabs: string[] | Tab[] | {}) => void;
  
  // Helper methods
  getTabs: () => any[];
  getTabIds: () => string[];
  getTab: (tabId: string) => any;
  getActiveTabId: () => string | null;
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
  const tabs = useStoreContext(state => {
    if (!hasInterface || !activeProjectId || !interfaceId) return null;
    return state.projectsById[activeProjectId].interfaces[interfaceId].tabs || null;
  });

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
    
    // Tab management
    initTab: (tabId, initialState) => {
      if (activeProjectId && interfaceId) {
        storeInitTab(activeProjectId, interfaceId, tabId, initialState);
      }
    },
    
    removeTab: (tabId) => {
      if (activeProjectId && interfaceId) {
        storeRemoveTab(activeProjectId, interfaceId, tabId);
      }
    },
    
    updateTab: (tabId, updates) => {
      if (activeProjectId && interfaceId) {
        storeUpdateTab(activeProjectId, interfaceId, tabId, updates);
      }
    },

    setActiveTab: (tabId) => {
      if (activeProjectId && interfaceId) {
        storeSetActiveTab(activeProjectId, interfaceId, tabId);
      }
    },

    // New method to set tabs
    setTabs: (tabsInput) => {
      if (activeProjectId && interfaceId) {
        // Case 1: Empty object - clear all tabs
        if (Array.isArray(tabsInput) && tabsInput.length === 0) {
          storeUpdateInterface(activeProjectId, interfaceId, { tabs: {} });
          return;
        }

        // Case 2: Array of strings (tab IDs) - clone current active tab with new IDs
        if (Array.isArray(tabsInput) && typeof tabsInput[0] === 'string') {
          const tabIds = tabsInput as string[];
          const newTabs: Record<string, Tab> = {};

          // If there's an active tab, use it as a template
          if (activeTabId && tabs && tabs[activeTabId]) {
            const activeTab = tabs[activeTabId];
            
            // Create a new tab for each ID based on the active tab
            tabIds.forEach(tabId => {
              // Clone the active tab but with a new ID
              const newTab = {
                ...activeTab,
                id: tabId,
                name: `Tab ${tabId}`, // Optionally give it a different name
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              newTabs[tabId] = newTab;
            });
          }
          
          storeUpdateInterface(activeProjectId, interfaceId, { tabs: newTabs });
          return;
        }
        
        // Case 3: Array of Tab objects - directly use them
        if (Array.isArray(tabsInput) && typeof tabsInput[0] === 'object') {
          const tabObjects = tabsInput as Tab[];
          const newTabs: Record<string, Tab> = {};
          
          // Map each tab object by its ID
          tabObjects.forEach(tab => {
            if (tab.id) {
              newTabs[tab.id] = tab;
            }
          });
          
          storeUpdateInterface(activeProjectId, interfaceId, { tabs: newTabs });
          return;
        }
        
        // Case 4: Record of tab IDs to Tab objects - directly use it
        if (typeof tabsInput === 'object' && !Array.isArray(tabsInput)) {
          storeUpdateInterface(activeProjectId, interfaceId, { tabs: tabsInput as Record<string, Tab> });
          return;
        }
      }
    },

    // Helper methods
    getTabs: () => {
      if (!tabs) return [];
      return Object.values(tabs);
    },
    
    getTabIds: () => {
      if (!tabs) return [];
      return Object.keys(tabs);
    },

    getTab: (tabId) => {
      if (!tabs) return null;
      return tabs[tabId] || null;
    },

    getActiveTabId: () => {
      if (!activeTabId) return null;
      return activeTabId;
    },
  }), [
    interfaceId,
    activeProjectId,
    hasInterface,
    name,
    tabs,
    activeTabId,
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
  const finalInterface = hasInterface
    ? {
        name,
        tabs,
        activeTabId
    } as Interface : null;

  // Use interfaceId to conditionally return values, but only after all hooks are called
  if (interfaceId === null) {
    return { interface: null, actions: null, exists: false };
  }

  return {
    interface: finalInterface,
    actions,
    exists: hasInterface,
  };
}