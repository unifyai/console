import { useMemo, useRef } from 'react';
import { useStoreContext } from '../providers/StoreProvider';
import { Tab } from '../slices/selectors/tab';
import { Tile } from '../slices/selectors/tile';
import { TileProps } from '@/types/evals/grid';
import { useTileActions, TileActions } from './useTile';
import { useShallow } from 'zustand/react/shallow';
import { shallow } from 'zustand/vanilla/shallow';

// Define stable fallback references
const EMPTY_TILES: Record<string, Tile> = {};
const EMPTY_TILE_IDS = [undefined, undefined] as [string|undefined, string|undefined];
const DEFAULT_USE_TAB_RETURN = {
  tab: null,
  actions: null,
  exists: false
};

/**
 * Interface for tab-related actions
 */
export interface TabActions {
  // Basic tab management
  initTab: (initialState?: Partial<Tab>) => void;
  updateTab: (updates: Partial<Tab>) => void;
  removeTab: () => void;
  
  // Property setters
  setName: (name: string) => void;
  setVisible: (visible: boolean) => void;
  setActive: (active: boolean) => void;
  setOrder: (order: number) => void;
  setContext: (context: string | undefined) => void;
  
  // UI state property setters
  setSaveSuccess: (saveSuccess?: boolean) => void;
  setResetting: (resetting: boolean) => void;
  setEdit: (edit: boolean) => void;
  setInteractive: (interactive: boolean) => void;
  setCopied: (copied?: string) => void;
  setDeleting: (deleting: boolean) => void;
  setDataPending: (dataPending: boolean) => void;
  setPending: (pending: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setTempTabCreated: (tempTabCreated: boolean) => void;
  setFocusedTileIds: (focusedTileIds: [string | undefined, string | undefined]) => void;
  
  // Tile management
  initTile: (tileId: string, initialState?: { type?: 'Table' | 'Plot' | 'View' } & any) => void;
  removeTile: (tileId: string) => void;
  updateTile: (tileId: string, updates: any) => void;
  renameTile: (tileId: string, newName: string) => void;
  
  // Table tile specific actions
  initTableTile: (tileId: string, initialState?: any) => void;
  updateTableTile: (tileId: string, updates: any) => void;
  
  // Plot tile specific actions
  initPlotTile: (tileId: string, initialState?: any) => void;
  updatePlotTile: (tileId: string, updates: any) => void;
  
  // View tile specific actions
  initViewTile: (tileId: string, initialState?: any) => void;
  updateViewTile: (tileId: string, updates: any) => void;
  
  // Helper methods
  getTiles: () => Tile[];
  getTileIds: () => string[];
  getTile: (tileId: string) => Tile | null;
  getTileActions: (tileId: string) => TileActions | null;
  getItems: () => TileProps[];
  setItems: (items: TileProps[]) => void;
}

/**
 * Custom hook to access tab state and actions
 * @param tabId The ID of the tab to access
 * @param interfaceId Optional interface ID (if not provided, active interface will be used)
 * @param projectId Optional project ID (if not provided, active project will be used)
 * @returns Object containing tab state, actions, and existence flag
 */
export function useTab(
  tabId: string | null, 
  interfaceId?: string | null,
  projectId?: string | null
) {
  // Always call hooks at the top level, unconditionally
  
  // Get the tileActions hook at the top level
  const { getTileActions: tileActionsGetter } = useTileActions();
  
  // Get active project ID and interface ID if not provided
  const activeProjectId = useStoreContext(state => 
    projectId !== undefined ? projectId : state.activeProjectId
  );
  
  const activeInterfaceId = useStoreContext(state => 
    interfaceId !== undefined ? interfaceId : state.activeInterfaceId
  );
  
  // Check if tab exists
  const hasTab = useStoreContext((state) => {
    if (!tabId || !activeProjectId || !activeInterfaceId) return false;
    return !!state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId];
  });

