import { useMemo, useRef, useCallback, useEffect } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { TabData } from '../../slices/selectors/tab';
import { Tile } from '../../slices/selectors/tile';
import { TabProps, TileProps } from '@/types/evals/grid';
import { useTabMeta } from './useTabMeta';
import { useShallow } from 'zustand/react/shallow';
import { useTileItemActions } from '../tile/useTileItem';
import isEqual from 'fast-deep-equal';
import { deconstructHierarchicalId } from '@/contexts/utils/sliceUtils';
import { TableArguments } from '@/types/evals/logs';

// Define stable fallback references
const EMPTY_TABLE_ARGUMENTS = {};
const EMPTY_TILE_IDS: string[] = [];
const EMPTY_TILES: Record<string, Tile> = {};
const EMPTY_TILE_PROPS: TileProps[] = [];

/**
 * Interface for tab data-related actions
 */
export interface TabDataActions {
  setGlobalContext: (context: string | undefined) => void;
  setSavedTab: (savedTab: TabProps | null) => void;
  setTableArguments: (tableArguments: TableArguments) => void;

  // Tile management
  initTile: (tileName: string, initialState?: { type?: 'Table' | 'Plot' | 'View' | 'Editor' } & any) => void;
  addTile: (tileName: string, newName: string, initialState?: Partial<Tile>) => void;
  removeTile: (tileName: string) => void;
  updateTile: (tileName: string, updates: any) => void;
  renameTile: (tileName: string, newName: string) => void;
  
  // Type-specific tile actions
  initTableTile: (tileName: string, initialState?: any) => void;
  updateTableTile: (tileName: string, updates: any) => void;
  initPlotTile: (tileName: string, initialState?: any) => void;
  updatePlotTile: (tileName: string, updates: any) => void;
  initViewTile: (tileName: string, initialState?: any) => void;
  updateViewTile: (tileName: string, updates: any) => void;
  initEditorTile: (tileName: string, initialState?: any) => void;
  updateEditorTile: (tileName: string, updates: any) => void;
  
  // Helper methods for tiles
  getTileIds: () => string[];
  getTile: (tileName: string) => Tile | null;
  
  // Grid-related actions
  getItems: () => TileProps[];
  setItems: (items: TileProps[]) => void;
  setItemsNeedRecompute: (needRecompute: boolean) => void;
}

/**
 * Custom hook to access tab data state and actions
 * @param tabName The name of the tab to access
 * @param interfaceName Optional interface name (if not provided, active interface will be used)
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing tab data state and actions
 */
