// Interface metadata - core identifying information
export interface InterfaceMeta {
  id: string;
  name: string;
  // createdAt: string;
  // updatedAt: string;
}

// Interface data - business data and relationships
export interface InterfaceData {
  tabNames: string[];
  tabIds: string[]; // References to tabs instead of containing them directly
}

// Interface UI state - UI-related state
export interface InterfaceUI {
  projectId: string | null;
  activeTabId: string | null;
  pending?: boolean; // Pending state for async operations
}

// Combined Interface state definition
export interface Interface extends InterfaceMeta, InterfaceData, InterfaceUI {}

/**
 * Initialize a new interface
 */
export function initInterface(
  interfaceId: string,
  initialState: Partial<Interface> = {}
): Interface {
  return {
    // Meta
    id: interfaceId,
    name: initialState.name || 'New Interface',
    // createdAt: initialState.createdAt || new Date().toISOString(),
    // updatedAt: initialState.updatedAt || new Date().toISOString(),

    // Data
    tabNames: initialState.tabNames || [],
    tabIds: initialState.tabIds || [],

    // UI
    projectId: initialState.projectId || null,
    activeTabId: initialState.activeTabId || null,
    pending: initialState.pending || false,

    ...initialState,
  };
}

/**
 * Update an existing interface
 */
export function updateInterface(iface: Interface, updates: Partial<Interface>): Interface {
  return {
    ...iface,
    ...updates,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Set a specific property of an interface
 */
export function setInterfaceProperty<K extends keyof Interface>(
  iface: Interface,
  property: K,
  value: Interface[K]
): Interface {
  return {
    ...iface,
    [property]: value,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Add a tab to an interface with both ID and name
 */
export function addTab(iface: Interface, tabId: string, tabName: string): Interface {
  // Check if either the tab ID or name already exists
  if (iface.tabIds.includes(tabId) || iface.tabNames.includes(tabName)) {
    return iface;
  }

  // Return the updated interface with both ID and name added
  return {
    ...iface,
    tabIds: [...iface.tabIds, tabId],
    tabNames: [...iface.tabNames, tabName],
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Remove a tab from an interface
 */
export function removeTab(iface: Interface, tabId: string, tabName: string): Interface {
  // Filter out the tab ID and name to remove
  const tabIds = iface.tabIds.filter((id) => id !== tabId);
  const tabNames = iface.tabNames.filter((name) => name !== tabName);

  // Update the active tab if needed
  let activeTabId = iface.activeTabId;
  if (iface.activeTabId === tabId) {
    // Set to last available tab ID if any remain, otherwise null
    activeTabId = tabIds.length > 0 ? tabIds[tabIds.length - 1] : null;
  }

  // Return the updated interface
  return {
    ...iface,
    tabIds,
    tabNames,
    activeTabId,
    // updatedAt: new Date().toISOString()
  };
}
