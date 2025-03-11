import { TableArguments } from "@/types/evals/logs";
import { Tab } from "./tab";

// Interface state definition
export interface Interface {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  activeTabId: string | null;
  tabIds: string[];  // This is now the single source of truth for displaying the tab names on the UI
  tabs: Record<string, Tab>; // This is now the single source of truth for the actual tab data indexed by ID

  tableArguments: TableArguments;
}

/**
 * Initialize a new interface
 */
export function initInterface(interfaceId: string, initialState: Partial<Interface> = {}): Interface {
  return {
    id: interfaceId,
    name: initialState.name || "New Interface",
    createdAt: initialState.createdAt || new Date().toISOString(),
    updatedAt: initialState.updatedAt || new Date().toISOString(),
    activeTabId: initialState.activeTabId || null,
    tabIds: initialState.tabIds || [],
    tabs: initialState.tabs || {},
    tableArguments: initialState.tableArguments || {},
  };
}

/**
 * Update an existing interface
 */
export function updateInterface(iface: Interface, updates: Partial<Interface>): Interface {
  return {
    ...iface,
    ...updates,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Set a specific property on an interface
 */
export function setInterfaceProperty<K extends keyof Interface>(
  iface: Interface, 
  property: K, 
  value: Interface[K]
): Interface {
  return {
    ...iface,
    [property]: value,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Add a tab to an interface
 */
export function addTab(iface: Interface, tabId: string): Interface {
  if (!iface.tabs) {
    iface.tabs = {};
  }
  return iface;
}

/**
 * Remove a tab from an interface
 */
export function removeTab(iface: Interface, tabId: string): Interface {
  if (iface.tabs && iface.tabs[tabId]) {
    const newTabs = { ...iface.tabs };
    delete newTabs[tabId];
    
    return {
      ...iface,
      tabs: newTabs,
      activeTabId: iface.activeTabId === tabId ? null : iface.activeTabId,
      updatedAt: new Date().toISOString()
    };
  }
  return iface;
}
