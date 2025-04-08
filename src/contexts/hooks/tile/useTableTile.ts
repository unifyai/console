import { useMemo } from "react";
import { useStoreContext } from "../../providers/StoreProvider";
import { useTileMeta } from "./useTileMeta";
import { TableTile, TableTileMeta, TableTileData, TableTileUI } from "../../slices/selectors/tableTile";
import { useShallow } from "zustand/react/shallow";
import { TableDataItem } from "@/types/evals/grid";

/**
 * Default return value when no tile is specified or tile doesn't exist
 */
export const DEFAULT_USE_TABLE_TILE_RETURN = {
  tableTile: null,
  tableTileActions: null,
  exists: false
};

// Default table tile meta
export const DEFAULT_TABLE_TILE_META: TableTileMeta = {}; 

/**
 * Interface for table tile meta actions
 */
export interface TableTileMetaActions {
  // Meta actions will be empty as per TableTileMeta
}

/**
 * Default table tile meta actions
 */
export const DEFAULT_TABLE_TILE_META_ACTIONS: TableTileMetaActions = {};

/**
 * Interface for table tile data actions
 */
export interface TableTileDataActions {
  setTableType: (tableType: string | undefined) => void;
  setColumnOrder: (columnOrder: string | undefined) => void;
  setHiddenColumns: (hiddenColumns: string | undefined) => void;
  setSorting: (sorting: string | undefined) => void;
  setGrouping: (grouping: string | undefined) => void;
  setGroupSorting: (groupSorting: string | undefined) => void;
  setColumnsPinLeft: (columnsPinLeft: string | undefined) => void;
  setColumnsPinRight: (columnsPinRight: string | undefined) => void;
  setSelected: (selected: string | undefined) => void;
  setTableDataItem: (tableDataItem: TableDataItem | undefined) => void;
  updateTableDataItem: (updates: Partial<TableDataItem>) => void;
  mergeUpdatesIntoTableDataItem: (updates: Partial<TableDataItem>) => void;
}

/**
 * Interface for table tile UI actions
 */
export interface TableTileUIActions {
  setLimit: (limit: number) => void;
  setOffset: (offset: number) => void;
  setColumnContext: (columnContext: string | undefined) => void;
  setPageNumber: (pageNumber: string | undefined) => void;
}

/**
 * Interface for table-specific actions
 */
export interface TableActions extends 
  TableTileMetaActions,
  TableTileDataActions,
  TableTileUIActions {}

/**
 * Custom hook to access table-specific tile state and actions
 * @param tileName The name of the tile to access
 * @param tabName Optional name of the tab containing the tile
 * @param interfaceName Optional name of the interface containing the tab
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing table-specific tile state, actions, and existence flag
 */
