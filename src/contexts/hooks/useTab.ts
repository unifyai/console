import { useMemo, useRef, useEffect } from 'react';
import { useStoreContext } from '../providers/StoreProvider';
import { Tab, TabMeta, TabData, TabUI } from '../slices/selectors/tab';
import { Tile } from '../slices/selectors/tile';
import { TabProps, TileProps } from '@/types/evals/grid';
import { useTileActions, TileActions } from './useTile';
import { useShallow } from 'zustand/react/shallow';
import { shallow } from 'zustand/vanilla/shallow';
import { constructHierarchicalId } from '../utils/sliceUtils';

// Define stable fallback references
const EMPTY_TILE_IDS: string[] = [];
const EMPTY_FOCUSED_TILE_NAMES: [string | undefined, string | undefined] = [undefined, undefined];
const EMPTY_TILE_PROPS: TileProps[] = [];
const EMPTY_TILES: Record<string, Tile> = {};
const DEFAULT_USE_TAB_RETURN = {
  tab: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  actions: null,
  exists: false
};

/**
 * Interface for tab meta-related actions
 */
export interface TabMetaActions {
  setName: (name: string) => void;
  setVisible: (visible: boolean) => void;
  setActive: (active: boolean) => void;
  setOrder: (order: number) => void;
  setTabCreated: (tabCreated: boolean) => void;
  setTempTabCreated: (tempTabCreated: boolean) => void;
}

/**
 * Interface for tab data-related actions
 */
export interface TabDataActions {
  setGlobalContext: (context: string | undefined) => void;
  setSavedTab: (savedTab: TabProps | null) => void;
  
  // Tile management
  initTile: (tileName: string, initialState?: { type?: 'Table' | 'Plot' | 'View' } & any) => void;
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
  
  // Helper methods for tiles
  getTileIds: () => string[];
  getTile: (tileName: string) => Tile | null;
  getTileActions: (tileName: string) => TileActions | null;
}

/**
 * Interface for tab UI-related actions
 */
export interface TabUIActions {
  setFocusedTileNames: (focusedTileNames: [string | undefined, string | undefined]) => void;
  setSaveSuccess: (saveSuccess?: boolean) => void;
  setResetting: (resetting: boolean) => void;
  setEdit: (edit: boolean) => void;
  setInteractive: (interactive: boolean) => void;
  setHelp: (help: boolean) => void;
  setCopied: (copied?: string) => void;
  setDeleting: (deleting: boolean) => void;
  setDataPending: (dataPending: boolean) => void;
  setPending: (pending: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setTilesPending: (pending: boolean) => void;
  setItemsNeedRecompute: (needsRecompute: boolean) => void;
  
  // Grid-related actions
  getItems: () => TileProps[];
  setItems: (items: TileProps[]) => void;
}

/**
 * Interface for all tab-related actions
 */
export interface TabActions {
  // Basic tab management
  initTab: (initialState?: Partial<Tab>) => void;
  updateTab: (updates: Partial<Tab>) => void;
  removeTab: () => void;
  
