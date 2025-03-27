import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { Tile } from '../../slices/selectors/tile';
import { useTileMeta, TileMetaActions } from './useTileMeta';
import { useTileData, TileDataActions } from './useTileData';
import { useTileUI, TileUIActions } from './useTileUI';
import { useTileItem } from './useTileItem';
import { useTableTile, TableActions } from './useTableTile';
import { usePlotTile, PlotActions } from './usePlotTile';
import { useViewTile, ViewActions } from './useViewTile';
import { useShallow } from 'zustand/react/shallow';

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
  tileId: null,

  tableTile: null,
  plotTile: null,
  viewTile: null,

  // Type specific properties and actions
  tableTileActions: null,
  plotTileActions: null,
  viewTileActions: null,
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
  
  // Type-specific actions
  tableTileActions?: TableActions;
  plotTileActions?: PlotActions;
  viewTileActions?: ViewActions;
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
  // Use specialized hooks for base tile data
  const {
    meta,
    metaActions,
    tileId,
    tileExists
  } = useTileMeta(tileName, tabName || null, interfaceName || null, projectName);
  
  const {
    data,
    dataActions,
  } = useTileData(tileName, tabName || null, interfaceName || null, projectName);
  
  const {
    ui,
    uiActions
  } = useTileUI(tileName, tabName || null, interfaceName || null, projectName);
  
  // Get the item actions
  const {
    itemActions
  } = useTileItem(tileName, tabName || null, interfaceName || null, projectName);

  // Use type-specific hooks based on the tile type
  const {
    tableTile,
    tableTileActions,
    exists: tableExists
  } = useTableTile(tileName, tabName || null, interfaceName || null, projectName);
  
  const {
    plotTile,
    plotTileActions,
    exists: plotExists
  } = usePlotTile(tileName, tabName || null, interfaceName || null, projectName);
  
  const {
    viewTile,
    viewTileActions,
    exists: viewExists
  } = useViewTile(tileName, tabName || null, interfaceName || null, projectName);

  // Get active IDs from the store context
  const activeProjectId = useStoreContext(state => state.activeProjectId);
  const activeInterfaceId = useStoreContext(state => state.activeInterfaceId);
  const activeTabId = useStoreContext(state => state.activeTabId);

  // Get store actions for core tile management
  const storeInitTile = useStoreContext(state => state.initTile);
  const storeUpdateTile = useStoreContext(state => state.updateTile);
  const storeRemoveTile = useStoreContext(state => state.removeTile);
  
  // Get the tile type from the store
  const tileType = useStoreContext(
    useShallow(state => {
      if (!tileId) return null;
      return state.tilesById[tileId]?.type;
    })
  );

  // Memoize all actions to prevent unnecessary re-renders
  const actions = useMemo<TileActions>(() => {
    const baseActions: TileActions = {
      // Basic tile management
      initTile: (initialState?: Partial<Tile>) => {
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
      
      updateTile: (updates: Partial<Tile>) => {
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
      ui: uiActions,
      tableTileActions: tableTileActions as TableActions | undefined,
      plotTileActions: plotTileActions as PlotActions | undefined,
      viewTileActions: viewTileActions as ViewActions | undefined
    };
    
    return baseActions;
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
    storeRemoveTile,
    tileType,
    tableExists,
    tableTileActions,
    plotExists,
    plotTileActions,
    viewExists,
    viewTileActions
  ]);
  
  // Build a final 'tile' object from the separate meta, data, and UI objects
  const combinedTile = useMemo(() => {
    if (!meta || !data || !ui) return null;
    
    // Create a base tile
    const baseTile = {
      ...meta,
      ...data,
      ...ui,
      ...tableTile,
      ...plotTile,
      ...viewTile
    } as Tile;
    
    return baseTile;
  }, [meta, data, ui, tableTile, plotTile, viewTile]);

  // Use tileId to conditionally return values, but only after all hooks are called
  if (!tileName) {
    return DEFAULT_USE_TILE_RETURN;
  }

  return {
    tile: combinedTile,
    meta,
    data,
    ui,
    metaActions,
    dataActions,
    uiActions,
    itemActions,
    actions,
    exists: tileExists,
    tileId,
    
    // Include type-specific properties and actions for direct access
    tableTile: tableExists ? tableTile : null,
    plotTile: plotExists ? plotTile : null,
    viewTile: viewExists ? viewTile : null,
    
    tableTileActions: tableExists ? tableTileActions : null,
    plotTileActions: plotExists ? plotTileActions : null,
    viewTileActions: viewExists ? viewTileActions : null,
  };
}
