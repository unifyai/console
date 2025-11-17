import { Tile } from '../slices/selectors/tile';
import { IStoreState } from '../store';

/**
 * Select all tiles from the store
 */
export const selectAllTiles = (state: IStoreState) => {
  return Object.values(state.tilesById || {});
};

/**
 * Select a tile by its ID
 */
export const selectTileById = (state: IStoreState, id: string) => {
  if (!id) return null;
  return state.tilesById?.[id] || null;
};

/**
 * Select a tile by tab ID and name
 */
export const selectTileByTabIdAndName = (state: IStoreState, tabId: string, name: string) => {
  if (!tabId || !name) return null;
  
  const tiles = Object.values(state.tilesById || {});
  return tiles.find(tile => tile.tabId === tabId && tile.name === name) || null;
};

/**
 * Select all tiles for a specific tab
 */
export const selectTilesForTab = (state: IStoreState, tabId: string) => {
  if (!tabId) return [];
  
  const tiles = Object.values(state.tilesById || {});
  return tiles.filter(tile => tile.tabId === tabId);
};

/**
 * Select all tiles for a specific tab by type
 */
export const selectTilesForTabByType = (state: IStoreState, tabId: string, tileType: string) => {
  if (!tabId || !tileType) return [];
  
  const tiles = Object.values(state.tilesById || {});
  return tiles.filter(tile => tile.tabId === tabId && tile.type === tileType);
};

/**
 * Select all visible tiles for a specific tab
 */
export const selectVisibleTilesForTab = (state: IStoreState, tabId: string) => {
  if (!tabId) return [];
  
  const tiles = Object.values(state.tilesById || {});
  return tiles.filter(tile => tile.tabId === tabId && tile.visible !== false);
};

/**
 * Select all table tiles for a specific tab
 */
export const selectTableTilesForTab = (state: IStoreState, tabId: string) => {
  return selectTilesForTabByType(state, tabId, 'Table');
};

/**
 * Select all plot tiles for a specific tab
 */
export const selectPlotTilesForTab = (state: IStoreState, tabId: string) => {
  return selectTilesForTabByType(state, tabId, 'Plot');
};

/**
 * Get all unique context values from tiles in a tab
 */
export const selectUniqueContextsForTab = (state: IStoreState, tabId: string) => {
  if (!tabId) return [];
  
  const contexts = new Set<string>();
  
  const tiles = Object.values(state.tilesById || {});
  tiles.forEach(tile => {
    if (tile.tabId === tabId && tile.context) {
      contexts.add(tile.context);
    }
  });
  
  return Array.from(contexts);
};

/**
 * Get all table names from tiles in a tab
 */
export const selectTableNamesForTab = (state: IStoreState, tabId: string) => {
  if (!tabId) return [];
  
  return selectTableTilesForTab(state, tabId)
    .map(tile => tile.name)
    .filter(Boolean) as string[];
};

/**
 * Find all plot tiles that use a specific table name
 */
export const selectPlotTilesUsingTable = (state: IStoreState, tabId: string, tableName: string) => {
  if (!tabId || !tableName) return [];
  
  // Get all plot tiles in the tab
  const plotTiles = selectPlotTilesForTab(state, tabId);
  
  // Filter to only those that use the specified table
  return plotTiles.filter(tile => {
    // Check if the plot uses this table
    if (typeof tile.table === 'string' && tile.table === tableName) {
      return true;
    }
    
    // For more complex plots that might use multiple tables
    // In a real implementation, you'd need to check other properties
    // that indicate table dependencies
    
    return false;
  });
};