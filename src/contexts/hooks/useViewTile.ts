import { useMemo } from "react";
import { useStoreContext } from "../providers/StoreProvider";
import { TileActions, useTile } from "./useTile";

/**
 * Interface for view tile-related actions
 */
export interface ViewTileActions extends TileActions {
  setViewType: (viewType: string) => void;
  setContent: (content: string) => void;
  setSourceUrl: (sourceUrl: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
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
  // Narrow approach with useTile plus narrower subscription
  const {
    data: baseTile,
    actions: baseTileActions,
    exists,
    tabId: foundTabId
  } = useTile(tileId, tabId, interfaceId, projectId);

  // Check if we actually have a view tile
  const hasViewTile = useStoreContext((state) => {
    if (!baseTile || baseTile.type !== 'view') return false;
    return true;
  });

  // Now subscribe to the actual viewData portion
  const viewData = useStoreContext((state) => {
    if (!hasViewTile || !baseTile) return null;
    return baseTile.viewData || null;
  });

  // Add view-specific actions
  const viewActions = useMemo<ViewTileActions>(() => {
    return {
      ...baseTileActions as ViewTileActions,
      setViewType: (viewType: string) => {
        if (hasViewTile && baseTileActions) {
          baseTileActions.updateViewData({ viewType });
        }
      },
      setContent: (content: string) => {
        if (hasViewTile && baseTileActions) {
          baseTileActions.updateViewData({ content });
        }
      },
      setSourceUrl: (sourceUrl: string | null) => {
        if (hasViewTile && baseTileActions) {
          baseTileActions.updateViewData({ sourceUrl });
        }
      },
      setLoading: (loading: boolean) => {
        if (hasViewTile && baseTileActions) {
          baseTileActions.updateViewData({ loading });
        }
      },
      setError: (error: string | null) => {
        if (hasViewTile && baseTileActions) {
          baseTileActions.updateViewData({ error });
        }
      },
    };
  }, [baseTileActions, hasViewTile]);

  return {
    data: hasViewTile ? viewData : null,
    actions: viewActions,
    exists: exists && hasViewTile,
    tabId: foundTabId,
    tile: baseTile
  };
}