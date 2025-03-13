import { useMemo } from "react";
import { TileActions, useTile } from "./useTile";

// Define the default return value for the usePlotTile hook
const DEFAULT_USE_PLOT_TILE_RETURN = {
  plotTile: null,
  actions: null,
  exists: false,
};

/**
 * Interface for plot tile-related actions
 */
export interface PlotTileActions extends TileActions {
  // Add any plot-specific actions here
}

/**
 * Custom hook to access plot tile data and actions
 * @param tileId The ID of the plot tile to access
 * @param tabId Optional tab ID
 * @param interfaceId Optional interface ID
 * @param projectId Optional project ID
 * @returns Object containing tile state, actions, and existence flag
 */
export function usePlotTile(
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
  const hasPlotTile = useMemo(() => {
    if (!baseTile || baseTile.type !== 'Plot') return false;
    return true;
  }, [baseTile]);

  // Now subscribe to the actual plotData portion
  const plotData = useMemo(() => {
    if (!hasPlotTile || !baseTile) return null;
    // baseTile already has plotData if the tile is 'plot'
    return baseTile.plotData || null;
  }, [hasPlotTile, baseTile]);

  // Add plot-specific actions
  const plotActions = useMemo<PlotTileActions>(() => {
    return {
      ...baseTileActions as PlotTileActions,

      // Add any plot-specific actions here

    };
  }, [baseTileActions, hasPlotTile]);

  if (tileId === null) {
    return DEFAULT_USE_PLOT_TILE_RETURN;
  }

  return {
    plotTile: plotData,
    actions: plotActions,
    exists: exists && hasPlotTile,
  };

}