  // Subscribe to individual tab properties for more granular updates
  const name = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return '';
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].name;
  });
  const visible = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].visible;
  });
  const active = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].active;
  });
  const order = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return 0;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].order;
  });
  const context = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].context;
  });
  const tabCreated = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].tabCreated;
  });
  const tempTabCreated = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].tempTabCreated;
  });
  const savedTab = useStoreContext(
    useShallow((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return null;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].savedTab;
  }));
  const focusedTileIds = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return EMPTY_TILE_IDS;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].focusedTileIds;
  });
  const tiles = useStoreContext(
    useShallow((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return EMPTY_TILES;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].tiles;
  }));
  const saveSuccess = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].saveSuccess;
  });
  const resetting = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].resetting;
  });
  const edit = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].edit;
  });
  const interactive = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].interactive;
  });
  const copied = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].copied;
  });
  const deleting = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].deleting;
  });
  const dataPending = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].dataPending;
  });
  const pending = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].pending;
  });
  const refreshing = useStoreContext((state) => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[tabId].refreshing;
  });

  // Create the items array once with useMemo
  const itemsRef = useRef<TileProps[]>([]);
  const items = useMemo<TileProps[]>(() => {
    // If no tiles, return an empty array
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return [];

    // Build the array from each tile
    const newItems = Object.values(tiles || {}).map((tile) => {
      // get actions once
      const tileActions = tileActionsGetter(tile.id, tabId, activeInterfaceId, activeProjectId);
      // call `asTileItem()` or fallback
      return tileActions?.asTileItem() || {
        i: tile.id,
        x: 0,
        y: 0,
        w: 1,
        h: 1
      } as TileProps;
    });

    // If the items are the same, return the old reference
    if (shallow(itemsRef.current, newItems)) {
      return itemsRef.current;
    }
    itemsRef.current = newItems;
    return newItems;
  }, [tiles, tabId, activeInterfaceId, activeProjectId, hasTab, tileActionsGetter]);

  // Get all the tab store actions
  const storeInitTab = useStoreContext(state => state.initTab);
  const storeUpdateTab = useStoreContext(state => state.updateTab);
  const storeRemoveTab = useStoreContext(state => state.removeTab);
  
  // Get action functions for tile management
  const storeInitTile = useStoreContext(state => state.initTile);
  const storeRemoveTile = useStoreContext(state => state.removeTile);
  const storeUpdateTile = useStoreContext(state => state.updateTile);
  
  // Get action functions for table tile management
  const storeInitTableTile = useStoreContext(state => state.initTableTileData);
  const storeUpdateTableTile = useStoreContext(state => state.updateTableTileData);
  
  // Get action functions for plot tile management
  const storeInitPlotTile = useStoreContext(state => state.initPlotTileData);
  const storeUpdatePlotTile = useStoreContext(state => state.updatePlotTileData);
  
  // Get action functions for view tile management
  const storeInitViewTile = useStoreContext(state => state.initViewTileData);
  const storeUpdateViewTile = useStoreContext(state => state.updateViewTileData);

  // Define actions using useMemo and returning the appropriate actions object
  const actions = useMemo<TabActions>(() => {
    return {
      // Basic tab management
      initTab: (initialState) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeInitTab(activeProjectId, activeInterfaceId, tabId, initialState);
        }
      },
      
      updateTab: (updates) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, updates);
        }
      },
      
      removeTab: () => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeRemoveTab(activeProjectId, activeInterfaceId, tabId);
        }
      },
      
      // Property setters
      setName: (name) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { name });
        }
      },
      
      setVisible: (visible) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { visible });
        }
      },
      
      setActive: (active) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { active });
        }
      },
      
      setOrder: (order) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { order });
        }
      },
      
      setContext: (context) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { context });
        }
      },
      
      // UI state property setters
      setSaveSuccess: (saveSuccess) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { saveSuccess });
        }
      },
      
      setResetting: (resetting) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { resetting });
        }
      },
      
      setEdit: (edit) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { edit });
        }
      },
      
      setInteractive: (interactive) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { interactive });
        }
      },
      
      setCopied: (copied) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { copied });
        }
      },
      
      setDeleting: (deleting) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { deleting });
        }
      },
      
      setDataPending: (dataPending) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { dataPending });
        }
      },
      
      setPending: (pending) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { pending });
        }
      },
      
      setRefreshing: (refreshing) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { refreshing });
        }
      },
      
      setTempTabCreated: (tempTabCreated) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { tempTabCreated });
        }
      },
      
      setFocusedTileIds: (focusedTileIds) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { focusedTileIds });
        }
      },

      // Tile management
      initTile: (tileId, initialState) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          // Just pass the initialState directly - type should be included in it
          storeInitTile(activeProjectId, activeInterfaceId, tabId, tileId, initialState);

          // Initialize specific tile data based on type
          if (initialState?.type === 'Table') {
            storeInitTableTile(activeProjectId, activeInterfaceId, tabId, tileId);
          } else if (initialState?.type === 'Plot') {
            storeInitPlotTile(activeProjectId, activeInterfaceId, tabId, tileId);
          } else if (initialState?.type === 'View') {
            storeInitViewTile(activeProjectId, activeInterfaceId, tabId, tileId);
          }
        }
      },
      
      removeTile: (tileId) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeRemoveTile(activeProjectId, activeInterfaceId, tabId, tileId);
        }
      },
      
      // A specialized method for renaming tiles and updating references in one operation
      renameTile: (tileId: string, newName: string) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          // We'll need to update all tiles that reference this one
          Object.entries(tiles).forEach(([id, tile]) => {
            if (id === tileId) {
              // If this is the tile being renamed, update its name
              storeUpdateTile(activeProjectId, activeInterfaceId, tabId, id, {
                id: newName,
                name: newName 
              });
            }
            else if (tile.table === tileId) {
              // If this is a tile that references the renamed tile, update the reference
              storeUpdateTile(activeProjectId, activeInterfaceId, tabId, id, {
                table: newName 
              });
            }
          });
        }
      },
      
      updateTile: (tileId, updates) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTile(activeProjectId, activeInterfaceId, tabId, tileId, updates);
        }
      },
      
      // Table tile specific actions
      initTableTile: (tileId, initialState) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeInitTableTile(activeProjectId, activeInterfaceId, tabId, tileId, initialState);
        }
      },
      
      updateTableTile: (tileId, updates) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateTableTile(activeProjectId, activeInterfaceId, tabId, tileId, updates);
        }
      },
      
      // Plot tile specific actions
      initPlotTile: (tileId, initialState) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeInitPlotTile(activeProjectId, activeInterfaceId, tabId, tileId, initialState);
        }
      },
      
      updatePlotTile: (tileId, updates) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdatePlotTile(activeProjectId, activeInterfaceId, tabId, tileId, updates);
        }
      },

      // View tile specific actions
      initViewTile: (tileId, initialState) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeInitViewTile(activeProjectId, activeInterfaceId, tabId, tileId, initialState);
        }
      },

      updateViewTile: (tileId, updates) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeUpdateViewTile(activeProjectId, activeInterfaceId, tabId, tileId, updates);
        }
      },

      // Helper methods
      getTiles: () => {
        if (!hasTab || !tiles) return [];
        return Object.values(tiles);
      },

      getTileIds: () => {
        if (!hasTab || !tiles) return [];
        return Object.keys(tiles);
      },

      getTile: (tileId) => {
        if (!hasTab || !tiles) return null;
        return tiles[tileId] || null;
      },

      // Use the getTileActions hook directly
      getTileActions: (tileId: string) => {
        return tileActionsGetter(tileId, tabId, activeInterfaceId, activeProjectId);
      },

      // Modified to use the tileActionsGetter
      getItems: () => items,

      // Modified to use the tileActionsGetter
      setItems: (newItems: TileProps[]) => {
        // For each item, figure out the tile ID (item.i)
        newItems.forEach((item) => {
          const tileId = item.i;
          // Grab the tile actions for that tile
          const tileActions = tileActionsGetter(tileId, tabId, activeInterfaceId, activeProjectId);
          if (tileActions?.fromTileItem) {
            tileActions.fromTileItem(item);
          }
        });
      }
    };
  }, [
    activeProjectId,
    activeInterfaceId,
    tabId,
    hasTab,
    tiles,
    items,
    storeInitTab,
    storeUpdateTab,
    storeRemoveTab,
    storeInitTile,
    storeRemoveTile,
    storeUpdateTile,
    storeInitTableTile,
    storeUpdateTableTile,
    storeInitPlotTile,
    storeUpdatePlotTile,
    storeInitViewTile,
    storeUpdateViewTile,
    tileActionsGetter
  ]);
  
  // Construct a final "tab" object from the narrower fields
  const finalTab = useMemo(() => {
    if (!hasTab) return null;
    return {
      id: tabId,
        name,
        visible,
        active,
        order,
        context,
        tabCreated,
        tempTabCreated,
        savedTab,
        focusedTileIds,
        tiles,
        saveSuccess,
        resetting,
        edit,
        interactive,
        copied,
        deleting,
        dataPending,
        pending,
        refreshing,
      } as Tab;
  }, [
      hasTab, tabId, name, visible, active, order, context, tabCreated,
      tempTabCreated, savedTab, focusedTileIds, tiles, saveSuccess,
      resetting, edit, interactive, copied, deleting, dataPending,
      pending, refreshing
    ]);

  // Because hooks should be called unconditionally, we'll return values based on tabId
  if (tabId === null) {
    return DEFAULT_USE_TAB_RETURN;
  }
  
  return {
    tab: finalTab,
    actions,
    exists: hasTab
  };
}