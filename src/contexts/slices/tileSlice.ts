import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";
import * as tileLogic from "./selectors/tile";
import * as tabLogic from "./selectors/tab";
import * as tableTileLogic from "./selectors/tableTile";
import * as plotTileLogic from "./selectors/plotTile";
import * as viewTileLogic from "./selectors/viewTile";
import * as sliceUtils from "../utils/sliceUtils";
import { Tile } from "./selectors/tile";

export interface TileState {
  // State
  tilesById: Record<string, tileLogic.Tile>;
}

export interface TileActions {
  // Actions
  initTile: (tabId: string, tileId: string, initialState?: Partial<tileLogic.Tile>) => void;
  addTile: (tabId: string, sourceTileId: string, newTileId: string, initialState?: Partial<tileLogic.Tile>) => void;
  removeTile: (tabId: string, tileId: string) => void;
  renameTile: (tabId: string, sourceTileId: string, newTileId: string, initialState?: Partial<tileLogic.Tile>) => void;
  updateTile: (tileId: string, updates: Partial<tileLogic.Tile>) => void;
}

export type TileSlice = TileState & TileActions;

export const createTileSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  TileSlice
> = (set) => ({
  // State
  tilesById: {},
  
  // Actions
  initTile: (tabId, tileId, initialState) => set(state => {
    const tab = state.tabsById[tabId];
    if (!tab) return;
    
    // Only initialize if it doesn't exist
    if (!state.tilesById[tileId]) {
      const newTile = tileLogic.initTile(tileId, initialState);
      state.tilesById[tileId] = newTile;
      
      // Initialize type-specific data if needed
      if (newTile.type === 'Table') {
        state.tilesById[tileId].tableTile = tableTileLogic.initTableTile();
      } else if (newTile.type === 'Plot') {
        state.tilesById[tileId].plotTile = plotTileLogic.initPlotTile();
      } else if (newTile.type === 'View') {
        state.tilesById[tileId].viewTile = viewTileLogic.initViewTile();
      }
      
      // Add the tile to the tab
      state.tabsById[tabId] = tabLogic.addTileId(tab, tileId);
    }
  }),

  addTile: (tabId, sourceTileId, newTileId, initialState) => set(state => {
    sliceUtils.addTile(state, tabId, sourceTileId, newTileId, initialState);
  }),
  
  removeTile: (tabId, tileId) => set(state => {
    sliceUtils.removeTile(state, tabId, tileId);
  }),

  renameTile: (tabId, sourceTileId, newTileId, initialState) => set(state => {
    sliceUtils.renameTile(state, tabId, sourceTileId, newTileId, initialState);
  }),
  
  updateTile: (tileId, updates) => set(state => {
    const tile = state.tilesById[tileId];

    if (tile) {
      const { tileUpdates, tableTileUpdates, plotTileUpdates, viewTileUpdates } = sliceUtils.splitTileUpdates(updates);

      let updatedTile = tile;
      let tileUpdated = false;
      let itemsNeedRecompute = false;
      
      // Update core tile properties
      if (Object.keys(tileUpdates).length > 0) {
        const filteredTileUpdates = sliceUtils.filterUnchangedUpdates(tile, tileUpdates);
        if (Object.keys(filteredTileUpdates).length > 0) {
          updatedTile = tileLogic.updateTile(tile, filteredTileUpdates);
          tileUpdated = true;

          // Check if core tile updates need to recompute items
          itemsNeedRecompute = Object.keys(tileUpdates).some(
            key => tileLogic.TILE_PROPS_KEYS_AS_TILE_KEYS.includes(key as keyof Tile)
          );
        }
      }
      
      // Update table-specific data if needed
      if (Object.keys(tableTileUpdates).length > 0) {
        if (!updatedTile.tableTile) {
          updatedTile.tableTile = tableTileLogic.initTableTile();
          tileUpdated = true;
        }
        
        const filteredTableTileUpdates = sliceUtils.filterUnchangedUpdates(updatedTile.tableTile, tableTileUpdates);
        if (Object.keys(filteredTableTileUpdates).length > 0) {
          updatedTile.tableTile = tableTileLogic.updateTableTile(updatedTile.tableTile, filteredTableTileUpdates);
          tileUpdated = true;

          // Check if table tile updates need recompute
          itemsNeedRecompute = Object.keys(filteredTableTileUpdates).some(
            key => tableTileLogic.TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS.includes(key as keyof typeof tile.tableTile)
          );
        }
      }
      
      // Update plot-specific data if needed
      if (Object.keys(plotTileUpdates).length > 0) {
        if (!updatedTile.plotTile) {
          updatedTile.plotTile = plotTileLogic.initPlotTile();
          tileUpdated = true;
        }
        
        const filteredPlotTileUpdates = sliceUtils.filterUnchangedUpdates(updatedTile.plotTile, plotTileUpdates);
        if (Object.keys(filteredPlotTileUpdates).length > 0) {
          updatedTile.plotTile = plotTileLogic.updatePlotTile(updatedTile.plotTile, filteredPlotTileUpdates);
          tileUpdated = true;

          // Check if plot tile updates need recompute
          itemsNeedRecompute = Object.keys(filteredPlotTileUpdates).some(
            key => plotTileLogic.PLOT_TILE_PROPS_KEYS_AS_PLOT_TILE_KEYS.includes(key as keyof typeof tile.plotTile)
          );
        }
      }

      // Update view-specific data if needed
      if (Object.keys(viewTileUpdates).length > 0) {
        if (!updatedTile.viewTile) {
          updatedTile.viewTile = viewTileLogic.initViewTile();
          tileUpdated = true;
        }

        const filteredViewTileUpdates = sliceUtils.filterUnchangedUpdates(updatedTile.viewTile, viewTileUpdates);
        if (Object.keys(filteredViewTileUpdates).length > 0) {
          updatedTile.viewTile = viewTileLogic.updateViewTile(updatedTile.viewTile, filteredViewTileUpdates);
          tileUpdated = true;

          // Check if view tile updates need recompute
          itemsNeedRecompute = Object.keys(filteredViewTileUpdates).some(
            key => viewTileLogic.VIEW_TILE_PROPS_KEYS_AS_VIEW_TILE_KEYS.includes(key as keyof typeof tile.viewTile)
          );
        }
      }

      // If we need to recompute, add the flag to the updates
      if (itemsNeedRecompute) {
        if (!updatedTile.itemsNeedRecompute) {
          updatedTile.itemsNeedRecompute = true;
          tileUpdated = true;
        }

        // Also set the tab's flag if this tile has a tabId
        if (updatedTile.tabId && state.tabsById[updatedTile.tabId] && !state.tabsById[updatedTile.tabId].itemsNeedRecompute) {
          state.tabsById[updatedTile.tabId].itemsNeedRecompute = true;
        }
      }

      // Apply the updated tile if needed
      if (tileUpdated) {
        state.tilesById[tileId] = updatedTile;
      }
    }
  }),
}); 