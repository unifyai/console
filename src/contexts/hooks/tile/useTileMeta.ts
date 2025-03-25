import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { useTabMeta } from '../tab/useTabMeta';
import { TileMeta, TilePosition } from '../../slices/selectors/tile';

/**
 * Interface for tile meta-related actions
 */
export interface TileMetaActions {
   setName: (name: string) => void;
   setType: (type: 'Table' | 'Plot' | 'View') => void;
   setPosition: (position: Partial<TilePosition>) => void;
   setMinW: (minW?: number) => void;
   setMinH: (minH?: number) => void;
 }
  

/**
 * Custom hook to access tile metadata and related actions
 * @param tileName The name of the tile to access
 * @param tabName The name of the tab containing the tile
 * @param interfaceName The name of the interface containing the tab
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing tile metadata, actions, and related IDs
 */
export function useTileMeta(
  tileName: string | null,
  tabName: string | null,
  interfaceName: string | null,
  projectName?: string | null
) {
  // Use the tab meta hook to get tab information
  const { tabId } = useTabMeta(tabName, interfaceName, projectName);
  
  // Construct tile ID hierarchically
  const tileId = useMemo(() => {
    if (!tabId || !tileName) return null;
    return `${tabId}>${tileName}`;
  }, [tabId, tileName]);

  // Check if tile exists
  const tileExists = useStoreContext(state => {
    if (!tileId) return false;
    return !!state.tilesById?.[tileId];
  });

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