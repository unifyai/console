import { useMemo } from "react";
import { TileActions, useTile } from "./useTile";

// Define the default return value for the useTableTile hook
const DEFAULT_USE_TABLE_TILE_RETURN = {
  tableTile: null,
  actions: null,
  exists: false,
};

/**
 * Interface for table tile-related actions
 */
export interface TableTileActions extends TileActions {
  // Add any table-specific actions here
}

/**
 * Custom hook to access table tile data and actions
 * @param tileId The ID of the table tile to access
 * @param tabId Optional tab ID
 * @param interfaceId Optional interface ID
 * @param projectId Optional project ID
 * @returns Object containing tile state, actions, and existence flag
 */
export function useTableTile(
  tileId: string | null,
  tabId?: string | null,
  interfaceId?: string | null,
  projectId?: string | null
) {
  // Always call hooks at the top level, unconditionally

  const {
    tile: baseTile,
    actions: baseTileActions,
    exists,
  } = useTile(tileId, tabId, interfaceId, projectId);

 // Instead of subscribing to the entire interface object,
  // we subscribe to individual properties. This way, changes in
  // unrelated fields won't cause a new reference for everything.

  // We'll check if this tab actually exists:
  const hasTableTile = useMemo(() => {
    if (!baseTile || baseTile.type !== 'Table') return false;
    return true;
  }, [baseTile]);
  
  const tableData = useMemo(() => {
    if (!hasTableTile || !baseTile) return null;
    // If we want the same path as the tile state, do:
    return baseTile.tableData || null;
  }, [hasTableTile, baseTile]);

  const tableActions = useMemo<TableTileActions>(() => {
    // We'll just spread baseTileActions, then add table-specific methods
    return {
      ...baseTileActions as TableTileActions,

      // Add any table-specific actions here

    };
  }, [baseTileActions, hasTableTile]);

  if (tileId === null) {
    return DEFAULT_USE_TABLE_TILE_RETURN;
  }
  
  return {
    tableTile: tableData,
    actions: tableActions,
    exists: exists && hasTableTile,
  };
}