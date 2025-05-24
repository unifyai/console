import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { TabMeta } from '../../slices/selectors/tab';

/**
 * Interface for tab meta-related actions
 */
export interface TabMetaActions {
  setName: (name: string) => void;
  setVisible: (visible: boolean) => void;
  setActive: (active: boolean) => void;
  setOrder: (order: number) => void;
}

/**
 * Custom hook to access tab meta state and actions
 * @param tabIdOrName The ID or name of the tab to access
 * @param interfaceIdOrName Optional interface ID or name (if not provided, active interface will be used)
 * @returns Object containing tab meta state and actions
 */
export function useTabMeta(
  tabIdOrName: string | null, 
  interfaceIdOrName?: string | null,
) {
  
  const activeInterfaceId = useStoreContext(state => 
    interfaceIdOrName ? interfaceIdOrName : state.activeInterfaceId
  );

  // First attempt: Look for the tab directly by ID
  const tabInStoreById = useStoreContext(state => {
    if (!tabIdOrName) return null;
    return state.tabsById[tabIdOrName] || null;
  });

  // Second attempt: Find the tab by interface + name combination
  const tabInStoreByName = useStoreContext(state => {
    if (!tabIdOrName || !activeInterfaceId || tabInStoreById) return null;
    
    // Find tab with matching name and interface ID
    return Object.values(state.tabsById).find(
      tab => tab.name === tabIdOrName && tab.interfaceId === activeInterfaceId
    ) || null;
  });

  // Determine the tab ID based on lookup results
  const tabId = useMemo(() => {
    if (!tabIdOrName) return null;
    if (tabInStoreById) return tabIdOrName;
    return tabInStoreByName?.id || null;
  }, [tabIdOrName, tabInStoreById, tabInStoreByName]);
  
  // Check if tab exists
  const tabExists = !!tabId && !!(tabInStoreById || tabInStoreByName);

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
    };
  }, [
    tabExists, 
    id, 
    name, 
    visible, 
    active, 
    order, 
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
    }
  }), [tabId, storeUpdateTab]);

  return {
    meta,
    metaActions,
    // Also export these for use in other hooks
    tabId,
    activeInterfaceId,
    tabExists
  };
} 