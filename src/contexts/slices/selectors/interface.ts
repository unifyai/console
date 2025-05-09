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
  tabIds: string[];  // References to tabs instead of containing them directly
}

// Interface UI state - UI-related state
export interface InterfaceUI {
  projectId: string | null;
  activeTabId: string | null;
}

// Combined Interface state definition
export interface Interface extends InterfaceMeta, InterfaceData, InterfaceUI {}

/**
 * Initialize a new interface
 */
export function initInterface(interfaceId: string, initialState: Partial<Interface> = {}): Interface {
  return {
    // Meta
    id: interfaceId,
    name: initialState.name || "New Interface",
    // createdAt: initialState.createdAt || new Date().toISOString(),
    // updatedAt: initialState.updatedAt || new Date().toISOString(),
    
    // Data
    tabNames: initialState.tabNames || [],
    tabIds: initialState.tabIds || [],
    
    // UI
    projectId: initialState.projectId || null,
    activeTabId: initialState.activeTabId || null,
    
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
 * Add a tab to an interface
 */
export function addTabId(iface: Interface, tabId: string): Interface {
  // If the tab already exists in the interface, don't add it again
  if (iface.tabIds.includes(tabId)) {
    return iface;
  }
  
  // Return the updated interface
  return {
    ...iface,
    tabIds: [...iface.tabIds, tabId],
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Remove a tab from an interface
 */
export function removeTabId(iface: Interface, tabId: string): Interface {
  // Filter out the tab ID to remove
  const tabIds = iface.tabIds.filter(id => id !== tabId);
  
  // Update the active tab if needed
  let activeTabId = iface.activeTabId;
  if (iface.activeTabId === tabId) {
    activeTabId = tabIds.length > 0 ? tabIds[0] : null;
  }
  
  // Return the updated interface
  return {
    ...iface,
    tabIds,
    activeTabId,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Add a tab to an interface
 */
export function addTabName(iface: Interface, tabName: string): Interface {
  // If the tab already exists in the interface, don't add it again
  if (iface.tabNames.includes(tabName)) {
    return iface;
  }

  // Return the updated interface
  return {
    ...iface,
    tabNames: [...iface.tabNames, tabName],
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Remove a tab from an interface
 */
export function removeTabName(iface: Interface, tabName: string): Interface {
  // Filter out the tab ID to remove
  const tabNames = iface.tabNames.filter(name => name !== tabName);
  
  // Update the active tab if needed
  let activeTabId = iface.activeTabId;
  if (iface.activeTabId === tabName) {
    activeTabId = tabNames.length > 0 ? tabNames[0] : null;
  }
  
  // Return the updated interface
  return {
    ...iface,
    tabNames,
    activeTabId,
    // updatedAt: new Date().toISOString()
  };
}
