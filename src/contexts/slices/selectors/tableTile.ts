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
  table_type?: string | null;     // Type of table
  column_order?: string | null;   // Column ordering information
  hidden_columns?: string | null; // Hidden columns configuration
  default_hidden_columns?: boolean | null; // Default hide underscore columns flag
  sorting?: string | null;        // Sorting expression
  group_sorting?: string | null;  // How groups are sorted
  columns_pin_left?: string | null; // Columns pinned to the left
  columns_pin_right?: string | null; // Columns pinned to the right
  selected?: string | null;       // Selected items in the table
}

// Table tile UI - UI-related state
export interface TableTileUI {
  limit?: number;
  offset?: number;
  group_limit?: number;
  group_offset?: number;
  page_number?: string | null;    // Current page for pagination
}

// Combined Table tile type
export type TableTile = TableTileMeta & TableTileData & TableTileUI;

// tableKeys: all keys that are used in `asTileItem` in `useTileItem` hook to convert
// a TableTile into a TileProps
export const TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS: (keyof TableTile)[] = [
  "table_type","column_order","hidden_columns","default_hidden_columns","sorting",
  "group_sorting","columns_pin_left","columns_pin_right",
  "selected","page_number"
];

// tableTileKeys: all fields for TableTile
export const TABLE_TILE_KEYS: (keyof TableTile)[] = [
  ...TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS,
  "limit","offset","group_limit","group_offset",
];

/**
 * Initialize a new table tile
 */
export function initTableTile(initialState: Partial<TableTile> = {}): TableTile {
  return {
    // UI
    limit: initialState.limit !== undefined ? initialState.limit : 20,
    offset: initialState.offset !== undefined ? initialState.offset : 0,
    group_limit: initialState.group_limit !== undefined ? initialState.group_limit : 20,
    group_offset: initialState.group_offset !== undefined ? initialState.group_offset : 0,
    page_number: initialState.page_number !== undefined ? initialState.page_number : null,

    // Data
    table_type: initialState.table_type !== undefined ? initialState.table_type : null,
    column_order: initialState.column_order !== undefined ? initialState.column_order : null,
    hidden_columns: initialState.hidden_columns !== undefined ? initialState.hidden_columns : null,
    default_hidden_columns: initialState.default_hidden_columns !== undefined ? initialState.default_hidden_columns : null,
    sorting: initialState.sorting !== undefined ? initialState.sorting : null,
    group_sorting: initialState.group_sorting !== undefined ? initialState.group_sorting : null,
    columns_pin_left: initialState.columns_pin_left !== undefined ? initialState.columns_pin_left : null,
    columns_pin_right: initialState.columns_pin_right !== undefined ? initialState.columns_pin_right : null,
    selected: initialState.selected !== undefined ? initialState.selected : null,

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

/**
 * Updates a table data item with the given updates
 * @param tableDataItem The current table data item
 * @param updates The updates to apply
 * @returns The updated table data item
 */
export function updateTableDataItem<T extends TableDataItem>(
  tableDataItem: T,
  updates: Partial<T>
): T {
  return {
    ...tableDataItem,
    ...updates
  };
}

/**
 * Merges updates into a table data item, merging each field individually
 * @param tableDataItem The current table data item
 * @param updates The updates to merge
 * @returns The updated table data item
 */
export function mergeUpdatesIntoTableDataItem<T extends TableDataItem>(
  tableDataItem: T,
  updates: Partial<T>
): T {
  // Create a new object to start with
  const result = { ...tableDataItem };
  
  // Handle each update field individually
  Object.keys(updates).forEach(key => {
    const updateKey = key as keyof T;
    const updateValue = updates[updateKey];
    const currentValue = tableDataItem[updateKey];
    
    // If both values exist, merge them by spreading
    if (currentValue && updateValue) {
      // Merge by spreading the current value first, then the update
      result[updateKey] = {
        ...currentValue,
        ...updateValue
      } as any;
    } else {
      // If either value is missing, use the update value
      result[updateKey] = updateValue as any;
    }
  });
  
  return result;
}
