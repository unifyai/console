import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";
import * as editorTileLogic from "./selectors/editorTile";
import * as sliceUtils from "../utils/sliceUtils";

export interface EditorTileState {
  // No separate state properties for EditorTileSlice
}

export interface EditorTileActions {
  // Actions
  initEditorTile: (tileId: string, initialState?: Partial<editorTileLogic.EditorTile>) => void;
  updateEditorTile: (tileId: string, updates: Partial<editorTileLogic.EditorTile>) => void;
}

export type EditorTileSlice = EditorTileState & EditorTileActions;

export const createEditorTileSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  EditorTileSlice
> = (set) => ({
  // Actions
  initEditorTile: (tileId, initialState) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile) return;

    // Initialize editor tile data
    state.tilesById[tileId] = {
      ...tile,
      editorTile: editorTileLogic.initEditorTile(initialState),
      type: 'Editor' // Ensure the tile type is set to 'Editor'
    };
  }),

  updateEditorTile: (tileId, updates) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile || !tile.editorTile) return;

    // Filter out unchanged fields with the extended partially shallow logic
    const filteredUpdates = sliceUtils.filterUnchangedUpdates(tile.editorTile, updates);
    if (Object.keys(filteredUpdates).length === 0) return;

    // Update table-specific data if needed
    let updatedTile = tile;
    let tileUpdated = false;
    let itemsNeedRecompute = false;

    if (!updatedTile.editorTile) {
      updatedTile.editorTile = editorTileLogic.initEditorTile();
      tileUpdated = true;
    }

    updatedTile.editorTile = editorTileLogic.updateEditorTile(updatedTile.editorTile, filteredUpdates);
    tileUpdated = true;

    // Check if relevant fields are being updated that affect the tile item
    itemsNeedRecompute = Object.keys(filteredUpdates).some(
      key => editorTileLogic.EDITOR_TILE_PROPS_KEYS_AS_EDITOR_TILE_KEYS.includes(key as keyof typeof tile.editorTile)
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
