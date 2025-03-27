import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";
import * as viewTileLogic from "./selectors/viewTile";
import * as sliceUtils from "../utils/sliceUtils";

export interface ViewTileState {
  // No separate state properties for ViewTileSlice
}

export interface ViewTileActions {
  // Actions
  initViewTile: (tileId: string, initialState?: Partial<viewTileLogic.ViewTile>) => void;
  updateViewTile: (tileId: string, updates: Partial<viewTileLogic.ViewTile>) => void;
}

export type ViewTileSlice = ViewTileState & ViewTileActions;

export const createViewTileSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  ViewTileSlice
> = (set) => ({
  // Actions
  initViewTile: (tileId, initialState) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile) return;
    
    // Initialize view tile data
    state.tilesById[tileId] = {
      ...tile,
      viewTile: viewTileLogic.initViewTile(initialState),
      type: 'View' // Ensure the tile type is set to 'View'
    };
  }),
  
  updateViewTile: (tileId, updates) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile || !tile.viewTile) return;
    
    // Filter out unchanged fields with the extended partially shallow logic
    const filteredUpdates = sliceUtils.filterUnchangedUpdates(tile.viewTile, updates);
    if (Object.keys(filteredUpdates).length === 0) return;
    
    // Update table-specific data if needed
    let updatedTile = tile;
    let tileUpdated = false;
    let itemsNeedRecompute = false;

    if (!updatedTile.viewTile) {
      updatedTile.viewTile = viewTileLogic.initViewTile();
      tileUpdated = true;
    }

    updatedTile.viewTile = viewTileLogic.updateViewTile(updatedTile.viewTile, filteredUpdates);
    tileUpdated = true;

    // Check if relevant fields are being updated that affect the tile item
    itemsNeedRecompute = Object.keys(filteredUpdates).some(
      key => viewTileLogic.VIEW_TILE_PROPS_KEYS_AS_VIEW_TILE_KEYS.includes(key as keyof typeof tile.viewTile)
    );

    // If we need to recompute, add the flag to the updates
    if (itemsNeedRecompute) {
      if (!updatedTile.itemsNeedRecompute) {
        updatedTile.itemsNeedRecompute = true;
        tileUpdated = true;
      }
    }

    // Also set the tab's flag if this tile has a tabId and needs recompute
    if (updatedTile.tabId && state.tabsById[updatedTile.tabId] && !state.tabsById[updatedTile.tabId].itemsNeedRecompute) {
      state.tabsById[updatedTile.tabId].itemsNeedRecompute = true;
    }

    // Apply the updated tile if needed
    if (tileUpdated) {
      state.tilesById[tileId] = updatedTile;
    }
  }),
}); 