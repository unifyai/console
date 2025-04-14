import { TabProps } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";

// Tab metadata - core identifying information
export interface TabMeta {
  id: string | null;
  name: string | null;
  // createdAt: string;
  // updatedAt: string;
  visible: boolean;
  active: boolean;
  order: number;
  tabCreated: boolean;
  tempTabCreated: boolean;
}

// Tab data - business data and relationships
export interface TabData {
  globalContext?: string;
  savedTab: TabProps | null; // This needs to match exactly the TabProps type from grid.ts
  tableArguments: TableArguments;
  tileIds: string[]; // References to tiles instead of containing them directly
  itemsNeedRecompute: boolean; // Flag to indicate when items need recomputing
}

// Tab UI state - UI-related state
export interface TabUI {
  projectId: string | null;
  interfaceId: string | null;
  focusedTileNames: [string | undefined, string | undefined];
  saveSuccess?: boolean;
  resetting: boolean;
  edit: boolean;
  interactive: boolean;
  help: boolean;
  copied?: string;
  deleting: boolean;
  refreshing: boolean;
  color?: string
}

// Combined Tab state definition
export interface Tab extends TabMeta, TabData, TabUI {}

/**
 * Initialize a new tab
 */
export function initTab(tabId: string, initialState: Partial<Tab> = {}): Tab {
  return {
    // Meta
    id: tabId,
    name: initialState.name || null,
    visible: initialState.visible !== undefined ? initialState.visible : true,
    active: initialState.active !== undefined ? initialState.active : false,
    order: initialState.order !== undefined ? initialState.order : 0,
    tabCreated: initialState.tabCreated !== undefined ? initialState.tabCreated : false,
    tempTabCreated: initialState.tempTabCreated !== undefined ? initialState.tempTabCreated : false,
    // createdAt: initialState.createdAt || new Date().toISOString(),
    // updatedAt: initialState.updatedAt || new Date().toISOString(),
    
    // Data
    globalContext: initialState.globalContext,
    savedTab: initialState.savedTab !== undefined ? initialState.savedTab : null,
    tableArguments: initialState.tableArguments || {},
    tileIds: initialState.tileIds || [],
    
    // UI
    projectId: initialState.projectId || null,
    interfaceId: initialState.interfaceId || null,
    focusedTileNames: initialState.focusedTileNames !== undefined ? initialState.focusedTileNames : [undefined, undefined],
    saveSuccess: initialState.saveSuccess,
    resetting: initialState.resetting !== undefined ? initialState.resetting : false,
    edit: initialState.edit !== undefined ? initialState.edit : true,
    interactive: initialState.interactive !== undefined ? initialState.interactive : true,
    help: initialState.help !== undefined ? initialState.help : true,
    copied: initialState.copied,
    deleting: initialState.deleting !== undefined ? initialState.deleting : false,
    refreshing: initialState.refreshing !== undefined ? initialState.refreshing : false,
    color: initialState.color,
    itemsNeedRecompute: initialState.itemsNeedRecompute !== undefined ? initialState.itemsNeedRecompute : false,
    
    ...initialState,
  };
}

/**
 * Update an existing tab
 */
export function updateTab(tab: Tab, updates: Partial<Tab>): Tab {
  return {
    ...tab,
    ...updates,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Set a specific property of a tab
 */
export function setTabProperty<K extends keyof Tab>(
  tab: Tab, 
  property: K, 
  value: Tab[K]
): Tab {
  return {
    ...tab,
    [property]: value,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Add a tile to a tab
 */
export function addTileId(tab: Tab, tileId: string, insert_after?: string): Tab {
  // If the tile already exists in the tab, don't add it again
  if (tab.tileIds.includes(tileId)) {
    return tab;
  }
  
  // Create a new array with the new tile ID
  const tileIds = [...tab.tileIds];
  if (insert_after) {
    const index = tileIds.indexOf(insert_after);
    if (index !== -1) {
      tileIds.splice(index + 1, 0, tileId);
    }
  }
  else {
    tileIds.push(tileId);
  }
  
  // Return the updated tab
  return {
    ...tab,
    tileIds,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Remove a tile from a tab
 */
export function removeTileId(tab: Tab, tileId: string): Tab {
  // Filter out the tile ID to remove
  const tileIds = tab.tileIds.filter(id => id !== tileId);
  
  // Update the focused tiles if needed
  let focusedTileIds = [...tab.focusedTileNames] as [string | undefined, string | undefined];
  if (focusedTileIds[0] === tileId) focusedTileIds[0] = undefined;
  if (focusedTileIds[1] === tileId) focusedTileIds[1] = undefined;
  
  // Return the updated tab
  return {
    ...tab,
    tileIds,
    focusedTileNames: focusedTileIds,
    // updatedAt: new Date().toISOString()
  };
}
