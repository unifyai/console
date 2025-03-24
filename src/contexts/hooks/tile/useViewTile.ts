import { useMemo } from "react";
import { TileActions, useTile } from "../tile/useTile";
import { ViewTileMeta, ViewTileData, ViewTileUI } from "../../slices/selectors/viewTile";
import { TileDataActions } from "./useTileData";

// Define the default return value for the useViewTile hook
const DEFAULT_USE_VIEW_TILE_RETURN = {
  viewTile: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  actions: null,
  exists: false,
};

/**
 * Interface for view tile meta-related actions
 */
export interface ViewTileMetaActions {
  // Add view-specific meta actions here
}

/**
 * Interface for view tile data-related actions
 */
export interface ViewTileDataActions {
  // Add any other view-specific data actions here
  setBaseIndex: (baseIndex: string | undefined) => void;
}

/**
 * Interface for view tile UI-related actions
 */
export interface ViewTileUIActions {
  // Add any other view-specific UI actions here
}

/**
 * Interface for all view tile-related actions
 */
export interface ViewTileActions extends TileActions {
  // View-specific actions grouped by category
  viewMeta: ViewTileMetaActions;
  viewData: ViewTileDataActions;
  viewUI: ViewTileUIActions;
}

/**
 * Custom hook to access view tile data and actions
 * @param tileName The name of the view tile to access
 * @param tabName Optional tab name
 * @param interfaceName Optional interface name
 * @param projectName Optional project name
 * @returns Object containing tile state, actions, and existence flag
 */
export function useViewTile(
  tileName: string | null,
  tabName?: string | null,
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Always call hooks at the top level, unconditionally
  const {
    tile: baseTile,
    dataActions: baseTileActions,
    exists,
  } = useTile(tileName, tabName, interfaceName, projectName);

  // Check if this tile is a view tile
  const hasViewTile = useMemo(() => {
    if (!baseTile || baseTile.type !== 'View') return false;
    return true;
  }, [baseTile]);
  
  // Extract view-specific meta, data, and UI
  const viewMeta = useMemo<ViewTileMeta | null>(() => {
    if (!hasViewTile || !baseTile || !baseTile.viewTile) return null;
    return baseTile.viewTile as ViewTileMeta;
  }, [hasViewTile, baseTile]);
  
  const viewData = useMemo<ViewTileData | null>(() => {
    if (!hasViewTile || !baseTile || !baseTile.viewTile) return null;
    return baseTile.viewTile as ViewTileData;
  }, [hasViewTile, baseTile]);
  
  const viewUI = useMemo<ViewTileUI | null>(() => {
    if (!hasViewTile || !baseTile || !baseTile.viewTile) return null;
    return baseTile.viewTile as ViewTileUI;
  }, [hasViewTile, baseTile]);
  
  // Create view-specific meta actions
  const viewMetaActions = useMemo<ViewTileMetaActions>(() => {
    return {
      // Add view-specific meta actions here
    };
  }, []);
  
  // Create view-specific data actions
  const viewDataActions = useMemo<ViewTileDataActions>(() => {
    return {
      // Add view-specific data actions here
      setBaseIndex: (baseIndex) => {
        if (baseTileActions && hasViewTile) {
          (baseTileActions as unknown as TileDataActions).updateViewTile({ 
            base_index: baseIndex
          });
        }
      }
    };
  }, [baseTileActions, hasViewTile]);
  
  // Create view-specific UI actions
  const viewUIActions = useMemo<ViewTileUIActions>(() => {
    return {
      // Add view-specific UI actions here
    };
  }, []);
  
  // Combine all actions
  const viewActions = useMemo<ViewTileActions>(() => {
    return {
      ...(baseTileActions as unknown as ViewTileActions),
      viewMeta: viewMetaActions,
      viewData: viewDataActions,
      viewUI: viewUIActions
    };
  }, [baseTileActions, viewMetaActions, viewDataActions, viewUIActions]);
  
  // Return null if no tileId provided
  if (tileName === null) {
    return DEFAULT_USE_VIEW_TILE_RETURN;
  }

  return {
    viewTile: hasViewTile ? baseTile?.viewTile : null,
    meta: viewMeta,
    data: viewData,
    ui: viewUI,
    metaActions: viewMetaActions,
    dataActions: viewDataActions,
    uiActions: viewUIActions,
    actions: viewActions,
    exists: exists && hasViewTile,
  };
}
