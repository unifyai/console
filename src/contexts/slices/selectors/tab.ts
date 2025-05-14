// Tab metadata - core identifying information
export interface TabMeta {
  id: string | null;
  name: string | null;
  // createdAt: string;
  // updatedAt: string;
  visible: boolean;
  active: boolean;
  order: number;
}

// Tab data - business data and relationships
export interface TabData {
  globalContext?: string;
  tileIds: string[]; // References to tiles instead of containing them directly
  tileNames: string[]; // Names of tiles in the tab
  itemsNeedRecompute: boolean; // Flag to indicate when items need recomputing
}

// Tab UI state - UI-related state
export interface TabUI {
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
  color?: string;
  hoveredLog?: string;
  focusDialog: boolean;
  editTile: string | undefined;
  dataPending: boolean;
  pending: boolean;
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
    // createdAt: initialState.createdAt || new Date().toISOString(),
    // updatedAt: initialState.updatedAt || new Date().toISOString(),
    
    // Data
    globalContext: initialState.globalContext,
    tileIds: initialState.tileIds || [],
    tileNames: initialState.tileNames || [],
    itemsNeedRecompute: initialState.itemsNeedRecompute !== undefined ? initialState.itemsNeedRecompute : false,
    
    // UI
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
    hoveredLog: initialState.hoveredLog,
    focusDialog: initialState.focusDialog !== undefined ? initialState.focusDialog : false,
    editTile: initialState.editTile,
    dataPending: initialState.dataPending !== undefined ? initialState.dataPending : false,
    pending: initialState.pending !== undefined ? initialState.pending : false,

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
export function addTile(tab: Tab, tileId: string, tileName: string, insert_after?: string): Tab {
  // If the tile already exists in the tab, don't add it again
  if (tab.tileIds.includes(tileId)) {
    return tab;
  }
  
  // Create a new array with the new tile ID
  const tileIds = [...tab.tileIds];
  const tileNames = [...tab.tileNames];
  if (insert_after) {
    const index = tileIds.indexOf(insert_after);
    if (index !== -1) {
      tileIds.splice(index + 1, 0, tileId);
      tileNames.splice(index + 1, 0, tileName);
    }
  }
  else {
    tileIds.push(tileId);
    tileNames.push(tileName);
  }
  
  // Return the updated tab
  return {
    ...tab,
    tileIds,
    tileNames,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Remove a tile from a tab
 */
export function removeTile(tab: Tab, tileId: string, tileName: string): Tab {
  // Filter out the tile ID to remove
  const tileIds = tab.tileIds.filter(id => id !== tileId);

  // Filter out the tile names  
  const tileNames = tab.tileNames.filter(name => name !== tileName);
  
  // Update the focused tiles if needed
  let focusedTileNames = [...tab.focusedTileNames] as [string | undefined, string | undefined];
  if (focusedTileNames[0] === tileName) focusedTileNames[0] = undefined;
  if (focusedTileNames[1] === tileName) focusedTileNames[1] = undefined;
  
  // Return the updated tab
  return {
    ...tab,
    tileIds,
    tileNames,
    focusedTileNames,
    // updatedAt: new Date().toISOString()
  };
}
