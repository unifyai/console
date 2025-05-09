import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { Tab } from '../../slices/selectors/tab';
import { useTabMeta, TabMetaActions } from './useTabMeta';
import { useTabData, TabDataActions } from './useTabData';
import { useTabUI, TabUIActions } from './useTabUI';

/**
 * Default return value when no tab is specified
 */
export const DEFAULT_USE_TAB_RETURN = {
  tab: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  actions: null,
  exists: false,
  operations: {},
  tabId: null
};

/**
 * Interface for all tab-related actions
 */
export interface TabActions {
  // Basic tab management
  initTab: (initialState?: Partial<Tab>) => void;
  updateTab: (updates: Partial<Tab>) => void;
  removeTab: () => void;
  
  // Categorized actions
  meta: TabMetaActions;
  data: TabDataActions;
  ui: TabUIActions;
}

/**
 * Custom hook to access all tab state and actions
 * @param tabIdOrName The ID or name of the tab to access
 * @param interfaceIdOrName The ID or name of the interface containing the tab
 * @returns Object containing all tab state, actions, and existence flag
 */
export function useTab(
  tabIdOrName: string | null,
  interfaceIdOrName?: string | null
) {
  // Use specialized hooks
  const {
    meta,
    metaActions,
    tabId,
    tabExists,
    activeInterfaceId
  } = useTabMeta(tabIdOrName, interfaceIdOrName);
  
  const {
    data,
    dataActions
  } = useTabData(tabIdOrName, interfaceIdOrName);
  
  const {
    ui,
    uiActions
  } = useTabUI(tabIdOrName, interfaceIdOrName);
  
  // Get store actions for core tab management
  const storeInitTab = useStoreContext(state => state.initTab);
  const storeUpdateTab = useStoreContext(state => state.updateTab);
  const storeRemoveTab = useStoreContext(state => state.removeTab);

  // Memoize all actions to prevent unnecessary re-renders
  const actions = useMemo<TabActions>(() => {
    return {
      // Basic tab management
      initTab: (initialState) => {
        if (activeInterfaceId && tabId) {
          storeInitTab(activeInterfaceId, tabId, {
            id: tabId,
            interfaceId: activeInterfaceId,
            ...initialState
          });
        }
      },
      
      updateTab: (updates) => {
        if (tabId) {
          storeUpdateTab(tabId, updates);
        }
      },
      
      removeTab: () => {
        if (tabId && activeInterfaceId) {
          storeRemoveTab(activeInterfaceId, tabId);
        }
      },
      
      // Categorized actions
      meta: metaActions,
      data: dataActions,
      ui: uiActions
    };
  }, [
    tabId,
    activeInterfaceId,
    metaActions,
    dataActions,
    uiActions,
    storeInitTab,
    storeUpdateTab,
    storeRemoveTab
  ]);
  
  // Build a final 'tab' object from the separate meta, data, and UI objects
  const tab = useMemo<Partial<Tab> | null>(() => {
    if (!meta || !data || !ui) return null;
    
    return {
      ...meta,
      ...data,
      ...ui
    };
  }, [meta, data, ui]);

  // Use tabId to conditionally return values, but only after all hooks are called
  if (!tabIdOrName) {
    return DEFAULT_USE_TAB_RETURN;
  }

  return {
    tab,
    meta,
    data,
    ui,
    metaActions,
    dataActions,
    uiActions,
    actions,
    exists: tabExists,
    tabId
  };
} 