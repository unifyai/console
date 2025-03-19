import { useMemo } from 'react';
import { useStoreContext } from '../providers/StoreProvider';
import { Interface, InterfaceMeta, InterfaceData, InterfaceUI } from '../slices/selectors/interface';
import { Tab } from '../slices/selectors/tab';
import { useShallow } from 'zustand/react/shallow';
import { TableArguments } from '@/types/evals/logs';

// Define stable fallback references
const EMPTY_TAB_NAMES: string[] = [];
const EMPTY_TAB_IDS: string[] = [];
const EMPTY_TABLE_ARGUMENTS = {};
const DEFAULT_USE_INTERFACE_RETURN = {
  interface: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  actions: null,
  exists: false
};

/**
 * Interface for interface-related meta actions
 */
export interface InterfaceMetaActions {
  setName: (name: string) => void;
}

/**
 * Interface for interface-related data actions
 */
export interface InterfaceDataActions {
  // Interface management

  // Tab management
  addTab: (tabName: string, newName: string, initialState?: Partial<Tab>) => void;
  removeTab: (tabName: string) => void;
  renameTab: (tabName: string, newName: string) => void;
  getTabNames: () => string[];
  setTabNames: (tabNames: string[]) => void;
  getTabIds: () => string[];
  setTabIds: (tabIds: string[]) => void;

  // Table arguments
  setTableArguments: (tableArguments: TableArguments) => void;
}

/**
 * Interface for interface-related UI actions
 */
export interface InterfaceUIActions {
  setActiveTabId: (tabName: string | null) => void;
}

/**
 * Interface for all interface-related actions
 */
export interface InterfaceActions {
  // Basic interface management
  initInterface: (initialState?: Partial<Interface>) => void;
  updateInterface: (updates: Partial<Interface>) => void;
  removeInterface: () => void;
  
  // Categorized actions
  meta: InterfaceMetaActions;
  data: InterfaceDataActions;
  ui: InterfaceUIActions;
}

/**
 * Custom hook to access interface state and actions
 * @param interfaceName The name of the interface to access
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing interface state, actions, and existence flag
 */
