import { PlotTile } from "./plotTile";
import { TableTile } from "./tableTile";
import { ViewTile } from "./viewTile";
import { tabTypes } from "@/constants/logs";

import * as tableTileLogic from "./tableTile";
import * as plotTileLogic from "./plotTile";
import * as viewTileLogic from "./viewTile";


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
  type?: (typeof tabTypes)[number] | null; // Optional during initialization, can only be "Table", "Plot", or "View"
  position: TilePosition;
  minW?: number | null;
  minH?: number | null;
  // createdAt: string;
  // updatedAt: string;
}

// Tile data - business data and relationships
export interface TileData {
  context?: string | null;
  table?: string | null;
  auto_update?: string | null;
  freeze?: string | null;
  filters?: string | null;
  common_filter?: string | null;
  metric?: string | null;         // Current metric being displayed
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

// tileKeys: all keys that are used in `asTileItem` in `useTile` hook to convert
// a Tile into a TileProps
export const TILE_PROPS_KEYS_AS_TILE_KEYS: (keyof Tile)[] = [
  "id","name","type","position","minW","minH","context","table","auto_update",
  "freeze","filters","common_filter","metric","visible","moved","static",
];

export const TILE_KEYS: (keyof Tile)[] = [
  ...TILE_PROPS_KEYS_AS_TILE_KEYS,
  "projectId","interfaceId","tabId","locked","pending","loading", "error",
  "itemsNeedRecompute","tableTile","plotTile","viewTile",
];

/**
 * Initialize a new tile
 */
export function initTile(tileId: string, initialState: Partial<Tile> = {}): Tile {
  return {
    // Meta
    id: tileId,
    name: initialState.name || `Tile ${tileId}`,
    type: initialState.type !== undefined ? initialState.type : null,
    position: initialState.position || { x: 0, y: 0, width: 4, height: 4 },
    minW: initialState.minW || null,
    minH: initialState.minH || null,
    // createdAt: initialState.createdAt || new Date().toISOString(),
    // updatedAt: initialState.updatedAt || new Date().toISOString(),
    
    // Data
    context: initialState.context !== undefined ? initialState.context : null,
    table: initialState.table !== undefined ? initialState.table : null,
    auto_update: initialState.auto_update !== undefined ? initialState.auto_update : null,
    freeze: initialState.freeze !== undefined ? initialState.freeze : null,
    filters: initialState.filters !== undefined ? initialState.filters : null,
    common_filter: initialState.common_filter !== undefined ? initialState.common_filter : null,
    metric: initialState.metric !== undefined ? initialState.metric : null,
    
    // UI
    projectId: initialState.projectId || null,
    interfaceId: initialState.interfaceId || null,
    tabId: initialState.tabId || null,
    visible: initialState.visible,
    locked: initialState.locked !== undefined ? initialState.locked : false,
    pending: initialState.pending !== undefined ? initialState.pending : false,
    loading: initialState.loading !== undefined ? initialState.loading : false,
    error: initialState.error !== undefined ? initialState.error : null,
    moved: initialState.moved,
    static: initialState.static,
    itemsNeedRecompute: initialState.itemsNeedRecompute !== undefined ? initialState.itemsNeedRecompute : false,
    
    // Type-specific data references
    tableTile: initialState.tableTile !== undefined ? initialState.tableTile : tableTileLogic.initTableTile(),
    plotTile: initialState.plotTile !== undefined ? initialState.plotTile : plotTileLogic.initPlotTile(),
    viewTile: initialState.viewTile !== undefined ? initialState.viewTile : viewTileLogic.initViewTile(),
    
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