export function useTableTile(
  tileName: string | null,
  tabName?: string | null,
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Get tile meta information using the useTileMeta hook
  const { tileId, tileExists } = useTileMeta(tileName, tabName || null, interfaceName || null, projectName || null);
  
  // Get the tile type to check if it's a table
  const tileType = useStoreContext(state => {
    if (!tileId) return null;
    return state.tilesById[tileId]?.type;
  });
  
  // Check if the tile exists and is a table
  const isTableTile = tileExists && tileType === 'Table';

  const tableTile = useStoreContext(
    useShallow(state => {
      if (!isTableTile || !tileId) return null;
      return state.tilesById[tileId]?.tableTile as TableTile;
    })
  );

  // Access store for table-specific meta data
  const tableMeta = useMemo(() => {
    // Return empty object as per TableTileMeta interface
    return DEFAULT_TABLE_TILE_META as TableTileMeta;
  }, []);
  
  // Access store for table-specific data
  const tableData = useMemo(() => {
    if (!isTableTile || !tileId || !tableTile) return null;
    
    return {
      table_type: tableTile.table_type,
      column_order: tableTile.column_order,
      hidden_columns: tableTile.hidden_columns,
      sorting: tableTile.sorting,
      grouping: tableTile.grouping,
      group_sorting: tableTile.group_sorting,
      columns_pin_left: tableTile.columns_pin_left,
      columns_pin_right: tableTile.columns_pin_right,
      selected: tableTile.selected,
      tableDataItem: tableTile.tableDataItem
    } as TableTileData;
  }, [
    isTableTile,
    tileId,
    tableTile?.table_type,
    tableTile?.column_order,
    tableTile?.hidden_columns,
    tableTile?.sorting,
    tableTile?.grouping,
    tableTile?.group_sorting,
    tableTile?.columns_pin_left,
    tableTile?.columns_pin_right,
    tableTile?.selected,
    tableTile?.tableDataItem,
  ]);

  // Access store for table-specific UI state
  const tableUI = useMemo(() => {
    if (!isTableTile || !tileId || !tableTile) return null;
    
    return {
      limit: tableTile.limit,
      offset: tableTile.offset,
      column_context: tableTile.column_context,
      page_number: tableTile.page_number
    } as TableTileUI;
  }, [
    isTableTile,
    tileId,
    tableTile?.limit,
    tableTile?.offset,
    tableTile?.column_context,
    tableTile?.page_number,
  ]);

  // Get store update functions
  const storeUpdateTableTile = useStoreContext(state => state.updateTableTile);
  const storeUpdateTableDataItem = useStoreContext(state => state.updateTableDataItem);
  const storeMergeUpdatesIntoTableDataItem = useStoreContext(state => state.mergeUpdatesIntoTableDataItem);

  // Create memoized meta actions
  const tableMetaActions = useMemo<TableTileMetaActions | null>(() => {
    if (!isTableTile || !tileId) return null;
    
    // Return empty object as per TableTileMeta interface
    return DEFAULT_TABLE_TILE_META_ACTIONS as TableTileMetaActions;
  }, [isTableTile, tileId]);

  // Create memoized data actions
  const tableDataActions = useMemo<TableTileDataActions | null>(() => {
    if (!isTableTile || !tileId) return null;
    
    return {
      setTableType: (tableType) => {
        const update: Partial<TableTile> = { 
          table_type: tableType 
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setColumnOrder: (columnOrder) => {
        const update: Partial<TableTile> = { 
          column_order: columnOrder 
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setHiddenColumns: (hiddenColumns) => {
        const update: Partial<TableTile> = { 
          hidden_columns: hiddenColumns 
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setSorting: (sorting) => {
        const update: Partial<TableTile> = { 
          sorting
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setGrouping: (grouping) => {
        const update: Partial<TableTile> = { 
          grouping
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setGroupSorting: (groupSorting) => {
        const update: Partial<TableTile> = { 
          group_sorting: groupSorting
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setColumnsPinLeft: (columnsPinLeft) => {
        const update: Partial<TableTile> = { 
          columns_pin_left: columnsPinLeft
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setColumnsPinRight: (columnsPinRight) => {
        const update: Partial<TableTile> = { 
          columns_pin_right: columnsPinRight
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setSelected: (selected) => {
        const update: Partial<TableTile> = { 
          selected
        };
        storeUpdateTableTile(tileId, update);
      },

      setTableDataItem: (tableDataItem) => {
        const update: Partial<TableTile> = { 
          tableDataItem
        };
        storeUpdateTableTile(tileId, update);
      },

      updateTableDataItem: (updates) => {
        if (tileId) {
          storeUpdateTableDataItem(tileId, updates);
        }
      },

      mergeUpdatesIntoTableDataItem: (updates) => {
        if (tileId) {
          storeMergeUpdatesIntoTableDataItem(tileId, updates);
        }
      }
    };
  }, [isTableTile, tileId, storeUpdateTableDataItem, storeMergeUpdatesIntoTableDataItem]);

  // Create memoized UI actions
  const tableUIActions = useMemo<TableTileUIActions | null>(() => {
    if (!isTableTile || !tileId) return null;
    
    return {
      setLimit: (limit) => {
        const update: Partial<TableTile> = { 
          limit
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setOffset: (offset) => {
        const update: Partial<TableTile> = { 
          offset
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setColumnContext: (columnContext) => {
        const update: Partial<TableTile> = { 
          column_context: columnContext
        };
        storeUpdateTableTile(tileId, update);
      },
      
      setPageNumber: (pageNumber) => {
        const update: Partial<TableTile> = { 
          page_number: pageNumber
        };
        storeUpdateTableTile(tileId, update);
      }
    };
  }, [isTableTile, tileId, storeUpdateTableTile]);

  // Build a final `tableTile` object from the separate meta, data, and UI objects
  const combinedTableTile = useMemo(() => {
    if (!tableMeta || !tableData || !tableUI) return null;
    
    return {
      ...tableMeta,
      ...tableData,
      ...tableUI
    };
  }, [tableMeta, tableData, tableUI]);

  // Build a final `tableTileActions` object from the separate meta, data, and UI actions
  const combinedTableTileActions = useMemo(() => {
    if (!tableMetaActions || !tableDataActions || !tableUIActions) return null;
    
    return {
      ...tableMetaActions,
      ...tableDataActions,
      ...tableUIActions
    };
  }, [tableMetaActions, tableDataActions, tableUIActions]);

  // If no tile name is provided or tile doesn't exist, return default
  if (!tileName || !isTableTile) {
    return DEFAULT_USE_TABLE_TILE_RETURN;
  }

  return {
    tableTile: combinedTableTile as TableTile,
    tableTileActions: combinedTableTileActions as TableActions,
    exists: isTableTile
  };
} 