import { TabProps } from "@/types/evals/grid";
import { Tile } from "./tile";

// Tab state definition
export interface Tab {
  id: string | null;
  name: string | null;
  visible: boolean;
  active: boolean;
  order: number;
  globalContext?: string;
  tabCreated: boolean; // From metadata
  tempTabCreated: boolean; // From metadata
  savedTab: TabProps | null; // This needs to match exactly the TabProps type from grid.ts
  focusedTileIds: [string | undefined, string | undefined];
  createdAt: string;
  updatedAt: string;
  tiles: Record<string, Tile>; // Child tiles indexed by ID
  
  // UI state properties moved from Interface and local state
  saveSuccess?: boolean;
  resetting: boolean;
  edit: boolean;
  interactive: boolean;
  help: boolean;
  copied?: string;
  deleting: boolean;
  dataPending: boolean;
  pending: boolean;
  refreshing: boolean;
}

/**
 * Initialize a new tab
 */
export function initTab(tabId: string, initialState: Partial<Tab> = {}): Tab {
  return {
    id: tabId,
    name: initialState.name || null,
    visible: initialState.visible !== undefined ? initialState.visible : true,
    active: initialState.active !== undefined ? initialState.active : false,
    order: initialState.order !== undefined ? initialState.order : 0,
    globalContext: initialState.globalContext,
    tabCreated: initialState.tabCreated !== undefined ? initialState.tabCreated : false,
    tempTabCreated: initialState.tempTabCreated !== undefined ? initialState.tempTabCreated : false,
    savedTab: initialState.savedTab !== undefined ? initialState.savedTab : null,
    focusedTileIds: initialState.focusedTileIds !== undefined ? initialState.focusedTileIds : [undefined, undefined],
    createdAt: initialState.createdAt || new Date().toISOString(),
    updatedAt: initialState.updatedAt || new Date().toISOString(),
    tiles: initialState.tiles || {},
    
    // Default values for the UI state properties
    saveSuccess: initialState.saveSuccess,
    resetting: initialState.resetting !== undefined ? initialState.resetting : false,
    edit: initialState.edit !== undefined ? initialState.edit : true,
    interactive: initialState.interactive !== undefined ? initialState.interactive : true,
    copied: initialState.copied,
    help: initialState.help !== undefined ? initialState.help : true,
    deleting: initialState.deleting !== undefined ? initialState.deleting : false,
    dataPending: initialState.dataPending !== undefined ? initialState.dataPending : false,
    pending: initialState.pending !== undefined ? initialState.pending : true,
    refreshing: initialState.refreshing !== undefined ? initialState.refreshing : false,
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
    updatedAt: new Date().toISOString()
  };
}

/**
 * Set a specific property on a tab
 */
export function setTabProperty<K extends keyof Tab>(
  tab: Tab, 
  property: K, 
  value: Tab[K]
): Tab {
  return {
    ...tab,
    [property]: value,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Add a tile to a tab
 */
export function addTile(tab: Tab, tileId: string): Tab {
  if (!tab.tiles) {
    tab.tiles = {};
  }
  return tab;
}

/**
 * Remove a tile from a tab
 */
export function removeTile(tab: Tab, tileId: string): Tab {
  if (tab.tiles && tab.tiles[tileId]) {
    const newTiles = { ...tab.tiles };
    delete newTiles[tileId];
    
    return {
      ...tab,
      tiles: newTiles,
      updatedAt: new Date().toISOString()
    };
  }
  return tab;
}
