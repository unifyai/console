import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { useTileMeta } from './useTileMeta';
import { TileData } from '../../slices/selectors/tile';
import { TableTile } from '../../slices/selectors/tableTile';
import { PlotTile } from '../../slices/selectors/plotTile';
import { ViewTile } from '../../slices/selectors/viewTile';
import { EditorTile } from '../../slices/selectors/editorTile';

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
   setGrouping: (grouping?: string) => void;
   
   // Type-specific updates
   updateTableTile: (updates: Partial<TableTile>) => void;
   updatePlotTile: (updates: Partial<PlotTile>) => void;
   updateViewTile: (updates: Partial<ViewTile>) => void;
   updateEditorTile: (updates: Partial<EditorTile>) => void;
  }

/**
 * Custom hook to access tile data and related actions
 * @param tileName The name of the tile to access
 * @param tabName The name of the tab containing the tile
 * @param interfaceName The name of the interface containing the tab
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing tile data, actions, and related state
 */
export function useTileData(
  tileName: string | null,
  tabName: string | null,
  interfaceName: string | null,
  projectName?: string | null
) {
  // Use the tile meta hook to get common tile info
  const {tileId, tileExists } = useTileMeta(tileName, tabName, interfaceName, projectName);

  // Subscribe to data properties
  const context = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].context;
  });
  
  const table = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].table;
  });
  
  const autoUpdate = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].auto_update;
  });
  
  const freeze = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].freeze;
  });
  
  const filters = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].filters;
  });
  
  const commonFilter = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].common_filter;
  });

  const metric = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].metric;
  });

  const columnContext = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].column_context;
  });

  const grouping = useStoreContext(state => {
    if (!tileExists || !tileId) return null;
    return state.tilesById[tileId].grouping;
  });

  // Get store actions for data management
  const storeUpdateTile = useStoreContext(state => state.updateTile);
  const storeUpdateTableTile = useStoreContext(state => state.updateTableTile);
  const storeUpdatePlotTile = useStoreContext(state => state.updatePlotTile);
  const storeUpdateViewTile = useStoreContext(state => state.updateViewTile);
  const storeUpdateEditorTile = useStoreContext(state => state.updateEditorTile);

  // Memoize the data object to prevent unnecessary rerenders
  const data = useMemo<Partial<TileData> | null>(() => {
    if (!tileExists) return null;
    
    return {
      context,
      table,
      auto_update: autoUpdate,
      freeze,
      filters,
      common_filter: commonFilter,
      metric,
      column_context: columnContext,
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
  const dataActions = useMemo<TileDataActions>(() => ({
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
        storeUpdateTile(tileId, { auto_update: autoUpdate });
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
        storeUpdateTile(tileId, { common_filter: commonFilter });
      }
    },

    setMetric: (metric) => {
      if (tileId) {
        storeUpdateTile(tileId, { metric });
      }
    },

    setColumnContext: (columnContext) => {
      if (tileId) {
        storeUpdateTile(tileId, { column_context: columnContext });
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

    updateEditorTile: (updates) => {
      if (tileId) {
        storeUpdateEditorTile(tileId, updates);
      }
    },
  }), [
    tileId,
    storeUpdateTile, 
    storeUpdateTableTile, 
    storeUpdatePlotTile, 
    storeUpdateViewTile,
    storeUpdateEditorTile
  ]);

  return {
    data,
    dataActions,
  };
} 