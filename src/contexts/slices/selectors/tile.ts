import { PlotTile } from './plotTile';
import { TableTile } from './tableTile';
import { ViewTile } from './viewTile';
import { EditorTile } from './editorTile';
import { TerminalTile } from './terminalTile';
import { tabTypes } from '@/constants/logs';

import * as tableTileLogic from './tableTile';
import * as plotTileLogic from './plotTile';
import * as viewTileLogic from './viewTile';
import * as editorTileLogic from './editorTile';
import * as terminalTileLogic from './terminalTile';

export interface TilePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TileType = 'Table' | 'Plot' | 'View' | 'Editor' | 'Terminal';

// Tile metadata - core identifying information
export interface TileMeta {
  id: string;
  name: string;
  type?: (typeof tabTypes)[number] | null; // Optional during initialization, can only be "Table", "Plot", "View", "Editor", or "Terminal"
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
  autoUpdate?: string | null;
  freeze?: string | null;
  filters?: string | null;
  commonFilter?: string | null;
  metric?: string | null; // Current metric being displayed
  columnContext?: string | null;
  grouping?: string | null;
}

// Tile UI state - UI-related state
export interface TileUI {
  tabId: string | null;
  visible?: boolean;
  locked?: boolean;
  pending: boolean;
  loading?: boolean;
  error?: string | null;
  moved?: boolean;
  static?: boolean;
  color?: string;
  itemsNeedRecompute: boolean; // Flag to indicate when tileProps needs recomputing
}

// Combined Tile state definition
export interface Tile extends TileMeta, TileData, TileUI {
  // Reference to the content-specific data
  tableTile: TableTile | null;
  plotTile: PlotTile | null;
  viewTile: ViewTile | null;
  editorTile: EditorTile | null;
  terminalTile: TerminalTile | null;
}

// tileKeys: all keys that are used in `asTileItem` in `useTile` hook to convert
// a Tile into a TileProps
export const TILE_PROPS_KEYS_AS_TILE_KEYS: (keyof Tile)[] = [
  'id',
  'name',
  'type',
  'position',
  'minW',
  'minH',
  'context',
  'table',
  'autoUpdate',
  'freeze',
  'filters',
  'commonFilter',
  'metric',
  'columnContext',
  'grouping',
  'visible',
  'moved',
  'static',
  'color',
];

export const TILE_KEYS: (keyof Tile)[] = [
  ...TILE_PROPS_KEYS_AS_TILE_KEYS,
  'tabId',
  'locked',
  'pending',
  'loading',
  'error',
  'itemsNeedRecompute',
  'tableTile',
  'plotTile',
  'viewTile',
  'editorTile',
  'terminalTile',
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
    autoUpdate: initialState.autoUpdate !== undefined ? initialState.autoUpdate : null,
    freeze: initialState.freeze !== undefined ? initialState.freeze : null,
    filters: initialState.filters !== undefined ? initialState.filters : null,
    commonFilter: initialState.commonFilter !== undefined ? initialState.commonFilter : null,
    metric: initialState.metric !== undefined ? initialState.metric : null,
    columnContext: initialState.columnContext !== undefined ? initialState.columnContext : null,
    grouping: initialState.grouping !== undefined ? initialState.grouping : null,

    // UI
    tabId: initialState.tabId || null,
    visible: initialState.visible,
    locked: initialState.locked !== undefined ? initialState.locked : false,
    pending: initialState.pending !== undefined ? initialState.pending : false,
    loading: initialState.loading !== undefined ? initialState.loading : false,
    error: initialState.error !== undefined ? initialState.error : null,
    moved: initialState.moved,
    static: initialState.static,
    color: initialState.color,
    itemsNeedRecompute:
      initialState.itemsNeedRecompute !== undefined ? initialState.itemsNeedRecompute : false,

    // Type-specific data references
    tableTile:
      initialState.tableTile !== undefined
        ? initialState.tableTile
        : tableTileLogic.initTableTile(),
    plotTile:
      initialState.plotTile !== undefined ? initialState.plotTile : plotTileLogic.initPlotTile(),
    viewTile:
      initialState.viewTile !== undefined ? initialState.viewTile : viewTileLogic.initViewTile(),
    editorTile:
      initialState.editorTile !== undefined
        ? initialState.editorTile
        : editorTileLogic.initEditorTile(),
    terminalTile:
      initialState.terminalTile !== undefined
        ? initialState.terminalTile
        : terminalTileLogic.initTerminalTile(),
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
      ...position,
    },
    // updatedAt: new Date().toISOString()
  };
}
