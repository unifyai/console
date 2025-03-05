import { useMemo } from "react";
import { useStoreContext } from "../providers/StoreProvider";
import { TileActions, useTile } from "./useTile";

/**
 * Interface for table tile-related actions
 */
export interface TableTileActions extends TileActions {
  setFilters: (filters: any) => void;
  setSorting: (sorting: any) => void;
  setGrouping: (grouping: any) => void;
  setPagination: (page: number, pageSize: number) => void;
}

/**
 * Custom hook to access table tile data and actions
 * @param tileId The ID of the table tile to access
 * @param tabId Optional tab ID
 * @param interfaceId Optional interface ID
 * @param projectId Optional project ID
 * @returns Object containing tile state, actions, and existence flag
 */
export function useTableTile(
  tileId: string | null,
  tabId?: string | null,
  interfaceId?: string | null,
  projectId?: string | null
) {
  // First, we use our narrower hook to get the base tile object
  // (which we previously updated to subscribe to each tile field individually)
  const {
    data: baseTile,
    actions: baseTileActions,
    exists,
    tabId: foundTabId
  } = useTile(tileId, tabId, interfaceId, projectId);

  // Now we do further narrower subscription for table-specific data,
  // so changes in other tile fields (like plotData) won't cause a rerender here.
  const hasTableTile = useStoreContext((state) => {
    if (!baseTile || baseTile.type !== 'Table') return false;
    return true;
  });
  
  const tableData = useStoreContext((state) => {
    if (!hasTableTile || !baseTile) return null;
    // If we want the same path as the tile state, do:
    return baseTile.tableData || null;
  });

  const tableActions = useMemo<TableTileActions>(() => {
    // We'll just spread baseTileActions, then add table-specific methods
    return {
      ...baseTileActions as TableTileActions,

      // Add any table-specific actions here
      setFilters: (filters: any) => {
        // only if we are indeed a table tile
        if (hasTableTile && baseTileActions) {
          baseTileActions.updateTableData({ filters });
        }
      },
      setSorting: (sorting: any) => {
        if (hasTableTile && baseTileActions) {
          baseTileActions.updateTableData({ sorting });
        }
      },
      setGrouping: (grouping: any) => {
        if (hasTableTile && baseTileActions) {
          baseTileActions.updateTableData({ grouping });
        }
      },
      setPagination: (page: number, pageSize: number) => {
        if (hasTableTile && baseTileActions) {
          baseTileActions.updateTableData({ pagination: { page, pageSize } });
        }
      },
    };
  }, [baseTileActions, hasTableTile]);
  
  return {
    // We only return tableData if it is indeed a table tile
    data: hasTableTile ? tableData : null,
    actions: tableActions,
    exists: exists && hasTableTile,
    tabId: foundTabId,
    tile: baseTile
  };
}