import { useMemo } from 'react';
import { useStoreContext } from '../providers/StoreProvider';
import { Tab } from '../slices/selectors/tab';
import { TileProps } from '@/types/evals/grid';
import { useTile, TileActions } from './useTile';
import { Tile } from '../slices/selectors/tile';

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
  setContext: (context: string) => void;
  
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
  getItems: () => TileProps[];
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
  // Always call hooks at the top level of the component, unconditionally
  
  // Get active project ID and interface ID if not provided
  const activeProjectId = useStoreContext(state => 
    projectId !== undefined ? projectId : state.activeProjectId
  );
  
  const activeInterfaceId = useStoreContext(state => 
    interfaceId !== undefined ? interfaceId : state.activeInterfaceId
  );

  // Check if tab exists - but still call this hook unconditionally
  const hasTab = useStoreContext(state => {
    if (!tabId || !activeProjectId || !activeInterfaceId) return false;
    const proj = state.projectsById[activeProjectId];
    if (!proj || !proj.interfaces || !proj.interfaces[activeInterfaceId]) return false;
    const iface = proj.interfaces[activeInterfaceId];
    return !!(iface && iface.tabs && iface.tabs[tabId]);
  });

  // Instead of subscribing to the entire interface object,
  // we subscribe to individual properties. This way, changes in
  // unrelated fields won't cause a new reference for everything.
  // These must all be called unconditionally too
  const name = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return "";
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.name || "";
  });

  const visible = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.visible || false;
  });

  const active = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.active || false;
  });

  const order = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return 0;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.order || 0;
  });

  const context = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return "";
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.context || "";
  });

  const tabCreated = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.tabCreated || false;
  });

  const tempTabCreated = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.tempTabCreated || false;
  });

  const savedTab = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return null;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.savedTab || null;
  });

  const focusedTileIds = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return [undefined, undefined] as [string | undefined, string | undefined];
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.focusedTileIds || [undefined, undefined];
  });

  const tiles = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return {};
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.tiles || {};
  });

  const saveSuccess = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return undefined;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.saveSuccess;
  });

  const resetting = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.resetting || false;
  });

  const edit = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.edit || false;
  });

  const interactive = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.interactive || false;
  });

  const copied = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return undefined;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.copied;
  });

  const deleting = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.deleting || false;
  });

  const dataPending = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.dataPending || false;
  });

  const pending = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.pending || false;
  });

  const refreshing = useStoreContext(state => {
    if (!hasTab || !tabId || !activeProjectId || !activeInterfaceId) return false;
    return state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[tabId]?.refreshing || false;
  });

  // Get action functions for updating the tab state
  const storeInitTab = useStoreContext(state => state.initTab);
  const storeUpdateTab = useStoreContext(state => state.updateTab);
  const storeRemoveTab = useStoreContext(state => state.removeTab);
  
  // Get action functions for tile management
  const storeInitTile = useStoreContext(state => state.initTile);
  const storeRemoveTile = useStoreContext(state => state.removeTile);
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

  // Pre-fetch all tile actions at the top level to avoid hook rule violations
  const tileActionsMap: Record<string, TileActions | null> = {};
  if (hasTab && tiles) {
    Object.keys(tiles).map(tileId => {
      const tileHook = useTile(tileId, tabId, activeInterfaceId || undefined, activeProjectId || undefined);
      tileActionsMap[tileId] = tileHook.actions;
    });
  }

  // Now we can safely use the early return AFTER all hooks have been called
  if (!tabId) {
    return { tab: null, actions: null, exists: false };
  }

  // Define actions using useMemo and returning the appropriate actions object
  const actions = useMemo<TabActions>(() => ({
    // Basic tab management
    initTab: (initialState) => {
      if (activeProjectId && activeInterfaceId) {
        storeInitTab(activeProjectId, activeInterfaceId, tabId, initialState);
      }
    },
    
    updateTab: (updates) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, updates);
      }
    },
    
    removeTab: () => {
      if (activeProjectId && activeInterfaceId) {
        storeRemoveTab(activeProjectId, activeInterfaceId, tabId);
      }
    },
    
    // Property setters
    setName: (name) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { name });
      }
    },

    setVisible: (visible) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { visible });
      }
    },

    setActive: (active) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { active });
      }
    },

    setOrder: (order) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { order });
      }
    },

    setContext: (context) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { context });
      }
    },
    
    // UI state property setters
    setSaveSuccess: (saveSuccess) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { saveSuccess });
      }
    },
    
    setResetting: (resetting) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { resetting });
      }
    },
    
    setEdit: (edit) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { edit });
      }
    },
    
    setInteractive: (interactive) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { interactive });
      }
    },
    
    setCopied: (copied) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { copied });
      }
    },
    
    setDeleting: (deleting) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { deleting });
      }
    },
    
    setDataPending: (dataPending) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { dataPending });
      }
    },
    
    setPending: (pending) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { pending });
      }
    },
    
    setRefreshing: (refreshing) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { refreshing });
      }
    },

    setTempTabCreated: (tempTabCreated) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { tempTabCreated });
      }
    },

    setFocusedTileIds: (focusedTileIds) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTab(activeProjectId, activeInterfaceId, tabId, { focusedTileIds });
      }
    },

    // Tile management
    initTile: (tileId, initialState) => {
      if (activeProjectId && activeInterfaceId) {
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
      if (activeProjectId && activeInterfaceId) {
        storeRemoveTile(activeProjectId, activeInterfaceId, tabId, tileId);
      }
    },
    
    // A specialized method for renaming tiles and updating references in one operation
    renameTile: (tileId: string, newName: string) => {
      if (activeProjectId && activeInterfaceId && tiles) {
        // We'll need to update all tiles that reference this one
        Object.entries(tiles).forEach(([id, tile]) => {
          if (id === tileId) {
            // If this is the tile being renamed, update its name
            storeUpdateTile(activeProjectId, activeInterfaceId, tabId, id, {
              id: newName,
              name: newName 
            });
          }
          else if (tile.type === 'Table' && tile.tableData?.table === tileId) {
            // If this is a tile that references the renamed tile, update the reference
            storeUpdateTile(activeProjectId, activeInterfaceId, tabId, id, {
              tableData: { 
                ...tile.tableData,
                table: newName 
              }
            });
          }
        });
      }
    },
    
    updateTile: (tileId, updates) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTile(activeProjectId, activeInterfaceId, tabId, tileId, updates);
      }
    },
    
    // Table tile specific actions
    initTableTile: (tileId, initialState) => {
      if (activeProjectId && activeInterfaceId) {
        storeInitTableTile(activeProjectId, activeInterfaceId, tabId, tileId, initialState);
      }
    },
    
    updateTableTile: (tileId, updates) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdateTableTile(activeProjectId, activeInterfaceId, tabId, tileId, updates);
      }
    },
    
    // Plot tile specific actions
    initPlotTile: (tileId, initialState) => {
      if (activeProjectId && activeInterfaceId) {
        storeInitPlotTile(activeProjectId, activeInterfaceId, tabId, tileId, initialState);
      }
    },
    
    updatePlotTile: (tileId, updates) => {
      if (activeProjectId && activeInterfaceId) {
        storeUpdatePlotTile(activeProjectId, activeInterfaceId, tabId, tileId, updates);
      }
    },

    // View tile specific actions
    initViewTile: (tileId, initialState) => {
      if (activeProjectId && activeInterfaceId) {
        storeInitViewTile(activeProjectId, activeInterfaceId, tabId, tileId, initialState);
      }
    },

    updateViewTile: (tileId, updates) => {
      if (activeProjectId && activeInterfaceId) {
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
    
    getItems: () => {
      if (!hasTab || !tiles) return [];
      
      return Object.keys(tiles).map(tileId => {
        // Use the pre-fetched tile actions instead of calling useTile again
        const actions = tileActionsMap[tileId];
        
        // If actions is null or asTileItem is not available, return an empty TileProps with required fields
        return actions?.asTileItem?.() || {
          i: tileId,
          x: 0,
          y: 0,
          w: 1,
          h: 1
        } as TileProps;
      });
    },

  }), [
    activeProjectId,
    activeInterfaceId,
    tabId,
    pending,
    dataPending,
    refreshing,
    deleting,
    saveSuccess,
    resetting,
    edit,
    interactive,
    copied,
    tiles,
    tempTabCreated,
    focusedTileIds,
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
    tileActionsMap,
    hasTab
  ]);
  
  // Build the tab object from our hook results
  const finalTab = hasTab
    ? {
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
        refreshing
    } as Tab : null;
  
  return {
    tab: finalTab,
    actions,
    exists: hasTab
  };
}