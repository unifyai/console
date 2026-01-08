import {
  Interface,
  InterfaceMeta,
  InterfaceData as InterfaceSliceData,
  InterfaceUI,
} from '@/contexts/slices/selectors/interface';
import { InterfaceData } from '@/types/interfaces/grid';

/**
 * Build interface state from API-returned interface data
 * This no longer depends on buildTabState
 */
export function buildInterfaceState(
  interfaceData: InterfaceData,
  activeTabId?: string,
  tabIds?: string[],
  tabNames?: string[]
): Interface {
  if (!interfaceData || !interfaceData.id) {
    throw new Error('Invalid interface data provided');
  }

  // Create interface meta
  const interfaceMeta: InterfaceMeta = {
    id: interfaceData.id,
    name: interfaceData.name,
    // We no longer need to generate timestamps as they come from the API
  };

  // Create interface data - initially empty tab collections
  // These will be populated as tabs are added to the store
  const interfaceSliceData: InterfaceSliceData = {
    tabIds: tabIds || [],
    tabNames: tabNames || [],
  };

  // Create interface UI
  const interfaceUI: InterfaceUI = {
    projectId: interfaceData.projectId || null,
    activeTabId: activeTabId || interfaceData.activeTabId || null,
  };

  return {
    ...interfaceMeta,
    ...interfaceSliceData,
    ...interfaceUI,
  };
}

/**
 * Add a tab to an interface state
 */
export function addTabToInterface(
  interfaceState: Interface,
  tabId: string,
  tabName: string
): Interface {
  // Don't duplicate tab IDs
  if (interfaceState.tabIds.includes(tabId)) {
    return interfaceState;
  }

  return {
    ...interfaceState,
    tabIds: [...interfaceState.tabIds, tabId],
    tabNames: [...interfaceState.tabNames, tabName],
  };
}
