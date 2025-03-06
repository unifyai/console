// View type
export type ViewType = 'html' | 'markdown' | 'code' | 'iframe' | 'image' | 'pdf';

// View tile data
export interface ViewTileData {
  id: string;
  title: string;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  createdAt: string;
  updatedAt: string;

  // Table-specific fields from TileProps
  table?: string;          // Table identifier
}

/**
 * Initialize a new view tile in the nested state
 */
export function initViewTile(
  tileId: string,
  initialState: Partial<ViewTileData> = {}
): ViewTileData {
  // Create default state for the view tile
  return {
    id: tileId,
    title: initialState.title || `View ${tileId}`,
    loading: initialState.loading || false,
    error: initialState.error || null,
    lastUpdated: initialState.lastUpdated || null,
    createdAt: initialState.createdAt || new Date().toISOString(),
    updatedAt: initialState.updatedAt || new Date().toISOString(),

    // Table-specific fields from TileProps
    table: initialState.table,
  } as ViewTileData;
}

/**
 * Update a view tile in the nested state
 */
export function updateViewTile(
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
