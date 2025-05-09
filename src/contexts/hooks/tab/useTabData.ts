import { useMemo, useRef, useCallback, useEffect } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { TabData } from '../../slices/selectors/tab';
import { Tile } from '../../slices/selectors/tile';
import { TileProps } from '@/types/evals/grid';
import { useTabMeta } from './useTabMeta';
import { useShallow } from 'zustand/react/shallow';
import { useTileItemActions } from '../tile/useTileItem';
import isEqual from 'fast-deep-equal';
import { ViewTile } from '@/contexts/slices/selectors/viewTile';
import { TableTile } from '@/contexts/slices/selectors/tableTile';
import { PlotTile } from '@/contexts/slices/selectors/plotTile';
import { EditorTile } from '@/contexts/slices/selectors/editorTile';

// Define stable fallback references
const EMPTY_TILE_IDS: string[] = [];
const EMPTY_TILE_NAMES: string[] = [];
const EMPTY_TILES: Record<string, Tile> = {};
const EMPTY_TILE_PROPS: TileProps[] = [];

/**
 * Interface for tab data-related actions
 */
export interface TabDataActions {
  setGlobalContext: (context: string | undefined) => void;
  removeContextFromTab: (context: string) => void;

  // Tile management
  initTile: (tileId: string, tileName: string, initialState?: Partial<Tile>) => void;
  addTile: (newTileId: string, initialState?: Partial<Tile>) => void;
  removeTile: (tileId: string) => void;
  updateTile: (tileId: string, updates: Partial<Tile>) => void;
  renameTile: (tileId: string, newTileName: string) => void;
  
  // Type-specific tile actions
  initTableTile: (tileId: string, initialState?: Partial<TableTile>) => void;
  updateTableTile: (tileId: string, updates: Partial<TableTile>) => void;
  initPlotTile: (tileId: string, initialState?: Partial<PlotTile>) => void;
  updatePlotTile: (tileId: string, updates: Partial<PlotTile>) => void;
  initViewTile: (tileId: string, initialState?: Partial<ViewTile>) => void;
  updateViewTile: (tileId: string, updates: Partial<ViewTile>) => void;
  initEditorTile: (tileId: string, initialState?: Partial<EditorTile>) => void;
  updateEditorTile: (tileId: string, updates: Partial<EditorTile>) => void;
  
  // Helper methods for tiles
  getTileIds: () => string[];
  getTileNames: () => string[];
  getTile: (tileIdOrName: string) => Tile | null;
  
  // Grid-related actions
  getItems: () => TileProps[];
  setItems: (items: TileProps[]) => void;
  setItemsNeedRecompute: (needRecompute: boolean) => void;
}

/**
 * Custom hook to access tab data state and actions
 * @param tabIdOrName The ID or name of the tab to access
 * @param interfaceIdOrName Optional interface ID or name (if not provided, active interface will be used)
 * @returns Object containing tab data state and actions
 */
