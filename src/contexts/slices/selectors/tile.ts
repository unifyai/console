import { PlotTile } from "./plotTile";
import { TableTile } from "./tableTile";
import { ViewTile } from "./viewTile";
import { tabTypes } from "@/constants/logs";


export interface TilePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Tile metadata - core identifying information
export interface TileMeta {
  id: string;
  name: string;
  type?: (typeof tabTypes)[number]; // Optional during initialization, can only be "Table", "Plot", or "View"
  position: TilePosition;
  minW?: number;
  minH?: number;
  // createdAt: string;
  // updatedAt: string;
}

// Tile data - business data and relationships
export interface TileData {
  context?: string;
  table?: string;
  auto_update?: string;
  freeze?: string;
  filters?: string;
  common_filter?: string;
}

// Tile UI state - UI-related state
export interface TileUI {
  projectId: string | null;
  interfaceId: string | null;
  tabId: string | null;
  visible?: boolean;
  locked?: boolean;
  pending: boolean;
  loading?: boolean;
  error?: string | null;
  moved?: boolean;
  static?: boolean;
  itemsNeedRecompute: boolean; // Flag to indicate when tileProps needs recomputing
}

// Combined Tile state definition
export interface Tile extends TileMeta, TileData, TileUI {
  // Reference to the content-specific data
  tableTile: TableTile | null;
  plotTile: PlotTile | null;
  viewTile: ViewTile | null;
}

// tableKeys: all keys that are used in `asTileItem` in `useTable` hook to convert
// a TableTile into a TableTileProps
export const TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS: (keyof TableTile)[] = [
  "table_type", "column_context", "page_number", "metric", "column_order", 
  "hidden_columns", "sorting", "grouping", "group_sorting", 
  "columns_pin_left", "columns_pin_right", "selected", "base_index"
];

// plotKeys: all keys that are used in `asTileItem` in `usePlot` hook to convert
// a PlotTile into a PlotTileProps
export const PLOT_TILE_PROPS_KEYS_AS_PLOT_TILE_KEYS: (keyof PlotTile)[] = [
  "plot_type", "plot_scale_x", "plot_scale_y", "is_aggregated",
  "x_axis", "y_axis", "plot_group_by", "bin_count", "regression_line"
];

// viewKeys: all keys that are used in `asTileItem` in `useView` hook to convert
// a ViewTile into a ViewTileProps
export const VIEW_TILE_PROPS_KEYS_AS_VIEW_TILE_KEYS: (keyof ViewTile)[] = [];

// tileKeys: all keys that are used in `asTileItem` in `useTile` hook to convert
// a Tile into a TileProps
export const TILE_PROPS_KEYS_AS_TILE_KEYS: (keyof Tile | keyof TableTile | keyof PlotTile | keyof ViewTile)[] = [
  "id","name","type","position","minW","minH","visible","type","moved",
  "static","context","table","auto_update","freeze","filters",
  "common_filter",
  ...TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS,
  ...PLOT_TILE_PROPS_KEYS_AS_PLOT_TILE_KEYS,
  ...VIEW_TILE_PROPS_KEYS_AS_VIEW_TILE_KEYS,
];

export const TILE_KEYS: (keyof Tile)[] = [
  "id","name","type","position","minW","minH","visible","locked","pending",
  "loading", "error","moved","static","context","table","auto_update","freeze",
  "filters","common_filter","projectId","interfaceId","tabId","itemsNeedRecompute",
  "tableTile","plotTile","viewTile",
];

/**
 * Initialize a new tile
 */
export function initTile(tileId: string, initialState: Partial<Tile> = {}): Tile {
  return {
    // Meta
    id: tileId,
    name: initialState.name || `Tile ${tileId}`,
    type: initialState.type,
    position: initialState.position || { x: 0, y: 0, width: 4, height: 4 },
    minW: initialState.minW || undefined,
    minH: initialState.minH || undefined,
    // createdAt: initialState.createdAt || new Date().toISOString(),
    // updatedAt: initialState.updatedAt || new Date().toISOString(),
    
    // Data
    context: initialState.context,
    table: initialState.table,
    auto_update: initialState.auto_update,
    freeze: initialState.freeze,
    filters: initialState.filters,
    common_filter: initialState.common_filter,
    
    // UI
    projectId: initialState.projectId || null,
    interfaceId: initialState.interfaceId || null,
    tabId: initialState.tabId || null,
    visible: initialState.visible,
    locked: initialState.locked,
    pending: initialState.pending !== undefined ? initialState.pending : false,
    loading: initialState.loading,
    error: initialState.error,
    moved: initialState.moved,
    static: initialState.static,
    itemsNeedRecompute: initialState.itemsNeedRecompute !== undefined ? initialState.itemsNeedRecompute : false,
    
    // Type-specific data references
    tableTile: initialState.tableTile || null,
    plotTile: initialState.plotTile || null,
    viewTile: initialState.viewTile || null,
    
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
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Set a specific property of a tile
 */
export function setTileProperty<K extends keyof Tile>(
  tile: Tile, 
  property: K, 
  value: Tile[K]
): Tile {
  return {
    ...tile,
    [property]: value,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Update a tile's position
 */
export function updateTilePosition(tile: Tile, position: Partial<TilePosition>): Tile {
  return {
    ...tile,
    position: {
      ...tile.position,
      ...position
    },
    // updatedAt: new Date().toISOString()
  };
}
