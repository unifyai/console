import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { useTileMeta } from './useTileMeta';
import {
  TableTile,
  TableTileMeta,
  TableTileData,
  TableTileUI,
} from '../../slices/selectors/tableTile';
import { useShallow } from 'zustand/react/shallow';

/**
 * Default return value when no tile is specified or tile doesn't exist
 */
export const DEFAULT_USE_TABLE_TILE_RETURN = {
  tableTile: null,
  tableTileActions: null,
  exists: false,
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
  setDefaultHiddenColumns: (defaultHiddenColumns: boolean | undefined) => void;
  setSorting: (sorting: string | undefined) => void;
  setGroupSorting: (groupSorting: string | undefined) => void;
  setColumnsPinLeft: (columnsPinLeft: string | undefined) => void;
  setColumnsPinRight: (columnsPinRight: string | undefined) => void;
  setSelected: (selected: string | undefined) => void;
}

/**
 * Interface for table tile UI actions
 */
export interface TableTileUIActions {
  setLimit: (limit: number) => void;
  setOffset: (offset: number) => void;
  setPageNumber: (pageNumber: string | undefined) => void;
  setGroupLimit: (groupLimit: number) => void;
  setGroupOffset: (groupOffset: number) => void;
  addInfiniteQueryKey: (queryKey: string) => void;
  removeInfiniteQueryKey: (queryKey: string) => void;
  clearAllInfiniteQueryKeys: () => void;
}

/**
 * Interface for table-specific actions
 */
export interface TableActions
  extends TableTileMetaActions, TableTileDataActions, TableTileUIActions {}

/**
 * Custom hook to access table-specific tile state and actions
 * @param tileIdOrName The ID or name of the tile to access
 * @param tabIdOrName Optional ID or name of the tab containing the tile
 * @returns Object containing table-specific tile state, actions, and existence flag
 */
