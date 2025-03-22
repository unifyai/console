import { useMemo } from "react";
import { TileActions, useTile } from "../tile/useTile";
import { TileDataActions } from "../tile/useTileData";
import { TableTileMeta, TableTileData, TableTileUI } from "../../slices/selectors/tableTile";

// Define the default return value for the useTableTile hook
const DEFAULT_USE_TABLE_TILE_RETURN = {
  tableTile: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  actions: null,
  exists: false,
};

/**
 * Interface for table tile meta-related actions
 */
export interface TableTileMetaActions {
  // Add table-specific meta actions here
}

/**
 * Interface for table tile data-related actions
 */
export interface TableTileDataActions {
  setTableType: (tableType: string) => void;
  setMetric: (metric: string | undefined) => void;
  setColumnOrder: (columnOrder: string | undefined) => void;
  setHiddenColumns: (hiddenColumns: string | undefined) => void;
  setSorting: (sorting: string | undefined) => void;
  setGrouping: (grouping: string | undefined) => void;
  setGroupSorting: (groupSorting: string | undefined) => void;
  setColumnsPinLeft: (columnsPinLeft: string | undefined) => void;
  setColumnsPinRight: (columnsPinRight: string | undefined) => void;
  setSelected: (selected: string | undefined) => void;
  setBaseIndex: (baseIndex: string | undefined) => void;
}

/**
 * Interface for table tile UI-related actions
 */
export interface TableTileUIActions {
  setLimit: (limit: number) => void;
  setOffset: (offset: number) => void;
  setColumnContext: (columnContext: string | undefined) => void;
  setPageNumber: (pageNumber: string | undefined) => void;
}

/**
 * Interface for all table tile-related actions
 */
export interface TableTileActions extends TileActions {
  // Table-specific actions grouped by category
  tableMeta: TableTileMetaActions;
  tableData: TableTileDataActions;
  tableUI: TableTileUIActions;
}

/**
 * Custom hook to access table tile data and actions
 * @param tileName The name of the table tile to access
 * @param tabName Optional tab name
 * @param interfaceName Optional interface name
 * @param projectName Optional project name
 * @returns Object containing tile state, actions, and existence flag
 */
export function useTableTile(
  tileName: string | null,
  tabName?: string | null,
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Always call hooks at the top level, unconditionally
  const {
    tile: baseTile,
    dataActions: baseTileActions,
    exists,
  } = useTile(tileName, tabName, interfaceName, projectName);

  // Check if this tile is a table tile
  const hasTableTile = useMemo(() => {
    if (!baseTile || baseTile.type !== 'Table') return false;
    return true;
  }, [baseTile]);
  
  // Extract table-specific meta, data, and UI
  const tableMeta = useMemo<TableTileMeta | null>(() => {
    if (!hasTableTile || !baseTile || !baseTile.tableTile) return null;
    return baseTile.tableTile as TableTileMeta;
  }, [hasTableTile, baseTile]);
  
  const tableData = useMemo<TableTileData | null>(() => {
    if (!hasTableTile || !baseTile || !baseTile.tableTile) return null;
    return baseTile.tableTile as TableTileData;
  }, [hasTableTile, baseTile]);
  
  const tableUI = useMemo<TableTileUI | null>(() => {
    if (!hasTableTile || !baseTile || !baseTile.tableTile) return null;
    return baseTile.tableTile as TableTileUI;
  }, [hasTableTile, baseTile]);
  
  // Create table-specific meta actions
  const tableMetaActions = useMemo<TableTileMetaActions>(() => {
    return {
      // Add table-specific meta actions here
    };
  }, []);
  
  // Create table-specific data actions
  const tableDataActions = useMemo<TableTileDataActions>(() => {
    return {
      setTableType: (tableType) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            table_type: tableType 
          });
        }
      },
      setMetric: (metric) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            metric 
          });
        }
      },
      setColumnOrder: (columnOrder) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            column_order: columnOrder 
          });
        }
      },
      setHiddenColumns: (hiddenColumns) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            hidden_columns: hiddenColumns 
          });
        }
      },
      setSorting: (sorting) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            sorting 
          });
        }
      },
      setGrouping: (grouping) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            grouping 
          });
        }
      },
      setGroupSorting: (groupSorting) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            group_sorting: groupSorting 
          });
        }
      },
      setColumnsPinLeft: (columnsPinLeft) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            columns_pin_left: columnsPinLeft 
          });
        }
      },
      setColumnsPinRight: (columnsPinRight) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            columns_pin_right: columnsPinRight 
          });
        }
      },
      setSelected: (selected) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            selected 
          });
        }
      },
      setBaseIndex: (baseIndex) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            base_index: baseIndex
          });
        }
      }
    };
  }, [baseTileActions, hasTableTile]);
  
  // Create table-specific UI actions
  const tableUIActions = useMemo<TableTileUIActions>(() => {
    return {
      setLimit: (limit) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            limit 
          });
        }
      },
      setOffset: (offset) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            offset 
          });
        }
      },
      setColumnContext: (columnContext) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            column_context: columnContext 
          });
        }
      },
      setPageNumber: (pageNumber) => {
        if (baseTileActions && hasTableTile) {
          (baseTileActions as unknown as TileDataActions).updateTableTile({ 
            page_number: pageNumber 
          });
        }
      }
    };
  }, [baseTileActions, hasTableTile]);
  
  // Combine all actions
  const tableActions = useMemo<TableTileActions>(() => {
    return {
      ...(baseTileActions as unknown as TableTileActions),
      tableMeta: tableMetaActions,
      tableData: tableDataActions,
      tableUI: tableUIActions
    };
  }, [baseTileActions, tableMetaActions, tableDataActions, tableUIActions]);

  // Return null if no tileId provided
  if (tileName === null) {
    return DEFAULT_USE_TABLE_TILE_RETURN;
  }
  
  return {
    tableTile: hasTableTile ? baseTile?.tableTile : null,
    meta: tableMeta,
    data: tableData,
    ui: tableUI,
    metaActions: tableMetaActions,
    dataActions: tableDataActions,
    uiActions: tableUIActions,
    actions: tableActions,
    exists: exists && hasTableTile,
  };
}