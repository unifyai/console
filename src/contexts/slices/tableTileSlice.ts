import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";
import * as tableTileLogic from "./selectors/tableTile";
import * as tileLogic from "./selectors/tile";
import * as sliceUtils from "../utils/sliceUtils";

export interface TableTileState {
  // No separate state properties for TableTileSlice
}

export interface TableTileActions {
  // Actions
  initTableTile: (tileId: string, initialState?: Partial<tableTileLogic.TableTile>) => void;
  updateTableTile: (tileId: string, updates: Partial<tableTileLogic.TableTile>) => void;
}

export type TableTileSlice = TableTileState & TableTileActions;

export const createTableTileSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  TableTileSlice
> = (set) => ({
  // Actions
  initTableTile: (tileId, initialState) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile) return;
    
    // Initialize table tile data
    state.tilesById[tileId] = {
      ...tile,
      tableTile: tableTileLogic.initTableTile(initialState),
      type: 'Table' // Ensure the tile type is set to 'Table'
    };
  }),
  
  updateTableTile: (tileId, updates) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile || !tile.tableTile) return;
    
    // Filter out unchanged fields with the extended partially shallow logic
    const filteredUpdates = sliceUtils.filterUnchangedProps(tile.tableTile, updates);
    if (Object.keys(filteredUpdates).length === 0) return;

    // Update table-specific data if needed
    let updatedTile = tile;
    let tileUpdated = false;
    let itemsNeedRecompute = false;

    if (!updatedTile.tableTile) {
      updatedTile.tableTile = tableTileLogic.initTableTile();
      tileUpdated = true;
    }

    updatedTile.tableTile = tableTileLogic.updateTableTile(updatedTile.tableTile, filteredUpdates);
    tileUpdated = true;

    // Check if relevant fields are being updated that affect the tile item
    itemsNeedRecompute = Object.keys(filteredUpdates).some(
      key => tileLogic.TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS.includes(key as keyof typeof tile.tableTile)
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