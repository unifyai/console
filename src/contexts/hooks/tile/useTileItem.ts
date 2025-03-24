import { useMemo, useCallback } from 'react';
import { useStoreContext, useStoreApiContext } from '../../providers/StoreProvider';
import { useTileMeta } from './useTileMeta';
import { useTileUI } from './useTileUI';
import { useTileData } from './useTileData';
import { Tile } from '../../slices/selectors/tile';
import { TileProps } from '@/types/evals/grid';
import { constructHierarchicalId } from '@/contexts/utils/sliceUtils';
import { convertTileToTileItem, convertTileItemToTile } from './tileItemUtils';

/**
 * Interface for tile item conversion actions
 */
export interface TileItemActions {
  asTileItem: () => TileProps;
  fromTileItem: (tileItem: TileProps) => boolean;
}

/**
 * Factory function to create tile item actions
 */
export function createTileItemActions(
  tileId: string,
  tile: Partial<Tile> | null,
  storeUpdateTile: (id: string, updates: any) => void,
  storeUpdateTableTile: (id: string, updates: any) => void,
  storeUpdatePlotTile: (id: string, updates: any) => void,
  storeUpdateViewTile: (id: string, updates: any) => void
): TileItemActions | null {
  if (!tileId || !tile) {
    return null;
  }
  
  return {
    asTileItem: () => {
      return convertTileToTileItem(tile);
    },
    
    fromTileItem: (tileItem: TileProps) => {
      const { tileUpdates, tableTileUpdates, plotTileUpdates, viewTileUpdates } = 
        convertTileItemToTile(tileItem, tileId);
      
      // Apply all updates to the tile
      storeUpdateTile(tileId, tileUpdates);
      
      // Apply type-specific updates if they exist
      if (tableTileUpdates) {
        storeUpdateTableTile(tileId, tableTileUpdates);
      } else if (plotTileUpdates) {
        storeUpdatePlotTile(tileId, plotTileUpdates);
      } else if (viewTileUpdates) {
        storeUpdateViewTile(tileId, viewTileUpdates);
      }
      
      return true;
    }
  };
}

/**
 * Custom hook to access tile item conversion utilities
 * @param tileName The name of the tile to access
 * @param tabName The name of the tab containing the tile
 * @param interfaceName The name of the interface containing the tab
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing tile item conversion actions
 */
export function useTileItem(
  tileName: string | null,
  tabName: string | null,
  interfaceName: string | null,
  projectName?: string | null
) {
  // Use the existing hooks to get all necessary tile information
  const { meta, tileId, tileExists } = useTileMeta(tileName, tabName, interfaceName, projectName);
  const { ui } = useTileUI(tileName, tabName, interfaceName, projectName);
  const { data, tableTile, plotTile, viewTile } = useTileData(tileName, tabName, interfaceName, projectName);
  
  // Get store actions for data management
  const storeUpdateTile = useStoreContext(state => state.updateTile);
  const storeUpdateTableTile = useStoreContext(state => state.updateTableTile);
  const storeUpdatePlotTile = useStoreContext(state => state.updatePlotTile);
  const storeUpdateViewTile = useStoreContext(state => state.updateViewTile);

  // Combine tile data for the action creator
  const tile = useMemo<Partial<Tile> | null>(() => {
    if (!meta || !tileId) return null;
    
    return {
      ...meta,
      ...data,
      ...ui,
      tableTile,
      plotTile,
      viewTile
    };
  }, [meta, data, ui, tableTile, plotTile, viewTile, tileId]);

  // Memoize the item actions using the factory function
  const itemActions = useMemo(() => {
    return createTileItemActions(
      tileId || '',
      tile,
      storeUpdateTile,
      storeUpdateTableTile,
      storeUpdatePlotTile,
      storeUpdateViewTile
    );
  }, [
    tileId,
    tile,
    storeUpdateTile,
    storeUpdateTableTile,
    storeUpdatePlotTile,
    storeUpdateViewTile
  ]);

  return {
    itemActions,
    tileExists
  };
}

/**
 * Hook to access tile item actions for any tile without violating React hook rules
 */
export function useTileItemActions() {
  // Access the global store api
  const storeApi = useStoreApiContext();
  
  // Create a memoized function to get tile item actions
  const getTileItemActions = useCallback((
    tileName: string,
    tabName: string | null,
    interfaceName: string | null = null,
    projectName: string | null = null
  ) => {
    if (!tileName || !tabName) return null;
    
    // Get state from store
    const state = storeApi.getState();
    
    // Resolve hierarchical IDs 
    const projectId = projectName || state.activeProjectId;
    if (!projectId) return null;
    
    const interfaceId = interfaceName 
      ? (interfaceName.includes('>') ? interfaceName : constructHierarchicalId(interfaceName, [projectId]))
      : state.activeInterfaceId;
    if (!interfaceId) return null;
    
    const resolvedTabId = tabName.includes('>') 
      ? tabName 
      : constructHierarchicalId(tabName, [interfaceId]);
    
    const resolvedTileId = tileName.includes('>')
      ? tileName
      : constructHierarchicalId(tileName, [resolvedTabId]);
    
    // Get the tile from state
    const tile = state.tilesById[resolvedTileId];
    if (!tile) return null;
    
    // Create actions for this tile using the factory function
    return createTileItemActions(
      resolvedTileId,
      tile,
      state.updateTile,
      state.updateTableTile,
      state.updatePlotTile,
      state.updateViewTile
    );
  }, [storeApi]);
  
  return { getTileItemActions };
} 