  // Categorized actions
  meta: TabMetaActions;
  data: TabDataActions;
  ui: TabUIActions;
}

/**
 * Custom hook to access tab state and actions
 * @param tabName The name of the tab to access
 * @param interfaceName Optional interface name (if not provided, active interface will be used)
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing tab state, actions, and existence flag
 */
export function useTab(
  tabName: string | null, 
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Call all hooks unconditionally at the top level
  
  // Get the tileActions hook at the top level
  const { getTileActions: tileActionsGetter } = useTileActions();
  
  // Get active project ID and interface ID if not provided
  const activeProjectId = useStoreContext(state => 
    projectName ? projectName : state.activeProjectId
  );
  
  const interfaceId = useStoreContext(state => 
    interfaceName ? interfaceName : state.activeInterfaceId
  );

  // Construct hierarchical interface ID if needed
  const activeInterfaceId = useMemo(() => {
    if (!interfaceId || !activeProjectId) return null;
    return interfaceId.includes('>') ? interfaceId : constructHierarchicalId(interfaceId, [activeProjectId]);
  }, [interfaceId, activeProjectId]);

  // Construct hierarchical ID if needed
  const tabId = useMemo(() => {
    if (!tabName || !activeInterfaceId) return null;
    
    // Check if the tabId already has the hierarchical format
    if (tabName.includes('>')) {
      return tabName;
    }
    
    // Otherwise, construct it
    return constructHierarchicalId(tabName, [activeInterfaceId]);
  }, [tabName, activeInterfaceId]);
  
  // Check if tab exists
  const tabExists = useStoreContext(state => {
    if (!tabId) return false;
    return !!state.tabsById[tabId];
  });

  // Granular subscriptions to Meta properties
  const id = tabId;

  const name = useStoreContext(state => {
    if (!tabExists || !tabId) return '';
    return state.tabsById[tabId].name;
  });
  
  const visible = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].visible;
  });
  
  const active = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].active;
  });
  
  const order = useStoreContext(state => {
    if (!tabExists || !tabId) return 0;
    return state.tabsById[tabId].order;
  });
  
  const tabCreated = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].tabCreated;
  });
  
  const tempTabCreated = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].tempTabCreated;
  });

  // Granular subscriptions to Data properties
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
  
  const tileIds = useStoreContext(
    useShallow(state => {
      if (!tabExists || !tabId) return EMPTY_TILE_IDS;
      return state.tabsById[tabId].tileIds;
    })
  );

  // Granular subscriptions to UI properties
  const projectIdFromState = useStoreContext(state => {
    if (!tabExists || !tabId) return null;
    return state.tabsById[tabId].projectId;
  });
  
  const interfaceIdFromState = useStoreContext(state => {
    if (!tabExists || !tabId) return null;
    return state.tabsById[tabId].interfaceId;
  });
  
  const focusedTileNames = useStoreContext(
    useShallow(state => {
      if (!tabExists || !tabId) return EMPTY_FOCUSED_TILE_NAMES;
      return state.tabsById[tabId].focusedTileNames;
    })
  );
  
  const saveSuccess = useStoreContext(state => {
    if (!tabExists || !tabId) return undefined;
    return state.tabsById[tabId].saveSuccess;
  });
  
  const resetting = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].resetting;
  });
  
  const edit = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].edit;
  });
  
  const interactive = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].interactive;
  });
  
  const help = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].help;
  });
  
  const copied = useStoreContext(state => {
    if (!tabExists || !tabId) return undefined;
    return state.tabsById[tabId].copied;
  });
  
  const deleting = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].deleting;
  });
  
  const dataPending = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].dataPending;
  });
  
  const pending = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].pending;
  });
  
  const refreshing = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].refreshing;
  });

  const itemsNeedRecompute = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].itemsNeedRecompute;
  });

  // Get all tab-related tiles
  const tiles = useMemo(() => {
    if (!tabExists || !tabId || !tileIds.length) return EMPTY_TILES;
    
    // We only need the tile IDs and some partial Tile state here
    // The actual tile data will be accessed through the tile-specific hooks
    const tileMap: Record<string, Tile> = {};
    
    tileIds.forEach(tileId => {
      const tileActions = tileActionsGetter(tileId, tabId);
      if (tileActions) {
        const tileItem = tileActions.asTileItem();
        tileMap[tileId] = {
          id: tileId,
          name: tileItem.i,
          table: tileItem.table,
          // Include other necessary tile properties
        } as Tile;
      }
    });
    
    return tileMap;
  }, [tabExists, tabId, tileIds, tileActionsGetter]);

  // Create the grid items array with useMemo
  const itemsRef = useRef<TileProps[]>([]);
  const items = useMemo<TileProps[]>(() => {
    // If no tab or tiles, return an empty array
    if (!tabExists || !tabId || !tileIds.length) return EMPTY_TILE_PROPS;

    // Build the array from each tile ID
    const newItems = tileIds.map(tileId => {
      // Get actions for this tile
      const tileActions = tileActionsGetter(tileId, tabId);
      
      // Call `asTileItem()` or use a fallback
      return tileActions?.asTileItem() || {
        i: tileId,
        x: 0,
        y: 0,
        w: 1,
        h: 1
      } as TileProps;
    });

    // If the items are the same, return the old reference to prevent re-renders
    if (shallow(itemsRef.current, newItems)) {
      return itemsRef.current;
    }
    
    // Update the ref and return the new items
    itemsRef.current = newItems;
    return newItems;
  }, [tabExists, tabId, tileIds, tileActionsGetter, itemsNeedRecompute]);

  // Get all the tab store actions
  const storeInitTab = useStoreContext(state => state.initTab);
  const storeUpdateTab = useStoreContext(state => state.updateTab);
  const storeRemoveTab = useStoreContext(state => state.removeTab);
  
  // Get action functions for tile management
  const storeInitTile = useStoreContext(state => state.initTile);
  const storeAddTile = useStoreContext(state => state.addTile);
  const storeRemoveTile = useStoreContext(state => state.removeTile);
  const storeRenameTile = useStoreContext(state => state.renameTile);
  const storeUpdateTile = useStoreContext(state => state.updateTile);
  
  // Get action functions for table tile management
  const storeInitTableTile = useStoreContext(state => state.initTableTile);
  const storeUpdateTableTile = useStoreContext(state => state.updateTableTile);
  
  // Get action functions for plot tile management
  const storeInitPlotTile = useStoreContext(state => state.initPlotTile);
  const storeUpdatePlotTile = useStoreContext(state => state.updatePlotTile);
  
  // Get action functions for view tile management
  const storeInitViewTile = useStoreContext(state => state.initViewTile);
  const storeUpdateViewTile = useStoreContext(state => state.updateViewTile);

  // Reset the itemsNeedRecompute flag after computing items
  useEffect(() => {
    if (tabId && itemsNeedRecompute) {
      // Reset the flag on the tab
      storeUpdateTab(tabId, { itemsNeedRecompute: false });
      
      // Also reset the flag on all tiles in this tab
      tileIds.forEach(tileId => {
        const hierarchicalTileId = tileId.includes('>')
          ? tileId
          : `${tabId}>${tileId}`;
        
        storeUpdateTile(hierarchicalTileId, { itemsNeedRecompute: false });
      });
    }
  }, [tabId, itemsNeedRecompute, tileIds, storeUpdateTab, storeUpdateTile]);

  // Memoize the meta object to prevent unnecessary rerenders
  const meta = useMemo<Partial<TabMeta> | null>(() => {
    if (!tabExists) return null;
    
    return {
      id: id!,
      name: name || null,
      visible,
      active,
      order,
      tabCreated,
      tempTabCreated
    };
  }, [
    tabExists, 
    id, 
    name, 
    visible, 
    active, 
    order, 
    tabCreated, 
    tempTabCreated
  ]);
  
  // Memoize the data object to prevent unnecessary rerenders
  const data = useMemo<Partial<TabData> | null>(() => {
    if (!tabExists) return null;
    
    return {
      globalContext,
      savedTab,
      tileIds
    };
  }, [tabExists, globalContext, savedTab, tileIds]);
  
  // Memoize the UI state object to prevent unnecessary rerenders
  const ui = useMemo<Partial<TabUI> | null>(() => {
    if (!tabExists) return null;
    
    return {
      projectId: projectIdFromState,
      interfaceId: interfaceIdFromState,
      focusedTileNames: focusedTileNames,
      saveSuccess,
      resetting,
      edit,
      interactive,
      help,
      copied,
      deleting,
      dataPending,
      pending,
      refreshing
    };
  }, [
    tabExists,
    projectIdFromState,
    interfaceIdFromState,
    focusedTileNames,
    saveSuccess,
    resetting,
    edit,
    interactive,
    help,
    copied,
    deleting,
    dataPending,
    pending,
    refreshing
  ]);

  // Memoize the meta actions to prevent unnecessary re-renders
  const metaActions = useMemo<TabMetaActions>(() => ({
    setName: (name) => {
      if (tabId) {
        storeUpdateTab(tabId, { name });
      }
    },
    
    setVisible: (visible) => {
      if (tabId) {
        storeUpdateTab(tabId, { visible });
      }
    },
    
    setActive: (active) => {
      if (tabId) {
        storeUpdateTab(tabId, { active });
      }
    },
    
    setOrder: (order) => {
      if (tabId) {
        storeUpdateTab(tabId, { order });
      }
    },
    
    setTabCreated: (tabCreated) => {
      if (tabId) {
        storeUpdateTab(tabId, { tabCreated });
      }
    },
    
    setTempTabCreated: (tempTabCreated) => {
      if (tabId) {
        storeUpdateTab(tabId, { tempTabCreated });
      }
    }
  }), [tabId, storeUpdateTab]);
  
  // Memoize the data actions to prevent unnecessary re-renders
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
    
    // Helper methods for tiles
    getTileIds: () => tileIds,
    
    getTile: (tileName) => {
      // Check if tileId is already hierarchical
      const hierarchicalTileId = tileName.includes('>')
        ? tileName
        : `${tabId}>${tileName}`;
      
      return tiles[hierarchicalTileId] || null;
    },
    
    getTileActions: (tileName) => {
      if (!tabId) return null;
      
      // Check if tileId is already hierarchical
      const hierarchicalTileId = tileName.includes('>')
        ? tileName
        : `${tabId}>${tileName}`;
      
      return tileActionsGetter(hierarchicalTileId, tabId);
    }
  }), [
    tabId,
    tiles,
    tileIds,
    activeProjectId,
    activeInterfaceId,
    tileActionsGetter,
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
    storeUpdateViewTile
  ]);
  
  // Memoize the UI actions to prevent unnecessary re-renders
  const uiActions = useMemo<TabUIActions>(() => ({
    setFocusedTileNames: (focusedTileNames) => {
      if (tabId) {
        storeUpdateTab(tabId, { focusedTileNames: focusedTileNames });
      }
    },
    
    setSaveSuccess: (saveSuccess) => {
      if (tabId) {
        storeUpdateTab(tabId, { saveSuccess });
      }
    },
    
    setResetting: (resetting) => {
      if (tabId) {
        storeUpdateTab(tabId, { resetting });
      }
    },
    
    setEdit: (edit) => {
      if (tabId) {
        storeUpdateTab(tabId, { edit });
      }
    },
    
    setInteractive: (interactive) => {
      if (tabId) {
        storeUpdateTab(tabId, { interactive });
      }
    },
    
    setHelp: (help) => {
      if (tabId) {
        storeUpdateTab(tabId, { help });
      }
    },
    
    setCopied: (copied) => {
      if (tabId) {
        storeUpdateTab(tabId, { copied });
      }
    },
    
    setDeleting: (deleting) => {
      if (tabId) {
        storeUpdateTab(tabId, { deleting });
      }
    },
    
    setDataPending: (dataPending) => {
      if (tabId) {
        storeUpdateTab(tabId, { dataPending });
      }
    },
    
    setPending: (pending) => {
      if (tabId) {
        storeUpdateTab(tabId, { pending });
      }
    },
    
    setRefreshing: (refreshing) => {
      if (tabId) {
        storeUpdateTab(tabId, { refreshing });
      }
    },
    
    setTilesPending: (pending) => {
      if (tabId && tileIds.length) {
        // Update all tiles in the tab
        tileIds.forEach(tileId => {
          const hierarchicalTileId = tileId.includes('>')
            ? tileId
            : `${tabId}>${tileId}`;
          
          storeUpdateTile(hierarchicalTileId, { pending });
        });
      }
    },
    
    setItemsNeedRecompute: (itemsNeedRecompute) => {
      if (tabId) {
        storeUpdateTab(tabId, { itemsNeedRecompute });
      }
    },
    
    // Grid-related methods
    getItems: () => items,
    
    setItems: (newItems) => {
      if (tabId && tileIds.length) {
        // Update each tile's position based on the grid items
        newItems.forEach(item => {
          const tileItemName = item.i;
          const hierarchicalTileId = tileItemName.includes('>')
            ? tileItemName
            : `${tabId}>${tileItemName}`;
          
          // Grab the tile actions for that tile
          const tileActions = tileActionsGetter(hierarchicalTileId, tabId);
          if (tileActions?.fromTileItem) {
            tileActions.fromTileItem(item);
          }
        });
      }
    }
  }), [
    activeProjectId,
    activeInterfaceId,
    tabId,
    tileIds,
    items,
    storeUpdateTab,
    storeUpdateTile
  ]);
  
  // Memoize all actions to prevent unnecessary re-renders
  const actions = useMemo<TabActions>(() => {
    return {
      // Basic tab management
      initTab: (initialState) => {
        if (activeProjectId && activeInterfaceId && tabId) {
          storeInitTab(activeInterfaceId, tabId, {
            id: tabId,
            projectId: activeProjectId,
            interfaceId: activeInterfaceId,
            ...initialState
          });
        }
      },
      
      updateTab: (updates) => {
        if (tabId) {
          storeUpdateTab(tabId, updates);
        }
      },
      
      removeTab: () => {
        if (activeInterfaceId && tabId) {
          storeRemoveTab(activeInterfaceId, tabId);
        }
      },
      
      // Categorized actions
      meta: metaActions,
      data: dataActions,
      ui: uiActions,
    };
  }, [
    activeProjectId,
    activeInterfaceId,
    tabId,
    storeInitTab,
    storeUpdateTab,
    storeRemoveTab,
    metaActions,
    dataActions,
    uiActions
  ]);
  
  // Build a final 'tab' object from the separate meta, data, and UI objects
  const tabObj = useMemo<Partial<Tab> | null>(() => {
    if (!meta || !data || !ui) return null;
    
    return {
      ...meta,
      ...data,
      ...ui
    };
  }, [meta, data, ui]);

  // Use tabId to conditionally return values, but only after all hooks are called
  if (tabName === null) {
    return DEFAULT_USE_TAB_RETURN;
  }

  return {
    tab: tabObj,
    meta,
    data,
    ui,
    metaActions,
    dataActions,
    uiActions,
    actions,
    exists: tabExists
  };
}