import { TableDataItem } from "@/types/evals/grid";

// ( IMPORTANT )
// NOTE: When adding new fields here,
// make sure to update the TABLE_TILE_KEYS array in this file.
// Look at the plotTile and viewTile files for examples.

// Table tile meta - metadata information
export interface TableTileMeta {
}

// Table-specific fields from TileProps

// Table tile data - business data
export interface TableTileData {
  table_type?: string;     // Type of table
  metric?: string;         // Current metric being displayed
  column_order?: string;   // Column ordering information
  hidden_columns?: string; // Hidden columns configuration
  sorting?: string;        // Sorting expression
  grouping?: string;       // Grouping expression
  group_sorting?: string;  // How groups are sorted
  columns_pin_left?: string; // Columns pinned to the left
  columns_pin_right?: string; // Columns pinned to the right
  selected?: string;       // Selected items in the table

  // Table data item
  tableDataItem?: TableDataItem;
}

// Table tile UI - UI-related state
export interface TableTileUI {
  limit: number;
  offset: number;
  column_context?: string; // Context for columns display
  page_number?: string;    // Current page for pagination
}

// Combined Table tile type
export type TableTile = TableTileMeta & TableTileData & TableTileUI;

// tableTileKeys: all fields for TableTile
export const TABLE_TILE_KEYS: (keyof TableTile)[] = [
  "table_type","metric","column_order","hidden_columns","sorting",
  "grouping","group_sorting","columns_pin_left","columns_pin_right",
  "selected","tableDataItem","limit","offset",
  "column_context","page_number"
];

/**
 * Initialize a new table tile
 */
export function initTableTile(initialState: Partial<TableTile> = {}): TableTile {
  return {
    // UI
    limit: initialState.limit || 20,
    offset: initialState.offset || 0,
    column_context: initialState.column_context,
    page_number: initialState.page_number,

    // Data
    table_type: initialState.table_type,
    metric: initialState.metric,
    column_order: initialState.column_order,
    hidden_columns: initialState.hidden_columns,
    sorting: initialState.sorting,
    grouping: initialState.grouping,
    group_sorting: initialState.group_sorting,
    columns_pin_left: initialState.columns_pin_left,
    columns_pin_right: initialState.columns_pin_right,
    selected: initialState.selected,

    // Fields from TableDataItem
    tableDataItem: {
      columnContexts: initialState.tableDataItem?.columnContexts || [],
      baseIndex: initialState.tableDataItem?.baseIndex || undefined,
      hiddenColumns: initialState.tableDataItem?.hiddenColumns || undefined,
      columnOrdering: initialState.tableDataItem?.columnOrdering || undefined,
      selection: initialState.tableDataItem?.selection || undefined,
      fields: initialState.tableDataItem?.fields || {},
      logsData: initialState.tableDataItem?.logsData || { params: {}, logs: [], count: 0, groups: {} },
      totalPages: initialState.tableDataItem?.totalPages || 0,
      entriesProperties: initialState.tableDataItem?.entriesProperties || [],
      paramsProperties: initialState.tableDataItem?.paramsProperties || [],
      logs: initialState.tableDataItem?.logs || [],
      params: initialState.tableDataItem?.params || {},
      metrics: initialState.tableDataItem?.metrics || {},
      groupedMetrics: initialState.tableDataItem?.groupedMetrics || {},
      boundaries: initialState.tableDataItem?.boundaries || { minimums: {}, maximums: {} },
      ...initialState.tableDataItem,
    } as TableDataItem,

    ...initialState,
  } as TableTile;
}

/**
 * Update an existing table tile
 */
export function updateTableTile(tableTile: TableTile, updates: Partial<TableTile>): TableTile {
  return {
    ...tableTile,
    ...updates,
  };
}
