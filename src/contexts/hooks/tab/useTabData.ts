import { useMemo, useRef, useCallback, useEffect } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { TabData } from '../../slices/selectors/tab';
import { Tile } from '../../slices/selectors/tile';
import { TileLayout, TilePosition, TileProps } from '@/types/evals/grid';
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
const EMPTY_TILE_PENDING: boolean[] = [];
const EMPTY_TILE_LOADING: boolean[] = [];

/**
 * Interface for tab data-related actions
 */
export interface TabDataActions {
  setGlobalContext: (context: string | undefined) => void;
  removeContextFromTab: (context: string) => void;

  // Tile management
  initTile: (tileName: string, initialState?: Partial<Tile>) => void;
  pasteCopiedTile: (newTileName: string, sourceTileName: string, initialState?: Partial<Tile>) => void;
  removeTile: (tileId: string) => void;
  updateTile: (tileId: string, updates: Partial<Tile>) => void;
  updateTileLayout: (tileId: string, layout: TileLayout) => void;
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
  getTileId: (tileName: string) => string | null;
  getTileName: (tileId: string) => string | null;
  getTileIds: () => string[];
  getTileNames: () => string[];
  getPartialTile: (tileIdOrName: string) => Partial<Tile> | null;
  getTileNamesByType: (tileType: string) => string[];
  getTileIdsByType: (tileType: string) => string[];
  getVisibleTiles: () => Partial<Tile>[];
  getHiddenTiles: () => Partial<Tile>[];
  getReferencedTileIdsByName: (tileName: string) => string[];
  getReferencedPlotTileIdsByName: (tileName: string) => {
    xAxis: string[];
    yAxis: string[];
    plotGroupBy: string[];
  };
  
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
  const { tabId, tabExists } = useTabMeta(tabIdOrName, interfaceIdOrName);

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

