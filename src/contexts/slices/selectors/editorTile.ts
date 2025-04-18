// ( IMPORTANT )
// NOTE: When adding new properties, make sure to update the EDITOR_TILE_KEYS array in this file.
// Look at the tableTile and plotTile files for examples.

// Editor tile data - combined data structure with all properties
export interface EditorTileMeta {
  // Meta properties
}

// Editor tile data - business data 
export interface EditorTileData {
  file_name?: string; // name of the file
  file_type?: string; // type of file
  content?: string | null; // content of the file
}

// Editor tile UI - UI-related state
export interface EditorTileUI {
}

// Combined Editor tile type
export type EditorTile = EditorTileMeta & EditorTileData & EditorTileUI;


// editorTileKeys: all keys that are used in `asTileItem` in `useTile` hook to convert
// a EditorTile into a TileProps
export const EDITOR_TILE_PROPS_KEYS_AS_EDITOR_TILE_KEYS: (keyof EditorTile)[] = ["file_name", "file_type", "content"];

// editorTileKeys: all fields for EditorTile
export const EDITOR_TILE_KEYS: (keyof EditorTile)[] = [
  ...EDITOR_TILE_PROPS_KEYS_AS_EDITOR_TILE_KEYS,
];


/**
 * Initialize a new editor tile
 */
export function initEditorTile(
  initialState: Partial<EditorTile> = {}
): EditorTile {
  return {
    // Data
    file_name: initialState.file_name !== undefined ? initialState.file_name : null,
    file_type: initialState.file_type !== undefined ? initialState.file_type : null,
    content: initialState.content !== undefined ? initialState.content : null,

    ...initialState,
  } as EditorTile;
}

/**
 * Update a editor tile
 */
export function updateEditorTile(
  editorTile: EditorTile,
  updates: Partial<EditorTile>
): EditorTile {
  return {
    ...editorTile,
    ...updates,
  };
}
