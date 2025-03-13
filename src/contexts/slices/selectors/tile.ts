import { PlotTileData } from "./plotTile";
import { TableTileData } from "./tableTile";
import { ViewTileData } from "./viewTile";
import { tabTypes } from "@/constants/logs";

// Tile position
export interface TilePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Base tile interface with common fields shared across all tile types
export interface Tile {
  // ( IMPORTANT )
  // NOTE: When adding new fields here from TileProps in grid.ts,
  // make sure to update the TILE_KEYS array in the useTile hook
  // Core tile properties
  id: string;
  name: string;
  type?: (typeof tabTypes)[number]; // Optional during initialization, can only be "Table", "Plot", or "View"
  position: TilePosition;
  minW?: number;
  minH?: number;
  visible?: boolean;
  locked?: boolean;
  pending: boolean;
  loading?: boolean;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Grid-specific optional fields
  moved?: boolean;
  static?: boolean;
  
  // Common fields shared across tile types
  context?: string;
  table?: string;
  auto_update?: string;
  freeze?: string;
  filters?: string;
  common_filter?: string;
  
  // Reference to the content-specific data
  tableData: TableTileData | null;
  plotData: PlotTileData | null;
  viewData: ViewTileData | null;
}

/**
 * Initialize a new tile
 */
export function initTile(tileId: string, initialState: Partial<Tile> = {}): Tile {
  return {
    id: tileId,
    name: initialState.name || `Tile ${tileId}`,
    type: initialState.type,
    position: initialState.position || { x: 0, y: 0, width: 4, height: 4 },
    minW: initialState.minW,
    minH: initialState.minH,
    visible: initialState.visible,
    locked: initialState.locked,
    pending: initialState.pending !== undefined ? initialState.pending : false,
    loading: initialState.loading,
    error: initialState.error,
    createdAt: initialState.createdAt || new Date().toISOString(),
    updatedAt: initialState.updatedAt || new Date().toISOString(),
    
    // Grid-specific fields
    moved: initialState.moved,
    static: initialState.static,
    
    // Common fields shared across tile types
    context: initialState.context,
    table: initialState.table,
    auto_update: initialState.auto_update,
    freeze: initialState.freeze,
    filters: initialState.filters,
    common_filter: initialState.common_filter,
    
    // Reference to the content-specific data
    tableData: initialState.tableData || null,
    plotData: initialState.plotData || null,
    viewData: initialState.viewData || null,
    ...initialState,
  };
}

/**
 * Update an existing tile
 */
export function updateTile(tile: Tile, updates: Partial<Tile>): Tile {
  return {
    ...tile,
    ...updates,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Set a specific property on a tile
 */
export function setTileProperty<K extends keyof Tile>(
  tile: Tile, 
  property: K, 
  value: Tile[K]
): Tile {
  return {
    ...tile,
    [property]: value,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Update the position of a tile
 */
export function updateTilePosition(tile: Tile, position: Partial<TilePosition>): Tile {
  return {
    ...tile,
    position: {
      ...tile.position,
      ...position
    },
    updatedAt: new Date().toISOString()
  };
}
