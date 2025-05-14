import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { TabUI } from '../../slices/selectors/tab';
import { useShallow } from 'zustand/react/shallow';
import { useTabMeta } from './useTabMeta';

// Define stable fallback references
const EMPTY_FOCUSED_TILE_NAMES: [string | undefined, string | undefined] = [undefined, undefined];

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
  setRefreshing: (refreshing: boolean) => void;
  setTilesPending: (pending: boolean) => void;
  setColor: (color: string | undefined) => void;
  setHoveredLog: (hoveredLog: string | undefined) => void;
  setEditTile: (editTile: string | undefined) => void;
  setDataPending: (dataPending: boolean) => void;
  setPending: (pending: boolean) => void;
}

/**
 * Custom hook to access tab UI state and actions
 * @param tabIdOrName The ID or name of the tab to access
 * @param interfaceIdOrName Optional interface ID or name (if not provided, active interface will be used)
 * @returns Object containing tab UI state and actions
 */
export function useTabUI(
  tabIdOrName: string | null, 
  interfaceIdOrName?: string | null
) {

  // Use the meta hook to get common tab info
  const { 
    tabId, 
    tabExists 
  } = useTabMeta(tabIdOrName, interfaceIdOrName);

  // Get tileIds from the store
  const tileIds = useStoreContext(
    useShallow(state => {
      if (!tabExists || !tabId) return [];
      return state.tabsById[tabId].tileIds;
    })
  );

  // Granular subscriptions to UI properties
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
  
  const refreshing = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].refreshing;
  });

  const color = useStoreContext(state => {
    if (!tabExists || !tabId) return undefined;
    return state.tabsById[tabId].color;
  });

  const hoveredLog = useStoreContext(state => {
    if (!tabExists || !tabId) return undefined;
    return state.tabsById[tabId].hoveredLog;
  })

  const editTile = useStoreContext(state => { 
    if (!tabExists || !tabId) return undefined;
    return state.tabsById[tabId].editTile;
  });

  const dataPending = useStoreContext(state => {
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].dataPending;
  });

  const pending = useStoreContext(state => {  
    if (!tabExists || !tabId) return false;
    return state.tabsById[tabId].pending;
  });

  // Get store actions needed for UI
  const storeUpdateTab = useStoreContext(state => state.updateTab);
  const storeUpdateTile = useStoreContext(state => state.updateTile);
  
  // Memoize the UI state object
  const ui = useMemo<Partial<TabUI> | null>(() => {
    if (!tabExists) return null;
    
    return {
      interfaceId: interfaceIdFromState,
      focusedTileNames: focusedTileNames,
      saveSuccess,
      resetting,
      edit,
      interactive,
      help,
      copied,
      deleting,
      refreshing,
      color,
      hoveredLog,
      editTile,
      dataPending,
      pending,
    };
  }, [
    tabExists,
    interfaceIdFromState,
    focusedTileNames,
    saveSuccess,
    resetting,
    edit,
    interactive,
    help,
    copied,
    deleting,
    refreshing,
    color,
    hoveredLog,
    editTile,
    dataPending,
    pending,
  ]);

  // Memoize the UI actions
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
    
    setRefreshing: (refreshing) => {
      if (tabId) {
        storeUpdateTab(tabId, { refreshing });
      }
    },
    
    setTilesPending: (pending) => {
      if (tabId && tileIds.length) {
        // Update all tiles in the tab
        tileIds.forEach(tileId => {
          storeUpdateTile(tileId, { pending });
        });
      }
    },

    setColor: (color) => {
      if (tabId) {
        storeUpdateTab(tabId, { color });
      }
    },

    setHoveredLog: (hoveredLog) => {
      if (tabId) {
        storeUpdateTab(tabId, { hoveredLog })
      }
    },

    setEditTile: (editTile) => {
      if (tabId) {
        storeUpdateTab(tabId, { editTile });
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
  }), [
    tabId,
    tileIds,
    storeUpdateTab,
    storeUpdateTile,
  ]);

  return {
    ui,
    uiActions,
  };
} 