export function useTabData(
  tabName: string | null, 
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Use the meta hook to get common tab info
  const { 
    tabId, 
    activeProjectId, 
    activeInterfaceId, 
    tabExists 
  } = useTabMeta(tabName, interfaceName, projectName);

  // Get the tile item actions getter at the top level
  const { getTileItemActions } = useTileItemActions();

  // Granular subscriptions to data properties
  const globalContext = useStoreContext(state => {
    if (!tabExists || !tabId) return undefined;
    return state.tabsById[tabId].globalContext;
  });
  
  const savedTab = useStoreContext(
    useShallow(state => {
      if (!tabExists || !tabId) return null;
      return state.tabsById[tabId].savedTab;
    })
  );

  const tableArguments = useStoreContext(
    useShallow(state => {
      if (!tabExists || !tabId) return EMPTY_TABLE_ARGUMENTS;
      return state.tabsById[tabId].tableArguments || EMPTY_TABLE_ARGUMENTS;
    })
  );
  
  const tileIds = useStoreContext(
    useShallow(state => {
      if (!tabExists || !tabId) return EMPTY_TILE_IDS;
      return state.tabsById[tabId].tileIds;
    })
  );

  const tiles = useMemo(() => {
    if (!tabExists || !tabId || !tileIds.length) return EMPTY_TILES;
    
    // We only need the tile IDs and some partial Tile state here
    // The actual tile data will be accessed through the tile-specific hooks
    const tileMap: Record<string, Tile> = {};
    
    tileIds.forEach(tileId => {
      const tileNameFromId = deconstructHierarchicalId(tileId).name;
      const itemActions = getTileItemActions(tileNameFromId, tabName, interfaceName, projectName);
      
      if (itemActions) {
        const tileItem = itemActions.asTileItem();
        tileMap[tileId] = {
          id: tileId,
          name: tileItem.i,
          table: tileItem.table,
          itemsNeedRecompute: itemActions.getItemsNeedRecompute(),
          // Include other necessary tile properties
        } as Tile;
      }
    });
    
    return tileMap;
  }, [tabExists, tabId, tileIds, getTileItemActions, tabName, interfaceName, projectName]);

  const itemsNeedRecompute = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].itemsNeedRecompute;
  });

  // Create the grid items array with useMemo
  const itemsRef = useRef<TileProps[]>([]);
  const items = useMemo<TileProps[]>(() => {
    // If no tab or tiles, return an empty array
    if (!tabExists || !tabId || !Object.keys(tiles).length) return EMPTY_TILE_PROPS;

    // if (!itemsNeedRecompute && itemsRef.current.length > 0) { 
    //   return itemsRef.current;
    // }

    // Build the array from each tile ID
    const newItems = Object.values(tiles).map(tile => {
      // Extract tile name from hierarchical ID
      const tileNameFromId = deconstructHierarchicalId(tile.id).name;
      
      // Get itemActions for this tile using our getter
      const itemActions = getTileItemActions(tileNameFromId, tabName, interfaceName, projectName);
      
      // Call `asTileItem()` or use a fallback
      return itemActions?.asTileItem() || {
        i: tileNameFromId,
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
  }, [tabExists, tabId, tiles, getTileItemActions, tabName, interfaceName, projectName, itemsNeedRecompute]);

  // Get all the store actions needed for data
  const storeUpdateTab = useStoreContext(state => state.updateTab);
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
      savedTab,
      tableArguments,
      tileIds
    };
  }, [tabExists, globalContext, savedTab, tileIds, tableArguments]);

  // Define setItems as a callback to avoid dependency cycles
  const setItems = useCallback((newItems: TileProps[]) => {
    if (!tabId || !Object.keys(tiles).length) return;
    
    newItems.forEach(item => {
      const tileItemName = item.i;
      
      // Get itemActions using our getter
      const itemActions = getTileItemActions(tileItemName, tabName, interfaceName, projectName);
      
      // Update the tile using fromTileItem
      if (itemActions) {
        itemActions.fromTileItem(item);
      }
    });
  }, [tabId, tiles, getTileItemActions, tabName, interfaceName, projectName]);

  // Memoize the data actions
  const dataActions = useMemo<TabDataActions>(() => ({
    setGlobalContext: (globalContext) => {
      if (tabId) {
        storeUpdateTab(tabId, { globalContext });
      }
    },
    
    setSavedTab: (savedTab) => {
      if (tabId) {
        storeUpdateTab(tabId, { savedTab });
      }
    },

    setTableArguments: (tableArguments) => {
      if (tabId) {
        storeUpdateTab(tabId, { tableArguments });
      }
    },
    
    // Tile management
    initTile: (tileName, initialState = {}) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Create hierarchical tileId
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        // Initialize the tile with proper IDs
        storeInitTile(
          tabId, 
          hierarchicalTileId, 
          {
            id: hierarchicalTileId,
            name: tileName,
            projectId: activeProjectId,
            interfaceId: activeInterfaceId,
            tabId: tabId,
            ...initialState
          }
        );
      }
    },

    addTile: (tileName, newName, initialState = {}) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if the tileId is already hierarchical
        const sourceTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
          
        const newTileId = newName.includes('>')
          ? newName
          : `${tabId}>${newName}`;

        // Add the tile with proper IDs
        storeAddTile(
          tabId, 
          sourceTileId,
          newTileId,
          {
            id: newTileId,
            name: newName,
            projectId: activeProjectId,
            interfaceId: activeInterfaceId,
            tabId: tabId,
            ...initialState
          }
        );
      }
    },
    
    removeTile: (tileName) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if tileId is already hierarchical
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        storeRemoveTile(tabId, hierarchicalTileId);
      }
    },
    
    updateTile: (tileName, updates) => {
      if (tabId) {
        // Check if tileId is already hierarchical
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        storeUpdateTile(hierarchicalTileId, updates);
      }
    },
    
    renameTile: (tileName, newName) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if the tileIds are already hierarchical
        const sourceTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;

        const newTileId = newName.includes('>')
          ? newName
          : `${tabId}>${newName}`;

        // Add the tile with proper IDs
        storeRenameTile(
          tabId, 
          sourceTileId,
          newTileId,
          {
            id: newTileId,
            name: newName,
            projectId: activeProjectId,
            interfaceId: activeInterfaceId,
            tabId: tabId,
          }
        );
      }
    },

    // Table tile specific actions
    initTableTile: (tileName, initialState = {}) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if tileId is already hierarchical
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        storeInitTableTile(hierarchicalTileId, initialState);
      }
    },
    
    updateTableTile: (tileName, updates) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if tileId is already hierarchical
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        storeUpdateTableTile(hierarchicalTileId, updates);
      }
    },
    
    // Plot tile specific actions
    initPlotTile: (tileName, initialState = {}) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if tileId is already hierarchical
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        storeInitPlotTile(hierarchicalTileId, initialState);
      }
    },
    
    updatePlotTile: (tileName, updates) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if tileId is already hierarchical
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        storeUpdatePlotTile(hierarchicalTileId, updates);
      }
    },
    
    // View tile specific actions
    initViewTile: (tileName, initialState = {}) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if tileId is already hierarchical
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        storeInitViewTile(hierarchicalTileId, initialState);
      }
    },
    
    updateViewTile: (tileName, updates) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if tileId is already hierarchical
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        storeUpdateViewTile(hierarchicalTileId, updates);
      }
    },

    // Editor tile specific actions
    initEditorTile: (tileName, initialState = {}) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if tileId is already hierarchical
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        storeInitEditorTile(hierarchicalTileId, initialState);
      }
    },
    
    updateEditorTile: (tileName, updates) => {
      if (activeProjectId && activeInterfaceId && tabId) {
        // Check if tileId is already hierarchical
        const hierarchicalTileId = tileName.includes('>')
          ? tileName
          : `${tabId}>${tileName}`;
        
        storeUpdateEditorTile(hierarchicalTileId, updates);
      }
    },

    // Helper methods for tiles
    getTileIds: () => tileIds,
    
    getTile: (tileName) => {
      // Check if tileId is already hierarchical
      const hierarchicalTileId = tileName.includes('>')
        ? tileName
        : `${tabId}>${tileName}`;
      
      return tiles[hierarchicalTileId] || null;
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
    items,
    activeProjectId,
    activeInterfaceId,
    setItems,
    storeUpdateTab,
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
          // Extract tile name from hierarchical ID
          const tileNameFromId = deconstructHierarchicalId(tile.id).name;
          
          // Get itemActions for this tile using our getter
          const itemActions = getTileItemActions(tileNameFromId, tabName, interfaceName, projectName);
          itemActions?.setItemsNeedRecompute(false);
        }
      });
    }
  }, [tabId, itemsNeedRecompute, tiles, dataActions, getTileItemActions, tabName, interfaceName, projectName]);

  return {
    data,
    dataActions,
  };
} 