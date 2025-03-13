// View type
export type ViewType = 'html' | 'markdown' | 'code' | 'iframe' | 'image' | 'pdf';

// View tile data
export interface ViewTileData {
  lastUpdated: string | null;
  createdAt: string;
  updatedAt: string;

  // ( IMPORTANT )
  // NOTE: When adding new properties, make sure to update the VIEW_TILE_KEYS array in the useTile hook.
  // Look at the tableTile and plotTile files for examples.
}

/**
 * Initialize a new view tile in the nested state
 */
export function initViewTileData(
  initialState: Partial<ViewTileData> = {}
): ViewTileData {
  // Create default state for the view tile
  return {
    lastUpdated: initialState.lastUpdated || null,
    createdAt: initialState.createdAt || new Date().toISOString(),
    updatedAt: initialState.updatedAt || new Date().toISOString(),
    ...initialState,
  } as ViewTileData;
}

/**
 * Update a view tile in the nested state
 */
export function updateViewTileData(
  viewTile: ViewTileData,
  updates: Partial<ViewTileData>
): ViewTileData {
  return {
    ...viewTile,
    ...updates,
    updatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}
