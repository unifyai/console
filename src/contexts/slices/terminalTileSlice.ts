import { StateCreator } from 'zustand';
import { StoreSlice } from './slice';
import * as terminalTileLogic from './selectors/terminalTile';
import * as sliceUtils from '../utils/sliceUtils';

export interface TerminalTileState {}

export interface TerminalTileActions {
  initTerminalTile: (
    tileId: string,
    initialState?: Partial<terminalTileLogic.TerminalTile>
  ) => void;
  updateTerminalTile: (tileId: string, updates: Partial<terminalTileLogic.TerminalTile>) => void;
}

export type TerminalTileSlice = TerminalTileState & TerminalTileActions;

export const createTerminalTileSlice: StateCreator<
  StoreSlice,
  [['zustand/immer', never]],
  [],
  TerminalTileSlice
> = (set) => ({
  initTerminalTile: (tileId, initialState) =>
    set((state) => {
      const tile = state.tilesById[tileId];
      if (!tile) return;

      state.tilesById[tileId] = {
        ...tile,
        terminalTile: terminalTileLogic.initTerminalTile(initialState),
        type: 'Terminal',
      };
    }),

  updateTerminalTile: (tileId, updates) =>
    set((state) => {
      const tile: any = state.tilesById[tileId];
      if (!tile || !tile.terminalTile) return;

      const filtered = sliceUtils.filterUnchangedUpdates(tile.terminalTile, updates);
      if (Object.keys(filtered).length === 0) return;

      let updated: any = tile;
      let tileUpdated = false;
      let itemsNeedRecompute = false;

      if (!updated.terminalTile) {
        updated.terminalTile = terminalTileLogic.initTerminalTile();
        tileUpdated = true;
      }

      updated.terminalTile = terminalTileLogic.updateTerminalTile(updated.terminalTile, filtered);
      tileUpdated = true;

      itemsNeedRecompute = Object.keys(filtered).some((key) =>
        terminalTileLogic.TERMINAL_TILE_PROPS_KEYS_AS_TILE_KEYS.includes(
          key as keyof terminalTileLogic.TerminalTile
        )
      );

      if (itemsNeedRecompute) {
        if (!updated.itemsNeedRecompute) {
          updated.itemsNeedRecompute = true;
          tileUpdated = true;
        }
      }

      if (
        updated.tabId &&
        state.tabsById[updated.tabId] &&
        !state.tabsById[updated.tabId].itemsNeedRecompute
      ) {
        state.tabsById[updated.tabId].itemsNeedRecompute = true;
      }

      if (tileUpdated) {
        state.tilesById[tileId] = updated;
      }
    }),
});
