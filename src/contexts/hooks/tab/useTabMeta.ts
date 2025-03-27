import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { TabMeta } from '../../slices/selectors/tab';
import { constructHierarchicalId } from '../../utils/sliceUtils';

/**
 * Interface for tab meta-related actions
 */
export interface TabMetaActions {
  setName: (name: string) => void;
  setVisible: (visible: boolean) => void;
  setActive: (active: boolean) => void;
  setOrder: (order: number) => void;
  setTabCreated: (tabCreated: boolean) => void;
  setTempTabCreated: (tempTabCreated: boolean) => void;
}

/**
 * Custom hook to access tab meta state and actions
 * @param tabName The name of the tab to access
 * @param interfaceName Optional interface name (if not provided, active interface will be used)
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing tab meta state and actions
 */
export function useTabMeta(
  tabName: string | null, 
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Get active project ID and interface ID if not provided
  const activeProjectId = useStoreContext(state => 
    projectName ? projectName : state.activeProjectId
  );
  
  const interfaceId = useStoreContext(state => 
    interfaceName ? interfaceName : state.activeInterfaceId
  );

  // Construct hierarchical interface ID if needed
  const activeInterfaceId = useMemo(() => {
    if (!interfaceId || !activeProjectId) return null;
    return interfaceId.includes('>') ? interfaceId : constructHierarchicalId(interfaceId, [activeProjectId]);
  }, [interfaceId, activeProjectId]);

  // Construct hierarchical tab ID if needed
  const tabId = useMemo(() => {
    if (!tabName || !activeInterfaceId) return null;
    
    // Check if the tabId already has the hierarchical format
    if (tabName.includes('>')) {
      return tabName;
    }
    
    // Otherwise, construct it
    return constructHierarchicalId(tabName, [activeInterfaceId]);
  }, [tabName, activeInterfaceId]);
  
  // Check if tab exists
  const tabExists = useStoreContext(state => {
    if (!tabId) return false;
    return !!state.tabsById[tabId];
  });

  // Access to meta properties
  const id = tabId;
  
  const name = useStoreContext(state => {
    if (!tabExists || !tabId) return '';
    return state.tabsById[tabId].name;
  });
  
  const visible = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].visible;
  });
  
  const active = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].active;
  });
  
  const order = useStoreContext(state => {
    if (!tabExists || !tabId) return 0;
    return state.tabsById[tabId].order;
  });
  
  const tabCreated = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].tabCreated;
  });
  
  const tempTabCreated = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].tempTabCreated;
  });

  // Get the store actions needed for meta
  const storeUpdateTab = useStoreContext(state => state.updateTab);

  // Memoize the meta state object
  const meta = useMemo<Partial<TabMeta> | null>(() => {
    if (!tabExists) return null;
    
    return {
      id: id!,
      name: name || null,
      visible,
      active,
      order,
      tabCreated,
      tempTabCreated
    };
  }, [
    tabExists, 
    id, 
    name, 
    visible, 
    active, 
    order, 
    tabCreated, 
    tempTabCreated
  ]);

  // Memoize the meta actions
  const metaActions = useMemo<TabMetaActions>(() => ({
    setName: (name) => {
      if (tabId) {
        storeUpdateTab(tabId, { name });
      }
    },
    
    setVisible: (visible) => {
      if (tabId) {
        storeUpdateTab(tabId, { visible });
      }
    },
    
    setActive: (active) => {
      if (tabId) {
        storeUpdateTab(tabId, { active });
      }
    },
    
    setOrder: (order) => {
      if (tabId) {
        storeUpdateTab(tabId, { order });
      }
    },
    
    setTabCreated: (tabCreated) => {
      if (tabId) {
        storeUpdateTab(tabId, { tabCreated });
      }
    },
    
    setTempTabCreated: (tempTabCreated) => {
      if (tabId) {
        storeUpdateTab(tabId, { tempTabCreated });
      }
    }
  }), [tabId, storeUpdateTab]);

  return {
    meta,
    metaActions,
    // Also export these for use in other hooks
    tabId,
    activeProjectId,
    activeInterfaceId,
    tabExists
  };
} 