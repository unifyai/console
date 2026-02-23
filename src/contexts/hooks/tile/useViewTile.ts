import { useMemo } from 'react';
import { ViewTileMeta, ViewTileData, ViewTileUI } from '../../slices/selectors/viewTile';
import { useStoreContext } from '../../providers/StoreProvider';
import { useTileMeta } from './useTileMeta';
import { ViewTile } from '../../slices/selectors/viewTile';
import { useShallow } from 'zustand/react/shallow';

/**
 * Default return value when no tile is specified or tile doesn't exist
 */
export const DEFAULT_USE_VIEW_TILE_RETURN = {
  viewTile: null,
  viewTileActions: null,
  exists: false,
};

// Default view tile meta
export const DEFAULT_VIEW_TILE_META: ViewTileMeta = {};

// Default view tile UI
export const DEFAULT_VIEW_TILE_UI: ViewTileUI = {};

// Default view tile UI actions
export const DEFAULT_VIEW_TILE_UI_ACTIONS: ViewTileUIActions = {};

// Default view tile meta actions
export const DEFAULT_VIEW_TILE_META_ACTIONS: ViewTileMetaActions = {};

/**
 * Interface for view tile meta actions
 */
export interface ViewTileMetaActions {
  // Meta actions will be empty as per ViewTileMeta
}

/**
 * Interface for view tile data actions
 */
export interface ViewTileDataActions {
  setBaseIndex: (baseIndex: string | undefined) => void;
}

/**
 * Interface for view tile UI actions
 */
export interface ViewTileUIActions {
  // UI actions will be empty as per ViewTileUI
}

/**
 * Interface for view-specific actions
 */
export interface ViewActions extends ViewTileMetaActions, ViewTileDataActions, ViewTileUIActions {}

/**
 * Custom hook to access view-specific tile state and actions
 * @param tileIdOrName The ID or name of the tile to access
 * @param tabIdOrName Optional ID or name of the tab containing the tile
 * @returns Object containing view-specific tile state, actions, and existence flag
 */
export function useViewTile(tileIdOrName: string | null, tabIdOrName?: string | null) {
  // Get tile meta information using the useTileMeta hook
  const { tileId, tileExists } = useTileMeta(tileIdOrName, tabIdOrName || null);

  // Get the tile type to check if it's a view
  const tileType = useStoreContext(
    useShallow((state) => {
      if (!tileId) return null;
      return state.tilesById[tileId]?.type;
    })
  );

  // Check if the tile exists and is a view
  const isViewTile = tileExists && tileType === 'View';

  const viewTile = useStoreContext(
    useShallow((state) => {
      if (!isViewTile || !tileId) return null;
      return state.tilesById[tileId]?.viewTile as ViewTile;
    })
  );

  // Access store for view-specific meta data
  const viewMeta = useMemo(() => {
    // Return empty object as per ViewTileMeta interface
    return DEFAULT_VIEW_TILE_META as ViewTileMeta;
  }, []);

  // Access store for view-specific data
  const viewData = useMemo(() => {
    if (!isViewTile || !tileId || !viewTile) return null;

    return {
      baseIndex: viewTile.baseIndex,
    } as ViewTileData;
  }, [isViewTile, tileId, viewTile]);

  // Access store for view-specific UI state
  const viewUI = useMemo(() => {
    if (!isViewTile || !tileId) return null;
    // Return empty object as per ViewTileUI interface
    return DEFAULT_VIEW_TILE_UI as ViewTileUI;
  }, [isViewTile, tileId]);

  // Get store update functions
  const storeUpdateViewTile = useStoreContext((state) => state.updateViewTile);

  // Create memoized meta actions
  const viewMetaActions = useMemo<ViewTileMetaActions | null>(() => {
    if (!isViewTile || !tileId) return null;

    // Return empty object as per ViewTileMeta interface
    return DEFAULT_VIEW_TILE_META_ACTIONS as ViewTileMetaActions;
  }, [isViewTile, tileId]);

  // Create memoized data actions
  const viewDataActions = useMemo<ViewTileDataActions | null>(() => {
    if (!isViewTile || !tileId) return null;

    return {
      setBaseIndex: (baseIndex) => {
        const update: Partial<ViewTile> = {
          baseIndex: baseIndex,
        };
        storeUpdateViewTile(tileId, update);
      },
    };
  }, [isViewTile, tileId, storeUpdateViewTile]);

  // Create memoized UI actions
  const viewUIActions = useMemo<ViewTileUIActions | null>(() => {
    if (!isViewTile || !tileId) return null;

    // Return empty object as per ViewTileUI interface
    return DEFAULT_VIEW_TILE_UI_ACTIONS as ViewTileUIActions;
  }, [isViewTile, tileId]);

  // Build a final `viewTile` object from the separate meta, data, and UI objects
  const combinedViewTile = useMemo(() => {
    if (!viewMeta || !viewData || !viewUI) return null;

    return {
      ...viewMeta,
      ...viewData,
      ...viewUI,
    };
  }, [viewMeta, viewData, viewUI]);

  // Build a final `viewTileActions` object from the separate meta, data, and UI actions
  const combinedViewTileActions = useMemo(() => {
    if (!viewMetaActions || !viewDataActions || !viewUIActions) return null;

    return {
      ...viewMetaActions,
      ...viewDataActions,
      ...viewUIActions,
    };
  }, [viewMetaActions, viewDataActions, viewUIActions]);

  // If no tile name is provided or tile doesn't exist, return default
  if (!tileIdOrName || !isViewTile) {
    return DEFAULT_USE_VIEW_TILE_RETURN;
  }

  return {
    viewTile: combinedViewTile as ViewTile,
    viewTileActions: combinedViewTileActions as ViewActions,
    exists: isViewTile,
  };
}
