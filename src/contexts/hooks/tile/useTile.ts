import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { Tile } from '../../slices/selectors/tile';
import { useTileMeta, TileMetaActions } from './useTileMeta';
import { useTileData, TileDataActions } from './useTileData';
import { useTileUI, TileUIActions } from './useTileUI';
import { useTileOperations } from './useTileOperations';
import { useTileItem } from './useTileItem';

/**
 * Default return value when no tile is specified
 */
export const DEFAULT_USE_TILE_RETURN = {
  tile: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  itemActions: null,
  actions: null,
  exists: false,
  operations: {},
  tileId: null
};

/**
 * Interface for all tile-related actions
 */
export interface TileActions {
  // Basic tile management
  initTile: (initialState?: Partial<Tile>) => void;
  updateTile: (updates: Partial<Tile>) => void;
  removeTile: () => void;
  
  // Categorized actions
  meta: TileMetaActions;
  data: TileDataActions;
  ui: TileUIActions;
}

/**
 * Custom hook to access all tile state and actions
 * @param tileName The name of the tile to access
 * @param tabName The name of the tab containing the tile
 * @param interfaceName The name of the interface containing the tab
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing all tile state, actions, and existence flag
 */
export function useTile(
  tileName: string | null,
  tabName?: string | null,
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Use specialized hooks
  const {
    meta,
    metaActions,
    tileId,
    tileExists
  } = useTileMeta(tileName, tabName || null, interfaceName || null, projectName);
  
  const {
    data,
    dataActions,
    tableTile,
    plotTile,
    viewTile
  } = useTileData(tileName, tabName || null, interfaceName || null, projectName);
  
  const {
    ui,
    uiActions
  } = useTileUI(tileName, tabName || null, interfaceName || null, projectName);
  
  // const {
  //   operations,
  //   operationsActions
  // } = useTileOperations(tileName, tabName || null, interfaceName || null, projectName);
  
  // Get the item actions
  const {
    itemActions
  } = useTileItem(tileName, tabName || null, interfaceName || null, projectName);

  // Get active IDs from the store context
  const activeProjectId = useStoreContext(state => state.activeProjectId);
  const activeInterfaceId = useStoreContext(state => state.activeInterfaceId);
  const activeTabId = useStoreContext(state => state.activeTabId);

  // Get store actions for core tile management
  const storeInitTile = useStoreContext(state => state.initTile);
  const storeUpdateTile = useStoreContext(state => state.updateTile);
  const storeRemoveTile = useStoreContext(state => state.removeTile);

  // Memoize all actions to prevent unnecessary re-renders
  const actions = useMemo<TileActions>(() => {
    return {
      // Basic tile management
      initTile: (initialState) => {
        if (activeProjectId && activeInterfaceId && activeTabId && tileId) {
          storeInitTile(
            activeTabId,
            tileId,
            {
              id: tileId,
              projectId: activeProjectId,
              interfaceId: activeInterfaceId,
              tabId: activeTabId,
              ...initialState
            }
          );
        }
      },
      
      updateTile: (updates) => {
        if (tileId) {
          storeUpdateTile(tileId, updates);
        }
      },
      
      removeTile: () => {
        if (activeTabId && tileId) {
          storeRemoveTile(activeTabId, tileId);
        }
      },
      
      // Categorized actions
      meta: metaActions,
      data: dataActions,
      ui: uiActions
    };
  }, [
    tileId,
    activeTabId,
    activeInterfaceId,
    activeProjectId,
    metaActions,
    dataActions,
    uiActions,
    storeInitTile,
    storeUpdateTile,
    storeRemoveTile
  ]);
  
  // Build a final 'tile' object from the separate meta, data, and UI objects
  const tile = useMemo<Partial<Tile> | null>(() => {
    if (!meta || !data || !ui) return null;
    
    return {
      ...meta,
      ...data,
      ...ui,
      tableTile,
      plotTile,
      viewTile
    };
  }, [meta, data, ui, tableTile, plotTile, viewTile]);

  // Use tileId to conditionally return values, but only after all hooks are called
  if (!tileName) {
    return DEFAULT_USE_TILE_RETURN;
  }

  return {
    tile,
    meta,
    data,
    ui,
    metaActions,
    dataActions,
    uiActions,
    itemActions,
    actions,
    // operations,
    // operationsActions,
    exists: tileExists,
    tileId
  };
}
