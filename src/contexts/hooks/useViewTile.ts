import { useMemo } from "react";
import { TileActions, useTile } from "./useTile";

// Define the default return value for the useViewTile hook
const DEFAULT_USE_VIEW_TILE_RETURN = {
  viewTile: null,
  actions: null,
  exists: false,
};

/**
 * Interface for view tile-related actions
 */
export interface ViewTileActions extends TileActions {
  // Add any view-specific actions here
}

/**
 * Custom hook to access view tile data and actions
 * @param tileId The ID of the view tile to access
 * @param tabId Optional tab ID
 * @param interfaceId Optional interface ID
 * @param projectId Optional project ID
 * @returns Object containing tile state, actions, and existence flag
 */
export function useViewTile(
  tileId: string | null,
  tabId?: string | null,
  interfaceId?: string | null,
  projectId?: string | null
) {
  // Always call hooks at the top level, unconditionally
  const {
    tile: baseTile,
    actions: baseTileActions,
    exists,
  } = useTile(tileId, tabId, interfaceId, projectId);

  // Instead of subscribing to the entire interface object,
  // we subscribe to individual properties. This way, changes in
  // unrelated fields won't cause a new reference for everything.

  // We'll check if this tab actually exists:
  const hasViewTile = useMemo(() => {
    if (!baseTile || baseTile.type !== 'View') return false;
    return true;
  }, [baseTile]);

  // Now subscribe to the actual viewData portion
  const viewData = useMemo(() => {
    if (!hasViewTile || !baseTile) return null;
    return baseTile.viewData || null;
  }, [hasViewTile, baseTile]);

  // Add view-specific actions
  const viewActions = useMemo<ViewTileActions>(() => {
    return {
      ...baseTileActions as ViewTileActions,
      // Add any view-specific actions here
    };
  }, [baseTileActions, hasViewTile]);

  if (tileId === null) {
    return DEFAULT_USE_VIEW_TILE_RETURN;
  }

  return {
    viewTile: viewData,
    actions: viewActions,
    exists: exists && hasViewTile,
  };
}