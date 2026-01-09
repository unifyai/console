import { TableDataItem } from "@/types/interfaces/grid";

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
  tableType?: string | null;     // Type of table
  columnOrder?: string | null;   // Column ordering information
  hiddenColumns?: string | null; // Hidden columns configuration
  defaultHiddenColumns?: boolean | null; // Default hide underscore columns flag
  sorting?: string | null;        // Sorting expression
  groupSorting?: string | null;  // How groups are sorted
  columnsPinLeft?: string | null; // Columns pinned to the left
  columnsPinRight?: string | null; // Columns pinned to the right
  selected?: string | null;       // Selected items in the table
}

// Table tile UI - UI-related state
export interface TableTileUI {
  limit?: number;
  offset?: number;
  groupLimit?: number;
  groupOffset?: number;
  pageNumber?: string | null;    // Current page for pagination
  infiniteQueryKeys?: string[];   // Track all infinite query keys for cleanup
}

// Combined Table tile type
export type TableTile = TableTileMeta & TableTileData & TableTileUI;

// tableKeys: all keys that are used in `asTileItem` in `useTileItem` hook to convert
// a TableTile into a TileProps
export const TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS: (keyof TableTile)[] = [
  "tableType","columnOrder","hiddenColumns","defaultHiddenColumns","sorting",
  "groupSorting","columnsPinLeft","columnsPinRight",
  "selected","pageNumber"
];

// tableTileKeys: all fields for TableTile
export const TABLE_TILE_KEYS: (keyof TableTile)[] = [
  ...TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS,
  "limit","offset","groupLimit","groupOffset","infiniteQueryKeys",
];

/**
 * Initialize a new table tile
 */
export function initTableTile(initialState: Partial<TableTile> = {}): TableTile {
  return {
    // UI
    limit: initialState.limit !== undefined ? initialState.limit : 20,
    offset: initialState.offset !== undefined ? initialState.offset : 0,
    groupLimit: initialState.groupLimit !== undefined ? initialState.groupLimit : 20,
    groupOffset: initialState.groupOffset !== undefined ? initialState.groupOffset : 0,
    pageNumber: initialState.pageNumber !== undefined ? initialState.pageNumber : null,
    infiniteQueryKeys: initialState.infiniteQueryKeys !== undefined ? initialState.infiniteQueryKeys : [],

    // Data
    tableType: initialState.tableType !== undefined ? initialState.tableType : null,
    columnOrder: initialState.columnOrder !== undefined ? initialState.columnOrder : null,
    hiddenColumns: initialState.hiddenColumns !== undefined ? initialState.hiddenColumns : null,
    defaultHiddenColumns: initialState.defaultHiddenColumns !== undefined ? initialState.defaultHiddenColumns : null,
    sorting: initialState.sorting !== undefined ? initialState.sorting : null,
    groupSorting: initialState.groupSorting !== undefined ? initialState.groupSorting : null,
    columnsPinLeft: initialState.columnsPinLeft !== undefined ? initialState.columnsPinLeft : null,
    columnsPinRight: initialState.columnsPinRight !== undefined ? initialState.columnsPinRight : null,
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
