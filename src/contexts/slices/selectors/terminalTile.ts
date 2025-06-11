// ( IMPORTANT )
// NOTE: When adding new properties, make sure to update the TERMINAL_TILE_KEYS array in this file.

// -----------------------------------------------------------------------------
// Terminal Tile –  Types
// -----------------------------------------------------------------------------

// Meta (id, timestamps, etc.) – add later if required
export interface TerminalTileMeta {}

// Business-level data stored for a Terminal tile
export interface TerminalTileData {
  shell_type?: string | null; // "bash", "zsh", etc.
}

// UI-only flags (focused, loading, etc.)
export interface TerminalTileUI {}

// Combined
export type TerminalTile = TerminalTileMeta & TerminalTileData & TerminalTileUI;

// Keys that must be copied into the generic TileProps when converting  TerminalTile → TileProps in useTile hook
export const TERMINAL_TILE_PROPS_KEYS_AS_TILE_KEYS: (keyof TerminalTile)[] = ["shell_type"];

// All known keys for TerminalTile (union)
export const TERMINAL_TILE_KEYS: (keyof TerminalTile)[] = [
  ...TERMINAL_TILE_PROPS_KEYS_AS_TILE_KEYS,
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function initTerminalTile(initialState: Partial<TerminalTile> = {}): TerminalTile {
  return {
    // Data
    shell_type: initialState.shell_type !== undefined ? initialState.shell_type : null,
    // Allow callers to override / add UI or meta props
    ...initialState,
  } as TerminalTile;
}

export function updateTerminalTile(terminalTile: TerminalTile, updates: Partial<TerminalTile>): TerminalTile {
  return {
    ...terminalTile,
    ...updates,
  };
} 