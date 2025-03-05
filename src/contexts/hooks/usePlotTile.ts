import { useMemo } from "react";
import { useStoreContext } from "../providers/StoreProvider";
import { TileActions, useTile } from "./useTile";

/**
 * Interface for plot tile-related actions
 */
export interface PlotTileActions extends TileActions {
  setPlotType: (plotType: string) => void;
  setConfig: (config: any) => void;
  setData: (data: any) => void;
}

/**
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
  // Narrow approach with useTile plus narrower subscription
  const {
    data: baseTile,
    actions: baseTileActions,
    exists,
    tabId: foundTabId
  } = useTile(tileId, tabId, interfaceId, projectId);
  const hasPlotTile = useStoreContext((state) => {
    if (!baseTile || baseTile.type !== 'plot') return false;
    return true;
  });

  // Now subscribe to the actual plotData portion
  const plotData = useStoreContext((state) => {
    if (!hasPlotTile || !baseTile) return null;
    // baseTile already has plotData if the tile is 'plot'
    return baseTile.plotData || null;
  });

  // Add plot-specific actions
  const plotActions = useMemo<PlotTileActions>(() => {
    return {
      ...baseTileActions as PlotTileActions,
      setPlotType: (plotType: string) => {
        if (hasPlotTile && baseTileActions) {
          baseTileActions.updatePlotData({ plotType });
        }
      },
      setConfig: (config: any) => {
        if (hasPlotTile && baseTileActions) {
          baseTileActions.updatePlotData({ config });
        }
      },
      setData: (data: any) => {
        if (hasPlotTile && baseTileActions) {
          baseTileActions.updatePlotData({ data });
        }
      },
    };
  }, [baseTileActions, hasPlotTile]);

  return {
    data: hasPlotTile ? plotData : null,
    actions: plotActions,
    exists: exists && hasPlotTile,
    tabId: foundTabId,
    tile: baseTile
  };
}