export function useTableTile(tileIdOrName: string | null, tabIdOrName?: string | null) {
  // Get tile meta information using the useTileMeta hook
  const { tileId, tileExists } = useTileMeta(tileIdOrName, tabIdOrName || null);

  // Get the tile type to check if it's a table
  const tileType = useStoreContext((state) => {
    if (!tileId) return null;
    return state.tilesById[tileId]?.type;
  });

  // Check if the tile exists and is a table
  const isTableTile = tileExists && tileType === 'Table';

  const tableTile = useStoreContext(
    useShallow((state) => {
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
      tableType: tableTile.tableType,
      columnOrder: tableTile.columnOrder,
      hiddenColumns: tableTile.hiddenColumns,
      defaultHiddenColumns: tableTile.defaultHiddenColumns,
      sorting: tableTile.sorting,
      groupSorting: tableTile.groupSorting,
      columnsPinLeft: tableTile.columnsPinLeft,
      columnsPinRight: tableTile.columnsPinRight,
      selected: tableTile.selected,
    } as TableTileData;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isTableTile,
    tileId,
    tableTile?.tableType,
    tableTile?.columnOrder,
    tableTile?.hiddenColumns,
    tableTile?.defaultHiddenColumns,
    tableTile?.sorting,
    tableTile?.groupSorting,
    tableTile?.columnsPinLeft,
    tableTile?.columnsPinRight,
    tableTile?.selected,
  ]);

  // Access store for table-specific UI state
  const tableUI = useMemo(() => {
    if (!isTableTile || !tileId || !tableTile) return null;

    return {
      limit: tableTile.limit,
      offset: tableTile.offset,
      groupLimit: tableTile.groupLimit,
      groupOffset: tableTile.groupOffset,
      pageNumber: tableTile.pageNumber,
      infiniteQueryKeys: tableTile.infiniteQueryKeys,
    } as TableTileUI;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isTableTile,
    tileId,
    tableTile?.limit,
    tableTile?.offset,
    tableTile?.groupLimit,
    tableTile?.groupOffset,
    tableTile?.pageNumber,
    tableTile?.infiniteQueryKeys,
  ]);

  // Get store update functions
  const storeUpdateTableTile = useStoreContext((state) => state.updateTableTile);
  const storeAddInfiniteQueryKey = useStoreContext((state) => state.addInfiniteQueryKey);
  const storeRemoveInfiniteQueryKey = useStoreContext((state) => state.removeInfiniteQueryKey);
  const storeClearAllInfiniteQueryKeys = useStoreContext(
    (state) => state.clearAllInfiniteQueryKeys
  );

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
          tableType: tableType,
        };
        storeUpdateTableTile(tileId, update);
      },

      setColumnOrder: (columnOrder) => {
        const update: Partial<TableTile> = {
          columnOrder: columnOrder,
        };
        storeUpdateTableTile(tileId, update);
      },

      setHiddenColumns: (hiddenColumns) => {
        const update: Partial<TableTile> = {
          hiddenColumns: hiddenColumns,
        };
        storeUpdateTableTile(tileId, update);
      },

      setDefaultHiddenColumns: (defaultHiddenColumns) => {
        const update: Partial<TableTile> = {
          defaultHiddenColumns: defaultHiddenColumns,
        };
        storeUpdateTableTile(tileId, update);
      },

      setSorting: (sorting) => {
        const update: Partial<TableTile> = {
          sorting,
        };
        storeUpdateTableTile(tileId, update);
      },

      setGroupSorting: (groupSorting) => {
        const update: Partial<TableTile> = {
          groupSorting: groupSorting,
        };
        storeUpdateTableTile(tileId, update);
      },

      setColumnsPinLeft: (columnsPinLeft) => {
        const update: Partial<TableTile> = {
          columnsPinLeft: columnsPinLeft,
        };
        storeUpdateTableTile(tileId, update);
      },

      setColumnsPinRight: (columnsPinRight) => {
        const update: Partial<TableTile> = {
          columnsPinRight: columnsPinRight,
        };
        storeUpdateTableTile(tileId, update);
      },

      setSelected: (selected) => {
        const update: Partial<TableTile> = {
          selected,
        };
        storeUpdateTableTile(tileId, update);
      },
    };
  }, [isTableTile, tileId, storeUpdateTableTile]);

  // Create memoized UI actions
  const tableUIActions = useMemo<TableTileUIActions | null>(() => {
    if (!isTableTile || !tileId) return null;

    return {
      setLimit: (limit) => {
        const update: Partial<TableTile> = {
          limit,
        };
        storeUpdateTableTile(tileId, update);
      },

      setOffset: (offset) => {
        const update: Partial<TableTile> = {
          offset,
        };
        storeUpdateTableTile(tileId, update);
      },

      setGroupLimit: (groupLimit) => {
        const update: Partial<TableTile> = {
          groupLimit: groupLimit,
        };
        storeUpdateTableTile(tileId, update);
      },

      setGroupOffset: (groupOffset) => {
        const update: Partial<TableTile> = {
          groupOffset: groupOffset,
        };
        storeUpdateTableTile(tileId, update);
      },

      setPageNumber: (pageNumber) => {
        const update: Partial<TableTile> = {
          pageNumber: pageNumber,
        };
        storeUpdateTableTile(tileId, update);
      },

      addInfiniteQueryKey: (queryKey) => {
        storeAddInfiniteQueryKey(tileId, queryKey);
      },

      removeInfiniteQueryKey: (queryKey) => {
        storeRemoveInfiniteQueryKey(tileId, queryKey);
      },

      clearAllInfiniteQueryKeys: () => {
        storeClearAllInfiniteQueryKeys(tileId);
      },
    };
  }, [
    isTableTile,
    tileId,
    storeUpdateTableTile,
    storeAddInfiniteQueryKey,
    storeRemoveInfiniteQueryKey,
    storeClearAllInfiniteQueryKeys,
  ]);

  // Build a final `tableTile` object from the separate meta, data, and UI objects
  const combinedTableTile = useMemo(() => {
    if (!tableMeta || !tableData || !tableUI) return null;

    return {
      ...tableMeta,
      ...tableData,
      ...tableUI,
    };
  }, [tableMeta, tableData, tableUI]);

  // Build a final `tableTileActions` object from the separate meta, data, and UI actions
  const combinedTableTileActions = useMemo(() => {
    if (!tableMetaActions || !tableDataActions || !tableUIActions) return null;

    return {
      ...tableMetaActions,
      ...tableDataActions,
      ...tableUIActions,
    };
  }, [tableMetaActions, tableDataActions, tableUIActions]);

  // If no tile name is provided or tile doesn't exist, return default
  if (!tileIdOrName || !isTableTile) {
    return DEFAULT_USE_TABLE_TILE_RETURN;
  }

  return {
    tableTile: combinedTableTile as TableTile,
    tableTileActions: combinedTableTileActions as TableActions,
    exists: isTableTile,
  };
}