export function useTabData(
  tabIdOrName: string | null, 
  interfaceIdOrName?: string | null
) {
  // Use the meta hook to get common tab info
  const { 
    tabId, 
    activeInterfaceId, 
    tabExists 
  } = useTabMeta(tabIdOrName, interfaceIdOrName);

  // Get the tile item actions getter at the top level
  const { getTileItemActions } = useTileItemActions();

  // Granular subscriptions to data properties
  const globalContext = useStoreContext(state => {
    if (!tabExists || !tabId) return undefined;
    return state.tabsById[tabId].globalContext;
  });
  
  const tileIds = useStoreContext(
    useShallow(state => {
      if (!tabExists || !tabId) return EMPTY_TILE_IDS;
      return state.tabsById[tabId].tileIds;
    })
  );

  const tileNames = useStoreContext(
    useShallow(state => {
      if (!tabExists || !tabId) return EMPTY_TILE_NAMES;
      return state.tabsById[tabId].tileNames;
    })
  );

  const tiles = useMemo(() => {
    if (!tabExists || !tabId || !tileIds.length) return EMPTY_TILES;
    
    // We only need the tile IDs and some partial Tile state here
    // The actual tile data will be accessed through the tile-specific hooks
    const tileMap: Record<string, Tile> = {};
    
    // Use tileIds and tileNames arrays which should have corresponding indices
    tileIds.forEach((tileId, index) => {
      const tileName = tileNames[index] || '';
      
      if (tileName) {
        const itemActions = getTileItemActions(tileName, tabIdOrName);
        
        if (itemActions) {
          const tileItem = itemActions.asTileItem();
          tileMap[tileId] = {
            id: tileId,
            name: tileName,
            table: tileItem.table,
            itemsNeedRecompute: itemActions.getItemsNeedRecompute(),
            // Include other necessary tile properties
          } as Tile;
        }
      }
    });
    
    return tileMap;
  }, [tabExists, tabId, tileIds, tileNames, getTileItemActions, tabIdOrName]);

  const itemsNeedRecompute = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].itemsNeedRecompute;
  });

  // Create the grid items array with useMemo
  const itemsRef = useRef<TileProps[]>([]);
  const items = useMemo<TileProps[]>(() => {
    // If no tab or tiles, return an empty array
    if (!tabExists || !tabId || !Object.keys(tiles).length) return EMPTY_TILE_PROPS;

    // Build the array from each tile ID
    const newItems = Object.values(tiles).map(tile => {
      // Get itemActions for this tile using its name
      const itemActions = getTileItemActions(tile.name, tabIdOrName);
      
      // Call `asTileItem()` or use a fallback
      return itemActions?.asTileItem() || {
        name: tile.name,
        x: 0,
        y: 0,
        w: 1,
        h: 1
      } as TileProps;
    });

    // If the items are the same, return the old reference to prevent re-renders
    if (isEqual(itemsRef.current, newItems)) {
      return itemsRef.current;
    }
    
    // Update the ref and return the new items
    itemsRef.current = newItems;
    return newItems;
  }, [tabExists, tabId, tiles, getTileItemActions, tabIdOrName, itemsNeedRecompute]);

  // Get all the store actions needed for data
  const storeUpdateTab = useStoreContext(state => state.updateTab);
  const storeRemoveContextFromTab = useStoreContext(state => state.removeContextFromTab);
  const storeInitTile = useStoreContext(state => state.initTile);
  const storeAddTile = useStoreContext(state => state.addTile);
  const storeRemoveTile = useStoreContext(state => state.removeTile);
  const storeRenameTile = useStoreContext(state => state.renameTile);
  const storeUpdateTile = useStoreContext(state => state.updateTile);
  
  // Type-specific tile actions
  const storeInitTableTile = useStoreContext(state => state.initTableTile);
  const storeUpdateTableTile = useStoreContext(state => state.updateTableTile);
  const storeInitPlotTile = useStoreContext(state => state.initPlotTile);
  const storeUpdatePlotTile = useStoreContext(state => state.updatePlotTile);
  const storeInitViewTile = useStoreContext(state => state.initViewTile);
  const storeUpdateViewTile = useStoreContext(state => state.updateViewTile);
  const storeInitEditorTile = useStoreContext(state => state.initEditorTile);
  const storeUpdateEditorTile = useStoreContext(state => state.updateEditorTile);

  // Memoize the data object
  const data = useMemo<Partial<TabData> | null>(() => {
    if (!tabExists) return null;
    
    return {
      globalContext,
      tileIds,
      tileNames
    };
  }, [tabExists, globalContext, tileIds, tileNames]);

  // Define setItems as a callback to avoid dependency cycles
  const setItems = useCallback((newItems: TileProps[]) => {
    if (!tabId || !Object.keys(tiles).length) return;
    
    newItems.forEach(item => {
      const tileItemName = item.name;
      
      // Get itemActions using our getter
      const itemActions = getTileItemActions(tileItemName, tabIdOrName);
      
      // Update the tile using fromTileItem
      if (itemActions) {
        itemActions.fromTileItem(item);
      }
    });
  }, [tabId, tiles, getTileItemActions, tabIdOrName]);

  // Memoize the data actions
  const dataActions = useMemo<TabDataActions>(() => ({
    setGlobalContext: (globalContext) => {
      if (tabId) {
        storeUpdateTab(tabId, { globalContext });
      }
    },

    removeContextFromTab: (context) => {
      if (tabId) {
        storeRemoveContextFromTab(tabId, context);
      }
    },
    
    // Tile management
    initTile: (tileId, tileName, initialState = {}) => {
      if (activeInterfaceId && tabId) {
        // Initialize the tile with proper IDs
        storeInitTile(
          tabId, 
          tileId, 
          {
            id: tileId,
            name: tileName,
            tabId: tabId,
            ...initialState
          }
        );
      }
    },

    addTile: (newTileId, initialState = {}) => {
      if (activeInterfaceId && tabId) {
        // Add the tile with proper IDs
        storeAddTile(
          tabId, 
          newTileId,
          initialState
        );
      }
    },
    
    removeTile: (tileId) => {
      if (activeInterfaceId && tabId) {
        storeRemoveTile(tabId, tileId);
      }
    },
    
    updateTile: (tileId, updates) => {
      if (tabId) {
        storeUpdateTile(tileId, updates);
      }
    },
    
    renameTile: (tileId, newTileName) => {
      if (activeInterfaceId && tabId) {
        // Add the tile with proper IDs
        storeRenameTile(
          tabId, 
          tileId,
          newTileName,
        );
      }
    },

    // Table tile specific actions
    initTableTile: (tileId, initialState = {}) => {
      if (activeInterfaceId && tabId) {
        storeInitTableTile(tileId, initialState);
      }
    },
    
    updateTableTile: (tileId, updates) => {
      if (activeInterfaceId && tabId) {
        storeUpdateTableTile(tileId, updates);
      }
    },
    
    // Plot tile specific actions
    initPlotTile: (tileId, initialState = {}) => {
      if (activeInterfaceId && tabId) {
        storeInitPlotTile(tileId, initialState);
      }
    },
    
    updatePlotTile: (tileId, updates) => {
      if (activeInterfaceId && tabId) {
        storeUpdatePlotTile(tileId, updates);
      }
    },
    
    // View tile specific actions
    initViewTile: (tileId, initialState = {}) => {
      if (activeInterfaceId && tabId) {
        storeInitViewTile(tileId, initialState);
      }
    },
    
    updateViewTile: (tileId, updates) => {
      if (activeInterfaceId && tabId) {
        storeUpdateViewTile(tileId, updates);
      }
    },

    // Editor tile specific actions
    initEditorTile: (tileId, initialState = {}) => {
      if (activeInterfaceId && tabId) {
        storeInitEditorTile(tileId, initialState);
      }
    },
    
    updateEditorTile: (tileId, updates) => {
      if (activeInterfaceId && tabId) {
        storeUpdateEditorTile(tileId, updates);
      }
    },

    // Helper methods for tiles
    getTileIds: () => tileIds,

    getTileNames: () => tileNames,
    
    getTile: (tileIdOrName) => {
      // First try direct lookup by ID
      if (tiles[tileIdOrName]) {
        return tiles[tileIdOrName];
      }
      
      // If not found by ID, try looking up by name
      const tileByName = Object.values(tiles).find(tile => tile.name === tileIdOrName);
      return tileByName || null;
    },
    
    getItems: () => items,

    setItems,

    setItemsNeedRecompute: (needRecompute: boolean) => {
      if (tabId) {
        storeUpdateTab(tabId, { itemsNeedRecompute: needRecompute });
      }
    }
  }), [
    tabId,
    tiles,
    tileIds,
    tileNames,
    items,
    activeInterfaceId,
    setItems,
    storeUpdateTab,
    storeRemoveContextFromTab,
    storeInitTile,
    storeAddTile,
    storeRemoveTile,
    storeRenameTile,
    storeUpdateTile,
    storeInitTableTile,
    storeUpdateTableTile,
    storeInitPlotTile,
    storeUpdatePlotTile,
    storeInitViewTile,
    storeUpdateViewTile,
    storeInitEditorTile,
    storeUpdateEditorTile
  ]);

  // Reset the itemsNeedRecompute flag after computing items
  useEffect(() => {
    if (tabId && itemsNeedRecompute) {
      // Reset the flag on the tab
      dataActions.setItemsNeedRecompute(false);
      
      // Also reset the flag on all tiles in this tab
      Object.values(tiles).forEach(tile => {
        if (tile.itemsNeedRecompute) {
          // Get itemActions for this tile using its name directly
          const itemActions = getTileItemActions(tile.name, tabIdOrName);
          itemActions?.setItemsNeedRecompute(false);
        }
      });
    }
  }, [tabId, itemsNeedRecompute, tiles, dataActions, getTileItemActions, tabIdOrName]);

  return {
    data,
    dataActions,
  };
} 