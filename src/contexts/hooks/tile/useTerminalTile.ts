import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { useTileMeta } from './useTileMeta';
import { useShallow } from 'zustand/react/shallow';
import type {
  TerminalTile,
  TerminalTileData,
  TerminalTileMeta,
  TerminalTileUI,
} from '../../slices/selectors/terminalTile';
// ---------- defaults ----------
export const DEFAULT_USE_TERMINAL_TILE_RETURN = {
  terminalTile: null,
  terminalTileActions: null,
  exists: false,
};

export const DEFAULT_TERMINAL_TILE_META: TerminalTileMeta = {};
export const DEFAULT_TERMINAL_TILE_UI: TerminalTileUI = {};
export const DEFAULT_TERMINAL_TILE_UI_ACTIONS: TerminalTileUIActions = {};
export const DEFAULT_TERMINAL_TILE_META_ACTIONS: TerminalTileMetaActions = {};

// ---------- Action Interfaces ----------
export interface TerminalTileMetaActions {}
export interface TerminalTileDataActions {
  setShellType: (shell: string | null | undefined) => void;
}
export interface TerminalTileUIActions {}

export interface TerminalActions
  extends TerminalTileMetaActions, TerminalTileDataActions, TerminalTileUIActions {}

// ---------- Hook ----------
export function useTerminalTile(tileIdOrName: string | null, tabIdOrName?: string | null) {
  const { tileId, tileExists } = useTileMeta(tileIdOrName, tabIdOrName || null);

  const tileType = useStoreContext(
    useShallow((state) => {
      if (!tileId) return null;
      return state.tilesById[tileId]?.type;
    })
  );

  const isTerminalTile = tileExists && tileType === 'Terminal';

  const terminalTile = useStoreContext(
    useShallow((s) => {
      if (!isTerminalTile || !tileId) return null;
      // @ts-ignore dynamic prop
      return s.tilesById[tileId]?.terminalTile as TerminalTile;
    })
  );

  // Access store for terminal-specific meta data
  const terminalMeta = useMemo(() => {
    // Return empty object as per EditorTileMeta interface
    return DEFAULT_TERMINAL_TILE_META as TerminalTileMeta;
  }, []);

  // Access store for terminal-specific data
  const terminalData = useMemo(() => {
    if (!isTerminalTile || !tileId || !terminalTile) return null;

    return {
      shellType: terminalTile.shellType,
    } as TerminalTileData;
  }, [isTerminalTile, tileId, terminalTile]);

  // Access store for terminal-specific UI state
  const terminalUI = useMemo(() => {
    if (!isTerminalTile || !tileId) return null;
    // Return empty object as per TerminalTileUI interface
    return DEFAULT_TERMINAL_TILE_UI as TerminalTileUI;
  }, [isTerminalTile, tileId]);

  // Get store update functions
  const storeUpdateTerminalTile = useStoreContext((state) => state.updateTerminalTile);

  // Create memoized meta actions
  const terminalMetaActions = useMemo<TerminalTileMetaActions | null>(() => {
    if (!isTerminalTile || !tileId) return null;

    // Return empty object as per EditorTileMeta interface
    return DEFAULT_TERMINAL_TILE_META_ACTIONS as TerminalTileMetaActions;
  }, [isTerminalTile, tileId]);

  // Create memoized data actions
  const terminalDataActions = useMemo<TerminalTileDataActions | null>(() => {
    if (!isTerminalTile || !tileId) return null;

    return {
      setShellType: (shellType) => {
        const update: Partial<TerminalTile> = {
          shellType: shellType,
        };
        storeUpdateTerminalTile(tileId, update);
      },
    };
  }, [isTerminalTile, tileId, storeUpdateTerminalTile]);

  // Create memoized UI actions
  const terminalUIActions = useMemo<TerminalTileUIActions | null>(() => {
    if (!isTerminalTile || !tileId) return null;

    // Return empty object as per EditorTileUI interface
    return DEFAULT_TERMINAL_TILE_UI_ACTIONS as TerminalTileUIActions;
  }, [isTerminalTile, tileId]);

  // Build a final `terminalTile` object from the separate meta, data, and UI objects
  const combinedTerminalTile = useMemo(() => {
    if (!terminalMeta || !terminalData || !terminalUI) return null;

    return {
      ...terminalMeta,
      ...terminalData,
      ...terminalUI,
    };
  }, [terminalMeta, terminalData, terminalUI]);

  // Build a final `terminalTileActions` object from the separate meta, data, and UI actions
  const combinedTerminalTileActions = useMemo(() => {
    if (!terminalMetaActions || !terminalDataActions || !terminalUIActions) return null;

    return {
      ...terminalMetaActions,
      ...terminalDataActions,
      ...terminalUIActions,
    };
  }, [terminalMetaActions, terminalDataActions, terminalUIActions]);

  // If no tile name is provided or tile doesn't exist, return default
  if (!tileIdOrName || !isTerminalTile) {
    return DEFAULT_USE_TERMINAL_TILE_RETURN;
  }

  return {
    terminalTile: combinedTerminalTile as TerminalTile,
    terminalTileActions: combinedTerminalTileActions as TerminalActions,
    exists: isTerminalTile,
  };
}
