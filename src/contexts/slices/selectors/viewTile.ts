// ( IMPORTANT )
// NOTE: When adding new properties, make sure to update the VIEW_TILE_KEYS array in this file.
// Look at the tableTile and plotTile files for examples.

// View tile data - combined data structure with all properties
export interface ViewTileMeta {
  // Meta properties
}

// View tile data - business data 
export interface ViewTileData {
  base_index?: string | null;     // Base index for the table
}

// View tile UI - UI-related state
export interface ViewTileUI {
}

// Combined View tile type
export type ViewTile = ViewTileMeta & ViewTileData & ViewTileUI;

// viewTileKeys: all fields for ViewTile
export const VIEW_TILE_KEYS: (keyof ViewTile)[] = ["base_index"];


/**
 * Initialize a new view tile
 */
export function initViewTile(
  initialState: Partial<ViewTile> = {}
): ViewTile {
  return {
    // Data
    base_index: initialState.base_index,

    ...initialState,
  } as ViewTile;
}

/**
 * Update a view tile
 */
export function updateViewTile(
  viewTile: ViewTile,
  updates: Partial<ViewTile>
): ViewTile {
  return {
    ...viewTile,
    ...updates,
  };
}
