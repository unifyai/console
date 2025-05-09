import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { useTileMeta } from './useTileMeta';
import { TileUI } from '../../slices/selectors/tile';

/**
 * Interface for tile UI-related actions
 */
export interface TileUIActions {
  setVisible: (visible: boolean) => void;
  setLocked: (locked: boolean) => void;
  setPending: (pending: boolean) => void;
  setLoading: (loading?: boolean) => void;
  setError: (error?: string | null) => void;
  setMoved: (moved?: boolean) => void;
  setStatic: (static_?: boolean) => void;
  setColor: (color?: string) => void;
}

/**
 * Custom hook to access tile UI state and actions
 * @param tileIdOrName The ID or name of the tile to access
 * @param tabIdOrName The ID or name of the tab containing the tile
 * @returns Object containing tile UI state and actions
 */
export function useTileUI(
  tileIdOrName: string | null,
  tabIdOrName: string | null
) {
  // Use the tile meta hook to get common tile info
  const { tileId, tileExists } = useTileMeta(tileIdOrName, tabIdOrName);

  // Subscribe to UI properties
  const tabIdFromState = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].tabId;
  });
  
  const visible = useStoreContext(state => {
    if (!tileExists || !tileId) return true;
    return state.tilesById[tileId].visible !== false;
  });
  
  const locked = useStoreContext(state => {
    if (!tileExists || !tileId) return false;
    return !!state.tilesById[tileId].locked;
  });
  
  const pending = useStoreContext(state => {
    if (!tileExists || !tileId) return false;
    return !!state.tilesById[tileId].pending;
  });
  
  const loading = useStoreContext(state => {
    if (!tileExists || !tileId) return false;
    return !!state.tilesById[tileId].loading;
  });
  
  const error = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].error;
  });
  
  const moved = useStoreContext(state => {
    if (!tileExists || !tileId) return false;
    return !!state.tilesById[tileId].moved;
  });
  
  const static_ = useStoreContext(state => {
    if (!tileExists || !tileId) return false;
    return !!state.tilesById[tileId].static;
  });

  const color = useStoreContext(state => {
    if (!tileExists || !tileId) return undefined;
    return state.tilesById[tileId].color;
  });

  // Get store actions for UI state management
  const storeUpdateTile = useStoreContext(state => state.updateTile);

  // Memoize the UI state object to prevent unnecessary rerenders
  const ui = useMemo<Partial<TileUI> | null>(() => {
    if (!tileExists) return null;
    
    return {
      tabId: tabIdFromState,
      visible,
      locked,
      pending,
      loading,
      error,
      moved,
      static: static_,
      color
    };
  }, [
    tileExists,
    tabIdFromState,
    visible,
    locked,
    pending,
    loading,
    error,
    moved,
    static_,
    color
  ]);

  // Memoize the UI actions to prevent unnecessary re-renders
  const uiActions = useMemo<TileUIActions>(() => ({
    setVisible: (visible) => {
      if (tileId) {
        storeUpdateTile(tileId, { visible });
      }
    },
    
    setLocked: (locked) => {
      if (tileId) {
        storeUpdateTile(tileId, { locked });
      }
    },
    
    setPending: (pending) => {
      if (tileId) {
        storeUpdateTile(tileId, { pending });
      }
    },
    
    setLoading: (loading) => {
      if (tileId) {
        storeUpdateTile(tileId, { loading });
      }
    },
    
    setError: (error) => {
      if (tileId) {
        storeUpdateTile(tileId, { error });
      }
    },
    
    setMoved: (moved) => {
      if (tileId) {
        storeUpdateTile(tileId, { moved });
      }
    },
    
    setStatic: (static_) => {
      if (tileId) {
        storeUpdateTile(tileId, { static: static_ });
      }
    },
    
    setColor: (color) => {
      if (tileId) {
        storeUpdateTile(tileId, {color});
      }
    }
  }), [tileId, storeUpdateTile]);

  return {
    ui,
    uiActions
  };
} 