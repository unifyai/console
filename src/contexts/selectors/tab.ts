import { IStoreState } from '../store';

/**
 * Select all tabs from the store
 */
export const selectAllTabs = (state: IStoreState) => {
  return Object.values(state.tabsById || {});
};

/**
 * Select a tab by its ID
 */
export const selectTabById = (state: IStoreState, id: string) => {
  if (!id) return null;
  return state.tabsById?.[id] || null;
};

/**
 * Select a tab by its name within an interface
 */
export const selectTabByName = (state: IStoreState, interfaceId: string, name: string) => {
  if (!interfaceId || !name) return null;
  
  const interfaceObj = state.interfacesById?.[interfaceId];
  if (!interfaceObj?.tabIds) return null;
  
  // Find tab by name in this interface
  for (const tabId of interfaceObj.tabIds) {
    const tab = state.tabsById?.[tabId];
    if (tab?.name === name) {
      return tab;
    }
  }
  
  return null;
};

/**
 * Select all tabs for a specific interface
 */
export const selectTabsForInterface = (state: IStoreState, interfaceId: string) => {
  if (!interfaceId) return [];
  
  const interfaceObj = state.interfacesById?.[interfaceId];
  if (!interfaceObj?.tabIds) return [];
  
  return interfaceObj.tabIds
    .map(tabId => state.tabsById?.[tabId])
    .filter(Boolean);
};

/**
 * Select total number of tabs for an interface
 */
export const selectTotalTabsForInterface = (state: IStoreState, interfaceId: string) => {
  if (!interfaceId) return 0;
  
  return selectTabsForInterface(state, interfaceId).length;
};

/**
 * Select total number of inactive tabs for an interface
 */
export const selectTotalInactiveTabsForInterface = (state: IStoreState, interfaceId: string) => {
  if (!interfaceId) return 0;
  
  const activeTab = selectActiveTab(state, interfaceId);
  if (!activeTab) return 0;

  return selectTabsForInterface(state, interfaceId).filter(tab => tab.name !== activeTab.name).length;
};

/**
 * Get tab ID from either ID or name
 */
export const getTabId = (state: IStoreState, interfaceId: string, tabIdOrName: string): string | null => {
  if (!interfaceId || !tabIdOrName) return null;
  
  // First check if it's already a valid tab ID
  const directTab = state.tabsById?.[tabIdOrName];
  if (directTab) return tabIdOrName;
  
  // Otherwise, search by name
  const tabByName = selectTabByName(state, interfaceId, tabIdOrName);
  return tabByName?.id || null;
};

/**
 * Get tab name from either ID or name
 */
export const getTabName = (state: IStoreState, interfaceId: string, tabIdOrName: string): string | null => {
  if (!interfaceId || !tabIdOrName) return null;
  
  // First check if it's a tab ID
  const directTab = state.tabsById?.[tabIdOrName];
  if (directTab) return directTab.name || null;
  
  // Otherwise, assume it's already a name and verify it exists
  const tabByName = selectTabByName(state, interfaceId, tabIdOrName);
  return tabByName?.name || null;
};

/**
 * Get the active tab for an interface
 */
export const selectActiveTab = (state: IStoreState, interfaceId: string) => {
  if (!interfaceId) return null;
  
  const interfaceObj = state.interfacesById?.[interfaceId];
  if (!interfaceObj?.activeTabId) return null;
  
  return state.tabsById?.[interfaceObj.activeTabId] || null;
};

/**
 * Get tab names for an interface
 */
export const selectTabNamesForInterface = (state: IStoreState, interfaceId: string): string[] => {
  return selectTabsForInterface(state, interfaceId)
    .map(tab => tab.name)
    .filter(Boolean) as string[];
}; 