  const itemsNeedRecompute = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].itemsNeedRecompute;
  });

  const tiles = useMemo(() => {
    if (!tabExists || !tabId || !tileIds.length) return EMPTY_TILES;
    
    // We only need the tile IDs and some partial Tile state here
    // The actual tile data will be accessed through the tile-specific hooks
    const tileMap: Record<string, Partial<Tile>> = {};
    
    // Use tileIds and tileNames arrays which should have corresponding indices
    tileIds.forEach((tileId, index) => {
      
      if (tileId) {
        const itemActions = getTileItemActions(tileId, tabIdOrName);
        
        if (itemActions) {
          const tileItem = itemActions.asTileItem();
          tileMap[tileId] = {
            id: tileId,
            name: tileItem.name,
            position: {
              x: tileItem.x,
              y: tileItem.y,
              width: tileItem.w,
              height: tileItem.h,
            },
            type: tileItem.tab,
            table: tileItem.table,
            visible: tileItem.visible,
            color: tileItem.color,
            context: tileItem.context,
            column_context: tileItem.column_context,
            grouping: tileItem.grouping,
            plot_tile: {
              plot_type: tileItem.plot_type,
              x_axis: tileItem.x_axis,
              y_axis: tileItem.y_axis,
              plot_group_by: tileItem.plot_group_by,
              regression_line: tileItem.regression_line,
            },
            table_tile: {
              column_order: tileItem.column_order,
              hidden_columns: tileItem.hidden_columns,
              sorting: tileItem.sorting,
              group_sorting: tileItem.group_sorting,
              columns_pin_left: tileItem.columns_pin_left,
              columns_pin_right: tileItem.columns_pin_right,
              selected: tileItem.selected,
            },
            editor_tile: {
              file_name: tileItem.file_name,
              file_type: tileItem.file_type,
              content: tileItem.content,
            },
            view_tile: {
              base_index: tileItem.base_index,
            },
            itemsNeedRecompute: itemActions.getItemsNeedRecompute(),
            // Include other necessary tile properties
          } as Partial<Tile>;
        }
      }
    });
    
    return tileMap;
  }, [tabExists, tabId, tileIds, itemsNeedRecompute, getTileItemActions, tabIdOrName]);

  // Create the grid items array with useMemo
  const itemsRef = useRef<TileProps[]>([]);
  const items = useMemo<TileProps[]>(() => {
    // If no tab or tiles, return an empty array
    if (!tabExists || !tabId || !Object.keys(tiles).length) return EMPTY_TILE_PROPS;

    // Build the array from each tile ID
    const newItems = Object.values(tiles).map(tile => {
      // Get itemActions for this tile using its name
      const itemActions = getTileItemActions(tile.id || '', tabIdOrName);
      
      // Call `asTileItem()` or use a fallback
      return itemActions?.asTileItem() || {
        name: tile.name,
        x: 0,
        y: 0,
        w: 4,
        h: 4
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
  const storePasteCopiedTile = useStoreContext(state => state.pasteCopiedTile);
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
    initTile: (tileName, initialState = {}) => {
      if (tabId) {
        // Initialize the tile with proper IDs
        storeInitTile(
          tabId,
          initialState?.id || tileName,
          {
            ...initialState,
            id: initialState?.id || tileName,
            name: tileName,
          }
        );
      }
    },

    pasteCopiedTile: (newTileName, sourceTileName, initialState = {}) => {
      if (tabId && newTileName && sourceTileName) {
        // Get the initialState from the fromTileName tile
        const sourceTileId = dataActions.getTileId(sourceTileName) || '';

        if (!sourceTileId) {
          console.error(`Source tile ${sourceTileName} not found`);
          return;
        }

        // Add the tile with proper IDs
        storePasteCopiedTile(
          tabId, 
          sourceTileId,
          initialState?.id || newTileName,
          {
            ...initialState,
            name: newTileName,
            id: initialState?.id || newTileName,
          }
        );
      }
    },
    
    removeTile: (tileId) => {
      if (tabId && tileId) {
        storeRemoveTile(tabId, tileId);
      }
    },
    
    updateTile: (tileId, updates) => {
      if (tileId) {
        storeUpdateTile(tileId, updates);
      }
    },

    updateTileLayout: (tileId, layout) => {
      if (tileId) {
        // Unpack the layout object into a Partial<Tile> object
        const updates: Partial<Tile> = {
          position: {
            x: layout.x,
            y: layout.y,
            width: layout.w,
            height: layout.h,
          } as TilePosition,
          minW: layout.minW,
          minH: layout.minH,
          moved: layout.moved,
          static: layout.static,
        };
        storeUpdateTile(tileId, updates);
      }
    },
    
    renameTile: (tileId, newTileName) => {
      if (tabId && tileId) {
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
      if (tabId && tileId) {
        storeInitTableTile(tileId, initialState);
      }
    },
    
    updateTableTile: (tileId, updates) => {
      if (tabId && tileId) {
        storeUpdateTableTile(tileId, updates);
      }
    },
    
    // Plot tile specific actions
    initPlotTile: (tileId, initialState = {}) => {
      if (tabId && tileId) {
        storeInitPlotTile(tileId, initialState);
      }
    },
    
    updatePlotTile: (tileId, updates) => {
      if (tabId && tileId) {
        storeUpdatePlotTile(tileId, updates);
      }
    },
    
    // View tile specific actions
    initViewTile: (tileId, initialState = {}) => {
      if (tabId && tileId) {
        storeInitViewTile(tileId, initialState);
      }
    },
    
    updateViewTile: (tileId, updates) => {
      if (tabId && tileId) {
        storeUpdateViewTile(tileId, updates);
      }
    },

    // Editor tile specific actions
    initEditorTile: (tileId, initialState = {}) => {
      if (tabId && tileId) {
        storeInitEditorTile(tileId, initialState);
      }
    },
    
    updateEditorTile: (tileId, updates) => {
      if (tabId && tileId) {
        storeUpdateEditorTile(tileId, updates);
      }
    },

    // Helper methods for tiles
    getTileIds: () => tileIds,

    getTileNames: () => tileNames,

    getTileId: (tileName: string) => {
      return tileIds.find(id => tiles[id]?.name === tileName) || null;
    },

    getTileName: (tileId: string) => {
      return tileNames.find(name => tiles[tileId]?.name === name) || null;
    },
    
    getPartialTile: (tileIdOrName) => {
      // First try direct lookup by ID
      if (tiles[tileIdOrName]) {
        return tiles[tileIdOrName];
      }
      
      // If not found by ID, try looking up by name
      const tileByName = Object.values(tiles).find(tile => tile.name === tileIdOrName);
      return tileByName || null;
    },

    getTileNamesByType: (tileType: string) => {
      // Get names for all tiles that have type `tileType`
      return tileIds.filter(id => tiles[id]?.type === tileType).map(id => tiles[id]?.name || '');
    },

    getTileIdsByType: (tileType: string) => {
      // Get IDs for all tiles that have type `tileType`
      return tileIds.filter(id => tiles[id]?.type === tileType);
    },

    getVisibleTiles: () => {
      // Get all visible tiles
      return Object.values(tiles).filter(tile => tile.visible === true);
    },

    getHiddenTiles: () => {
      // Get all hidden tiles
      return Object.values(tiles).filter(tile => tile.visible === false);
    },

    getReferencedTileIdsByName: (tileName: string) => {
      // Retrieve all tile ids for which the `tile.table` property matches the given tile name
      return tileIds.filter(id => tiles[id]?.table === tileName);
    },

    getReferencedPlotTileIdsByName: (tileName: string) => {
      // Retrieve all tile ids for which the `tile.plotTile.x_axis` property matches the given tile name
      const referencedByXAxis = tileIds.filter(id => tiles[id]?.plotTile?.x_axis?.includes(tileName + "."));
      const referencedByYAxis = tileIds.filter(id => tiles[id]?.plotTile?.y_axis?.includes(tileName + "."));
      const referencedByPlotGroupBy = tileIds.filter(id => tiles[id]?.plotTile?.plot_group_by?.includes(tileName + "."));
      return {
        xAxis: referencedByXAxis,
        yAxis: referencedByYAxis,
        plotGroupBy: referencedByPlotGroupBy
      };
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
    setItems,
    storeUpdateTab,
    storeRemoveContextFromTab,
    storeInitTile,
    storePasteCopiedTile,
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
          const itemActions = getTileItemActions(tile.name || '', tabIdOrName);
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