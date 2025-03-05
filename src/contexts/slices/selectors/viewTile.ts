// View type
export type ViewType = 'html' | 'markdown' | 'code' | 'iframe' | 'image' | 'pdf';

// View tile data
export interface ViewTileData {
  id: string;
  title: string;
  type: 'html' | 'markdown' | 'code' | 'iframe' | 'image' | 'pdf';
  content: string;
  sourceUrl: string | null;
  codeLanguage?: string;
  iframeSandbox?: boolean;
  imageAlt?: string;
  pdfPage?: number;
  pdfZoom?: number;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Initialize a new view tile in the nested state
 */
export function initViewTile(
  tileData: any,
  tileId: string,
  type: ViewType = 'html',
  initialState: Partial<ViewTileData> = {}
): void {
  // Create default state for the view tile
  const defaultState: ViewTileData = {
    id: tileId,
    title: initialState.title || `View ${tileId}`,
    type: initialState.type || type,
    content: initialState.content || '',
    sourceUrl: initialState.sourceUrl || null,
    codeLanguage: initialState.codeLanguage || 'javascript',
    iframeSandbox: initialState.iframeSandbox || true,
    imageAlt: initialState.imageAlt || '',
    pdfPage: initialState.pdfPage || 1,
    pdfZoom: initialState.pdfZoom || 1.0,
    loading: initialState.loading || false,
    error: initialState.error || null,
    lastUpdated: initialState.lastUpdated || null,
    createdAt: initialState.createdAt || new Date().toISOString(),
    updatedAt: initialState.updatedAt || new Date().toISOString()
  };
  
  // Add type-specific defaults if they're not provided
  if (defaultState.type === 'code' && !defaultState.codeLanguage) {
    defaultState.codeLanguage = 'javascript';
  } else if (defaultState.type === 'iframe' && defaultState.iframeSandbox === undefined) {
    defaultState.iframeSandbox = true;
  } else if (defaultState.type === 'image' && !defaultState.imageAlt) {
    defaultState.imageAlt = '';
  } else if (defaultState.type === 'pdf') {
    if (!defaultState.pdfPage) defaultState.pdfPage = 1;
    if (!defaultState.pdfZoom) defaultState.pdfZoom = 1.0;
  }
  
  // Set the data on the tile object
  tileData.type = 'View';
  tileData.data = defaultState;
}

/**
 * Update a view tile in the nested state
 */
export function updateViewTile(
  tileData: any,
  updates: Partial<ViewTileData>
): void {
  if (tileData && tileData.type === 'View') {
    Object.assign(tileData.data, {
      ...updates,
      lastUpdated: new Date().toISOString()
    });
  }
}
