import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";
import * as plotTileLogic from "./selectors/plotTile";
import * as tileLogic from "./selectors/tile";
import * as sliceUtils from "../utils/sliceUtils";

export interface PlotTileState {
  // No separate state properties for PlotTileSlice
}

export interface PlotTileActions {
  // Actions
  initPlotTile: (tileId: string, initialState?: Partial<plotTileLogic.PlotTile>) => void;
  updatePlotTile: (tileId: string, updates: Partial<plotTileLogic.PlotTile>) => void;
}

export type PlotTileSlice = PlotTileState & PlotTileActions;

export const createPlotTileSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  PlotTileSlice
> = (set) => ({
  // Actions
  initPlotTile: (tileId, initialState) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile) return;
    
    // Initialize plot tile data
    state.tilesById[tileId] = {
      ...tile,
      plotTile: plotTileLogic.initPlotTile(initialState),
      type: 'Plot' // Ensure the tile type is set to 'Plot'
    };
  }),
  
  updatePlotTile: (tileId, updates) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile || !tile.plotTile) return;
    
    // Filter out unchanged fields with the extended partially shallow logic
    const filteredUpdates = sliceUtils.filterUnchangedProps(tile.plotTile, updates);
    if (Object.keys(filteredUpdates).length === 0) return;
    
    // Update table-specific data if needed
    let updatedTile = tile;
    let tileUpdated = false;
    let itemsNeedRecompute = false;

    if (!updatedTile.plotTile) {
      updatedTile.plotTile = plotTileLogic.initPlotTile();
      tileUpdated = true;
    }

    updatedTile.plotTile = plotTileLogic.updatePlotTile(updatedTile.plotTile, filteredUpdates);
    tileUpdated = true;

    // Check if relevant fields are being updated that affect the tile item
    itemsNeedRecompute = Object.keys(filteredUpdates).some(
      key => tileLogic.PLOT_TILE_PROPS_KEYS_AS_PLOT_TILE_KEYS.includes(key as keyof typeof tile.plotTile)
    );

    // If we need to recompute, add the flag to the updates
    if (itemsNeedRecompute && !tile.itemsNeedRecompute) {
      updatedTile.itemsNeedRecompute = true;
      tileUpdated = true;
    }

    // Also set the tab's flag if this tile has a tabId and needs recompute
    if (itemsNeedRecompute && tile.tabId && state.tabsById[tile.tabId] && !state.tabsById[tile.tabId].itemsNeedRecompute) {
      state.tabsById[tile.tabId].itemsNeedRecompute = true;
    }

    // Apply the updated tile if needed
    if (tileUpdated) {
      state.tilesById[tileId] = updatedTile;
    }
  }),
}); 