import { TableDataItem } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";

// Table tile related types
export interface TableTileData {
  // Additional fields needed for internal state management
  id: string;
  title: string;
  loading: boolean;
  limit: number;
  offset: number;
  error: string | null;
  lastUpdated: string | null;
  createdAt: string;
  updatedAt: string;

  // Table-specific fields from TileProps
  // Note: When adding new fields here from TileProps in grid.ts,
  // make sure to update the TABLE_TILE_KEYS array in the useTile hook
  table?: string;          // Table identifier
  table_type?: string;     // Type of table
  column_context?: string; // Context for columns display
  page_number?: string;    // Current page for pagination
  metric?: string;         // Current metric being displayed
  column_order?: string;   // Column ordering information
  hidden_columns?: string; // Hidden columns configuration
  sorting?: string; // Sorting expression (equivalent to sorting)
  grouping?: string; // Grouping expression (equivalent to grouping)
  group_sorting?: string;  // How groups are sorted
  columns_pin_left?: string; // Columns pinned to the left
  columns_pin_right?: string; // Columns pinned to the right
  selected?: string;       // Selected items in the table
  base_index?: string;     // Base index for the table

  // Table data item
  tableDataItem?: TableDataItem;

  // Table arguments
  tableArguments?: TableArguments[number];
}

/**
 * Initialize a new table tile
 */
export function initTableTile(tileId: string, initialState: Partial<TableTileData> = {}): TableTileData {
  return {
    // Additional fields for internal state
    id: tileId,
    title: initialState.title || `Table ${tileId}`,
    limit: initialState.limit || 20,
    offset: initialState.offset || 0,
    loading: initialState.loading !== undefined ? initialState.loading : false,
    error: initialState.error || null,
    lastUpdated: initialState.lastUpdated || null,
    createdAt: initialState.createdAt || new Date().toISOString(),
    updatedAt: initialState.updatedAt || new Date().toISOString(),

    // Table-specific fields from TileProps
    table: initialState.table,
    table_type: initialState.table_type,
    column_context: initialState.column_context,
    page_number: initialState.page_number,
    metric: initialState.metric,
    column_order: initialState.column_order,
    hidden_columns: initialState.hidden_columns,
    sorting: initialState.sorting,
    grouping: initialState.grouping,
    group_sorting: initialState.group_sorting,
    columns_pin_left: initialState.columns_pin_left,
    columns_pin_right: initialState.columns_pin_right,
    selected: initialState.selected,
    base_index: initialState.base_index,

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
    } as TableDataItem,

    tableArguments: initialState.tableArguments || {},
  } as TableTileData;
}

/**
 * Update an existing table tile
 */
export function updateTableTile(tableTile: TableTileData, updates: Partial<TableTileData>): TableTileData {
  return {
    ...tableTile,
    ...updates,
    updatedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}
