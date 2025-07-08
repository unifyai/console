import { useMemo, useCallback } from 'react';
import { useStoreContext, useStoreApiContext } from '../../providers/StoreProvider';
import { useTileMeta } from './useTileMeta';
import { useTileUI } from './useTileUI';
import { useTileData } from './useTileData';
import { Tile } from '../../slices/selectors/tile';
import { TileProps } from '@/types/interfaces/grid';
import { convertTileToTileItem, convertTileItemToTile } from './tileItemUtils';
import { useTableTile } from './useTableTile';
import { usePlotTile } from './usePlotTile';
import { useViewTile } from './useViewTile';
import { useEditorTile } from './useEditorTile';
import { useTerminalTile } from './useTerminalTile';

/**
 * Interface for tile item conversion actions
 */
export interface TileItemActions {
  asTileItem: () => TileProps;
  fromTileItem: (tileItem: TileProps) => boolean;
  getItemsNeedRecompute: () => boolean;
  setItemsNeedRecompute: (needsRecompute: boolean) => void;
}

/**
 * Factory function to create tile item actions
 */
export function createTileItemActions(
  tileId: string,
  tile: Partial<Tile> | null,
  storeUpdateTile: (id: string, updates: any) => void
): TileItemActions | null {
  if (!tileId || !tile) {
    return null;
  }
  
  return {
    asTileItem: () => {
      return convertTileToTileItem(tile);
    },
    
    fromTileItem: (tileItem: TileProps) => {
      const tile = convertTileItemToTile(tileItem, tileId);
      
      // Apply all updates to the tile
      storeUpdateTile(tileId, tile);

      return true;
    },

    getItemsNeedRecompute: () => {
      return tile?.itemsNeedRecompute || false;
    },

    setItemsNeedRecompute: (needsRecompute: boolean) => {
      storeUpdateTile(tileId, { itemsNeedRecompute: needsRecompute });
    }
  };
}

/**
 * Custom hook to access tile item conversion utilities
 * @param tileIdOrName The ID or name of the tile to access
 * @param tabIdOrName The ID or name of the tab containing the tile
 * @returns Object containing tile item conversion actions
 */
export function useTileItem(
  tileIdOrName: string | null,
  tabIdOrName: string | null
) {
  // Use the existing hooks to get all necessary tile information
  const { meta, tileId, tileExists } = useTileMeta(tileIdOrName, tabIdOrName);
  const { ui } = useTileUI(tileIdOrName, tabIdOrName);
  const { data } = useTileData(tileIdOrName, tabIdOrName);

  // Use type-specific hooks based on the tile type
  const {
    tableTile,
  } = useTableTile(tileIdOrName, tabIdOrName || null);
  
  const {
    plotTile,
  } = usePlotTile(tileIdOrName, tabIdOrName || null);
  
  const {
    viewTile,
  } = useViewTile(tileIdOrName, tabIdOrName || null);

  const {
    editorTile,
  } = useEditorTile(tileIdOrName, tabIdOrName || null);

  const {
    terminalTile,
  } = useTerminalTile(tileIdOrName, tabIdOrName || null);

  // Get store actions for data management
  const storeUpdateTile = useStoreContext(state => state.updateTile);

  // Combine tile data for the action creator
  const tile = useMemo<Partial<Tile> | null>(() => {
    if (!meta || !tileId) return null;
    
    return {
      ...meta,
      ...data,
      ...ui,
      tableTile,
      plotTile,
      viewTile,
      editorTile,
      terminalTile
    };
  }, [meta, data, ui, tableTile, plotTile, viewTile, editorTile, terminalTile, tileId]);

  // Memoize the item actions using the factory function
  const itemActions = useMemo(() => {
    return createTileItemActions(
      tileId || '',
      tile,
      storeUpdateTile,
    );
  }, [
    tileId,
    tile,
    storeUpdateTile,
  ]);

  return {
    itemActions,
    tileExists
  };
}

/**
 * Hook to access tile item actions for any tile without violating React hook rules
 */
export function useTileItemActions() {
  // Access the global store api
  const storeApi = useStoreApiContext();
  
  // Create a memoized function to get tile item actions
  const getTileItemActions = useCallback((
    tileIdOrName: string,
    tabIdOrName: string | null
  ) => {
    if (!tileIdOrName || !tabIdOrName) return null;
    
    // Get state from store
    const state = storeApi.getState();
    
    // First attempt: direct ID lookup
    let tileLookup = state.tilesById[tileIdOrName];
    
    // Second attempt: Find by tab and name
    if (!tileLookup) {
      // Find the tab ID first (might be an ID or a name)
      let tabId = tabIdOrName;
      
      // If tabID isn't found directly, try to find the tab by name
      if (!state.tabsById[tabId]) {
        const interfaceId = state.activeInterfaceId;
        if (interfaceId) {
          // Look for tab with this name in the interface
          const tabs = Object.values(state.tabsById).filter(
            tab => tab.name === tabIdOrName && tab.interfaceId === interfaceId
          );
          if (tabs.length > 0) {
            tabId = tabs[0].id || '';
          }
        }
      }
      
      // Now look for a tile with matching name and tab ID
      if (tabId && state.tabsById[tabId]) {
        const tiles = Object.values(state.tilesById).filter(
          tile => tile.name === tileIdOrName && tile.tabId === tabId
        );
        if (tiles.length > 0) {
          tileLookup = tiles[0];
        }
      }
    }

    // If no tile found, return null
    if (!tileLookup) return null;
    
    // Create actions for this tile using the factory function
    return createTileItemActions(
      tileLookup.id,
      tileLookup,
      state.updateTile,
    );
  }, [storeApi]);
  
  return { getTileItemActions };
} 