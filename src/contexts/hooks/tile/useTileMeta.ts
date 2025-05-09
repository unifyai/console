import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { useTabMeta } from '../tab/useTabMeta';
import { TileMeta, TilePosition } from '../../slices/selectors/tile';
import { useShallow } from 'zustand/react/shallow';

/**
 * Interface for tile meta-related actions
 */
export interface TileMetaActions {
   setName: (name: string) => void;
   setType: (type: 'Table' | 'Plot' | 'View' | 'Editor') => void;
   setPosition: (position: Partial<TilePosition>) => void;
   setMinW: (minW?: number) => void;
   setMinH: (minH?: number) => void;
 }
  

/**
 * Custom hook to access tile metadata and related actions
 * @param tileIdOrName The ID or name of the tile to access
 * @param tabIdOrName Optional ID or name of the tab containing the tile
 * @returns Object containing tile metadata, actions, and related IDs
 */
export function useTileMeta(
  tileIdOrName: string | null,
  tabIdOrName: string | null
) {
  // Use the tab meta hook to get tab information
  const { tabId } = useTabMeta(tabIdOrName);
  
  // First attempt: Look for the tile directly by ID
  const tileInStoreById = useStoreContext(
    useShallow(state => {
      if (!tileIdOrName) return null;
      return state.tilesById[tileIdOrName] || null;
    })
  );

  // Second attempt: Find the tile by tab + name combination
  const tileInStoreByName = useStoreContext(
    useShallow(state => {
      if (!tileIdOrName || !tabId || tileInStoreById) return null;
      
    // Find tile with matching name and tab ID
    return Object.values(state.tilesById).find(
      tile => tile.name === tileIdOrName && tile.tabId === tabId
    ) || null;
  }));

  // Determine the tile ID based on lookup results
  const tileId = useMemo(() => {
    if (!tileIdOrName) return null;
    if (tileInStoreById) return tileIdOrName;
    return tileInStoreByName?.id || null;
  }, [tileIdOrName, tileInStoreById, tileInStoreByName]);

  // Check if tile exists
  const tileExists = !!tileId && !!(tileInStoreById || tileInStoreByName);

  // Subscribe to metadata properties
  const id = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].id;
  });
  
  const name = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].name;
  });
  
  const type = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].type;
  });
  
  const position = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].position;
  });
  
  const minW = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].minW;
  });
  
  const minH = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].minH;
  });

  // Get store actions for meta updates
  const storeUpdateTile = useStoreContext(state => state.updateTile);

  // Memoize the metadata object to prevent unnecessary rerenders
  const meta = useMemo<Partial<TileMeta> | null>(() => {
    if (!tileExists) return null;
    
    return {
      id: id!,
      name: name!,
      type: type!,
      position: position!,
      minW,
      minH
    };
  }, [tileExists, id, name, type, position, minW, minH]);

  // Memoize the meta actions to prevent unnecessary re-renders
  const metaActions = useMemo<TileMetaActions>(() => ({
    setName: (name) => {
      if (tileId) {
        storeUpdateTile(tileId, { name });
      }
    },
    
    setType: (type) => {
      if (tileId) {
        storeUpdateTile(tileId, { type });
      }
    },
    
    setPosition: (positionUpdate) => {
      if (tileId && position) {
        storeUpdateTile(tileId, { 
          position: { ...position, ...positionUpdate } 
        });
      }
    },
    
    setMinW: (minW) => {
      if (tileId) {
        storeUpdateTile(tileId, { minW });
      }
    },
    
    setMinH: (minH) => {
      if (tileId) {
        storeUpdateTile(tileId, { minH });
      }
    }
  }), [tileId, position, storeUpdateTile]);

  return {
    meta,
    metaActions,
    tileId,
    tileExists
  };
} 