export function useInterface(interfaceName: string | null, projectName?: string | null) {
  // Call all hooks unconditionally at the top level

  // Get active project ID if not provided
  const activeProjectId = useStoreContext(state => 
    projectName ? projectName : state.activeProjectId
  );

  // Construct hierarchical ID if needed
  const interfaceId = useMemo(() => {
    if (!interfaceName) return null;
    
    // Check if the interfaceId already has the hierarchical format
    if (interfaceName.includes('>')) {
      return interfaceName;
    }
    
    // Otherwise, construct it
    return activeProjectId ? `${activeProjectId}>${interfaceName}` : interfaceName;
  }, [interfaceName, activeProjectId]);

  // Check if the interface exists
  const interfaceExists = useStoreContext(state => {
    if (!interfaceId || !activeProjectId) return false;
    return !!state.interfacesById[interfaceId];
  });

  // Granular subscriptions to Meta properties
  const id = interfaceId;
  
  const name = useStoreContext(state => {
    if (!interfaceExists || !interfaceId) return null;
    return state.interfacesById[interfaceId].name;
  });

  // Granular subscriptions to Data properties
  const tabNames = useStoreContext(state => {
    if (!interfaceExists || !interfaceId) return EMPTY_TAB_NAMES;
    return state.interfacesById[interfaceId].tabNames;
  });

  const tabIds = useStoreContext(
    useShallow(state => {
      if (!interfaceExists || !interfaceId) return EMPTY_TAB_IDS;
      return state.interfacesById[interfaceId].tabIds;
    })
  );
  
  const tableArguments = useStoreContext(
    useShallow(state => {
      if (!interfaceExists || !interfaceId) return EMPTY_TABLE_ARGUMENTS;
      return state.interfacesById[interfaceId].tableArguments || EMPTY_TABLE_ARGUMENTS;
    })
  );

  // Granular subscriptions to UI properties
  const projectIdFromState = useStoreContext(state => {
    if (!interfaceExists || !interfaceId) return null;
    return state.interfacesById[interfaceId].projectId;
  });
  
  const activeTabId = useStoreContext(state => {
    if (!interfaceExists || !interfaceId) return null;
    return state.interfacesById[interfaceId].activeTabId;
  });

  // Get store actions
  const storeInitInterface = useStoreContext(state => state.initInterface);
  const storeUpdateInterface = useStoreContext(state => state.updateInterface);
  const storeRemoveInterface = useStoreContext(state => state.removeInterface);
  const storeInitTab = useStoreContext(state => state.initTab);
  const storeAddTab = useStoreContext(state => state.addTab);
  const storeRemoveTab = useStoreContext(state => state.removeTab);
  const storeRenameTab = useStoreContext(state => state.renameTab);
  const storeRenameTile = useStoreContext(state => state.renameTile);
  const storeSetActiveTab = useStoreContext(state => state.setActiveTab);

  // Memoize the metadata object to prevent unnecessary rerenders
  const meta = useMemo<Partial<InterfaceMeta> | null>(() => {
    if (!interfaceExists) return null;
    
    return {
      id: id!,
      name: name!,
      tabNames: tabNames
    };
  }, [interfaceExists, id, name, tabNames]);
  
  // Memoize the data object to prevent unnecessary rerenders
  const data = useMemo<Partial<InterfaceData> | null>(() => {
    if (!interfaceExists) return null;
    
    return {
      tabNames: tabNames,
      tabIds,
      tableArguments
    };
  }, [interfaceExists, tabIds, tableArguments, tabNames]);
  
  // Memoize the UI state object to prevent unnecessary rerenders
  const ui = useMemo<Partial<InterfaceUI> | null>(() => {
    if (!interfaceExists) return null;
    
    return {
      projectId: projectIdFromState,
      activeTabId
    };
  }, [interfaceExists, projectIdFromState, activeTabId]);

  // Memoize the meta actions to prevent unnecessary re-renders
  const metaActions = useMemo<InterfaceMetaActions>(() => ({
    setName: (name) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(interfaceId, { name });
      }
    }
  }), [activeProjectId, interfaceId, storeUpdateInterface]);

  // Memoize the data actions to prevent unnecessary re-renders
  const dataActions = useMemo<InterfaceDataActions>(() => ({

    addTab: (tabName, newName, initialState = {}) => {
      if (activeProjectId && interfaceId) {
        // Check if the tabIds are already hierarchical
        const sourceTabId = tabName.includes('>')
          ? tabName
          : `${interfaceId}>${tabName}`;
        
        const newTabId = newName.includes('>')
          ? newName
          : `${interfaceId}>${newName}`;

        // Add the new tab to the interface
        storeAddTab(
          interfaceId,
          sourceTabId,
          newTabId,
          {
            id: newTabId,
            name: newName,
            projectId: activeProjectId,
            interfaceId: interfaceId,
            ...initialState
          }
        );
      }
    },

    removeTab: (tabName) => {
      if (activeProjectId && interfaceId) {
        // Check if the tab ID is already hierarchical
        const hierarchicalTabId = tabName.includes('>')
          ? tabName
          : `${interfaceId}>${tabName}`;
        
        // Remove the tab
        storeRemoveTab(interfaceId, hierarchicalTabId);
      }
    },

    renameTab: (tabName, newName) => {
      if (activeProjectId && interfaceId) {
        // Check if the tabIds are already hierarchical
        const sourceTabId = tabName.includes('>')
          ? tabName
          : `${interfaceId}>${tabName}`;
        
        const newTabId = newName.includes('>')
          ? newName
          : `${interfaceId}>${newName}`;

        // Rename the tab to the interface
        storeRenameTab(
          interfaceId,
          sourceTabId,
          newTabId,
          {
            id: newTabId,
            name: newName,
            projectId: activeProjectId,
            interfaceId: interfaceId,
          }
        );
      }
    },

    getTabNames: () => tabNames,

    setTabNames: (tabNames) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(interfaceId, { tabNames: tabNames });
      }
    },

    getTabIds: () => tabIds,

    setTabIds: (tabIds) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(interfaceId, { tabIds: tabIds });
      }
    },
    
    setTableArguments: (tableArguments) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(interfaceId, { tableArguments });
      }
    }
  }), [
    activeProjectId, 
    interfaceId, 
    tabIds,
    storeInitTab,
    storeAddTab,
    storeRemoveTab, 
    storeRenameTab,
    storeRenameTile,
    storeUpdateInterface,
  ]);

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
  
  // Memoize all actions to prevent unnecessary re-renders
  const actions = useMemo<InterfaceActions>(() => {
    return {
      // Basic interface management
      initInterface: (initialState) => {
        if (activeProjectId && interfaceId) {
          storeInitInterface(activeProjectId, interfaceId, initialState);
        }
      },
      
      updateInterface: (updates) => {
        if (activeProjectId && interfaceId) {
          storeUpdateInterface(interfaceId, updates);
        }
      },
      
      removeInterface: () => {
        if (activeProjectId && interfaceId) {
          storeRemoveInterface(activeProjectId, interfaceId);
        }
      },
      
      // Categorized actions
      meta: metaActions,
      data: dataActions,
      ui: uiActions,
    };
  }, [
    activeProjectId,
    interfaceId,
    tabIds,
    storeInitInterface,
    storeUpdateInterface,
    storeRemoveInterface,
    metaActions,
    dataActions,
    uiActions
  ]);
  
  // Build a final 'interface' object from the separate meta, data, and UI objects
  const interfaceObj = useMemo<Partial<Interface> | null>(() => {
    if (!meta || !data || !ui) return null;
    
    return {
      ...meta,
      ...data,
      ...ui
    };
  }, [meta, data, ui]);

  // Use interfaceId to conditionally return values, but only after all hooks are called
  if (interfaceId === null) {
    return DEFAULT_USE_INTERFACE_RETURN;
  }

  return {
    interface: interfaceObj,
    meta,
    data,
    ui,
    metaActions,
    dataActions,
    uiActions,
    actions,
    exists: interfaceExists
  };
}