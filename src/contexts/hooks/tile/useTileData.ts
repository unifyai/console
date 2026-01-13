import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { useTileMeta } from './useTileMeta';
import { TileData } from '../../slices/selectors/tile';
import { TableTile } from '../../slices/selectors/tableTile';
import { PlotTile } from '../../slices/selectors/plotTile';
import { ViewTile } from '../../slices/selectors/viewTile';

/**
 * Interface for tile data-related actions
 */
export interface TileDataActions {
  setContext: (context?: string) => void;
  setTable: (table?: string) => void;
  setAutoUpdate: (autoUpdate?: string) => void;
  setFreeze: (freeze?: string) => void;
  setFilters: (filters?: string) => void;
  setCommonFilter: (commonFilter?: string) => void;
  setMetric: (metric: string | undefined) => void;
  setColumnContext: (columnContext?: string) => void;
  // Combined method to update both context and columnContext at once
  setContextAndColumnContext: (context?: string, columnContext?: string) => void;
  setGrouping: (grouping?: string) => void;

  // Type-specific updates
  updateTableTile: (updates: Partial<TableTile>) => void;
  updatePlotTile: (updates: Partial<PlotTile>) => void;
  updateViewTile: (updates: Partial<ViewTile>) => void;
}

/**
 * Custom hook to access tile data and related actions
 * @param tileIdOrName The ID or name of the tile to access
 * @param tabIdOrName The ID or name of the tab containing the tile
 * @returns Object containing tile data, actions, and related state
 */
export function useTileData(tileIdOrName: string | null, tabIdOrName: string | null) {
  // Use the tile meta hook to get common tile info
  const { tileId, tileExists } = useTileMeta(tileIdOrName, tabIdOrName);

  // Subscribe to data properties
  const context = useStoreContext((state) => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].context;
  });

  const table = useStoreContext((state) => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].table;
  });

  const autoUpdate = useStoreContext((state) => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].autoUpdate;
  });

  const freeze = useStoreContext((state) => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].freeze;
  });

  const filters = useStoreContext((state) => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].filters;
  });

  const commonFilter = useStoreContext((state) => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].commonFilter;
  });

  const metric = useStoreContext((state) => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].metric;
  });

  const columnContext = useStoreContext((state) => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].columnContext;
  });

  const grouping = useStoreContext((state) => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].grouping;
  });

  // Get store actions for data management
  const storeUpdateTile = useStoreContext((state) => state.updateTile);
  const storeUpdateTableTile = useStoreContext((state) => state.updateTableTile);
  const storeUpdatePlotTile = useStoreContext((state) => state.updatePlotTile);
  const storeUpdateViewTile = useStoreContext((state) => state.updateViewTile);

  // Memoize the data object to prevent unnecessary rerenders
  const data = useMemo<Partial<TileData> | null>(() => {
    if (!tileExists) return null;

    return {
      context,
      table,
      autoUpdate: autoUpdate,
      freeze,
      filters,
      commonFilter: commonFilter,
      metric,
      columnContext: columnContext,
      grouping,
    };
  }, [
    tileExists,
    context,
    table,
    autoUpdate,
    freeze,
    filters,
    commonFilter,
    metric,
    columnContext,
    grouping,
  ]);

  // Memoize the data actions to prevent unnecessary re-renders
  const dataActions = useMemo<TileDataActions>(
    () => ({
      setContext: (context) => {
        if (tileId) {
          storeUpdateTile(tileId, { context });
        }
      },

      setTable: (table) => {
        if (tileId) {
          storeUpdateTile(tileId, { table });
        }
      },

      setAutoUpdate: (autoUpdate) => {
        if (tileId) {
          storeUpdateTile(tileId, { autoUpdate: autoUpdate });
        }
      },

      setFreeze: (freeze) => {
        if (tileId) {
          storeUpdateTile(tileId, { freeze });
        }
      },

      setFilters: (filters) => {
        if (tileId) {
          storeUpdateTile(tileId, { filters });
        }
      },

      setCommonFilter: (commonFilter) => {
        if (tileId) {
          storeUpdateTile(tileId, { commonFilter: commonFilter });
        }
      },

      setMetric: (metric) => {
        if (tileId) {
          storeUpdateTile(tileId, { metric });
        }
      },

      setColumnContext: (columnContext) => {
        if (tileId) {
          storeUpdateTile(tileId, { columnContext: columnContext });
        }
      },

      setGrouping: (grouping) => {
        if (tileId) {
          storeUpdateTile(tileId, { grouping });
        }
      },

      // Type-specific updates
      updateTableTile: (updates) => {
        if (tileId) {
          storeUpdateTableTile(tileId, updates);
        }
      },

      updatePlotTile: (updates) => {
        if (tileId) {
          storeUpdatePlotTile(tileId, updates);
        }
      },

      updateViewTile: (updates) => {
        if (tileId) {
          storeUpdateViewTile(tileId, updates);
        }
      },

      setContextAndColumnContext: (context, columnContext) => {
        if (tileId) {
          storeUpdateTile(tileId, { context, columnContext: columnContext });
        }
      },
    }),
    [tileId, storeUpdateTile, storeUpdateTableTile, storeUpdatePlotTile, storeUpdateViewTile]
  );

  return {
    data,
    dataActions,
  };
}
