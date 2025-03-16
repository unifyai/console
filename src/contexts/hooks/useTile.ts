import { useMemo, useCallback, useRef } from 'react';
import { useStoreApiContext, useStoreContext } from '../providers/StoreProvider';
import { Tile, TilePosition } from '../slices/selectors/tile';
import { TileProps } from '@/types/evals/grid';
import { IStoreState } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { PlotTileData } from '../slices/selectors/plotTile';
import { ViewTileData } from '../slices/selectors/viewTile';
import { TableTileData } from '../slices/selectors/tableTile';

// Define the valid tile types
const tileTypes = ['Table', 'Plot', 'View'] as const;

// Define stable fallback references
const DEFAULT_TILE_POSITION = { x: 0, y: 0, width: 2, height: 2 };
const DEFAULT_TILE_RETURN = { tile: null, actions: null, exists: false };

/**
 * Interface for tile-related actions
 */
export interface TileActions {
  // Basic tile management
  updateTile: (updates: Partial<Tile>) => void;
  removeTile: () => void;
  
  // Property setters
  setName: (name: string) => void;
  setPosition: (position: Partial<TilePosition>) => void;
  setVisible: (visible: boolean) => void;
  setLocked: (locked: boolean) => void;
  setPending: (pending: boolean) => void;
  
  // Type-specific management
  setType: (type: 'Table' | 'Plot' | 'View', tabId?: string) => void;
  
  // Content management based on type
  updateTableData: (updates: any) => void;
  updatePlotData: (updates: any) => void;
  updateViewData: (updates: any) => void;
  
  // Tab relationship
  moveToTab: (newTabId: string) => void;
  
  // Conversion utilities
  asTileItem: () => TileProps;
  fromTileItem: (tileItem: TileProps) => boolean;
}

/**
 * Factory function to create TileActions without using hooks
 * This can be used by both useTile and useTileActions
 */
export function createTileActions(
  tileId: string,
  tabId: string | null,
  interfaceId: string | null,
  projectId: string | null,
  tile: Tile | null,
  store: IStoreState
): TileActions | null {
  // If essential parameters are missing, return null
  if (!tileId || !tabId || !projectId || !interfaceId || !tile) return null;

  // // Optional: store last computed tileProps in a local closure ref
  // let lastTileObj: Tile | null = null;
  // let lastTileProps: TileProps | null = null;
  
  return {
    // Basic tile management
    updateTile: (updates) => {
      store.updateTile(projectId, interfaceId, tabId, tileId, updates);
    },

    removeTile: () => {
      store.removeTile(projectId, interfaceId, tabId, tileId);
    },

    // Property setters
    setName: (name) => {
      store.updateTile(projectId, interfaceId, tabId, tileId, { name });
    },

    setPosition: (position) => {
      store.updateTile(projectId, interfaceId, tabId, tileId, {
        position: {
          ...(tile.position || { x: 0, y: 0, width: 2, height: 2 }),
          ...position
        }
      });
    },

    setVisible: (visible) => {
      store.updateTile(projectId, interfaceId, tabId, tileId, { visible });
    },

    setLocked: (locked) => {
      store.updateTile(projectId, interfaceId, tabId, tileId, { locked });
    },

    setPending: (pending) => {
      store.updateTile(projectId, interfaceId, tabId, tileId, { pending });
    },

    // Type-specific management
    setType: (type, newTabId) => {
      const targetTabId = newTabId || tabId;
      
      // Need to create a new tile with the correct type
      store.updateTile(projectId, interfaceId, targetTabId, tileId, { type });
      
      // Initialize type-specific data
      if (type === 'Table') {
        store.updateTableTileData(projectId, interfaceId, targetTabId, tileId, {});
      } else if (type === 'Plot') {
        store.updatePlotTileData(projectId, interfaceId, targetTabId, tileId, {});
      } else if (type === 'View') {
        store.updateViewTileData(projectId, interfaceId, targetTabId, tileId, {});
      }
    },

    // Content management based on type
    updateTableData: (updates) => {
      if (tile.type === 'Table') {
        store.updateTableTileData(projectId, interfaceId, tabId, tileId, updates);
      }
    },

    updatePlotData: (updates) => {
      if (tile.type === 'Plot') {
        store.updatePlotTileData(projectId, interfaceId, tabId, tileId, updates);
      }
    },

    updateViewData: (updates) => {
      if (tile.type === 'View') {
        store.updateViewTileData(projectId, interfaceId, tabId, tileId, updates);
      }
    },

    // Tab relationship
    moveToTab: (newTabId) => {
      // Create a copy of the tile in the new tab
      store.initTile(projectId, interfaceId, newTabId, tileId, tile);

      // Remove from the old tab
      store.removeTile(projectId, interfaceId, tabId, tileId);
    },

    // Conversion to TileProps for legacy components
    asTileItem: () => {
      // // 1) If tile is identical to lastTileObj by reference, we can reuse lastTileProps
      // //    or do a shallow compare if you wish. For brevity, we do reference check only:
      // if (tile === lastTileObj && lastTileProps) {
      //   return lastTileProps;
      // }

      // Create base TileProps from Tile's core properties
      const tileProps: TileProps = {
        i: tile.id,
        x: tile.position.x,
        y: tile.position.y,
        w: tile.position.width,
        h: tile.position.height,
        minW: tile.minW,
        minH: tile.minH,
        visible: tile.visible,
        tab: tile.type,

        // Common fields shared across tile types
        moved: tile.moved,
        static: tile.static,
        context: tile.context,
        table: tile.table,
        auto_update: tile.auto_update,
        freeze: tile.freeze,
        filters: tile.filters,
        common_filter: tile.common_filter
      };

      // Add type-specific properties based on the tile type
      if (tile.type === 'Table' && tile.tableData) {
        // Add table-specific properties from TableTileData
        tileProps.table_type = tile.tableData.table_type || 'Data Table';
        tileProps.column_context = tile.tableData.column_context;
        tileProps.page_number = tile.tableData.page_number;
        tileProps.metric = tile.tableData.metric;
        tileProps.column_order = tile.tableData.column_order;
        tileProps.hidden_columns = tile.tableData.hidden_columns;
        tileProps.sorting = tile.tableData.sorting;
        tileProps.grouping = tile.tableData.grouping;
        tileProps.group_sorting = tile.tableData.group_sorting;
        tileProps.columns_pin_left = tile.tableData.columns_pin_left;
        tileProps.columns_pin_right = tile.tableData.columns_pin_right;
        tileProps.selected = tile.tableData.selected;
        tileProps.base_index = tile.tableData.base_index;

      } else if (tile.type === 'Plot' && tile.plotData) {
        // Add plot-specific properties from PlotTileData
        tileProps.plot_type = tile.plotData.plot_type;
        tileProps.plot_scale_x = tile.plotData.plot_scale_x;
        tileProps.plot_scale_y = tile.plotData.plot_scale_y;
        tileProps.is_aggregated = tile.plotData.is_aggregated;
        tileProps.x_axis = tile.plotData.x_axis;
        tileProps.y_axis = tile.plotData.y_axis;
        tileProps.plot_group_by = tile.plotData.plot_group_by;
        tileProps.bin_count = tile.plotData.bin_count;
        tileProps.regression_line = tile.plotData.regression_line;

      } else if (tile.type === 'View' && tile.viewData) {
        // Add view-specific fields here if needed
      }

      // // 2) Cache this result
      // lastTileObj = tile;
      // lastTileProps = tileProps;
      return tileProps;
    },

    // Conversion to Tile from TileProps
    fromTileItem: (tileItem: TileProps) => {
      // Create core Tile properties from base TileProps
      const tileUpdates: Partial<Tile> = {
        id: tileItem.i,
        name: tileItem.i,
        position: {
          ...(tile.position || {}),
          x: tileItem.x,
          y: tileItem.y,
          width: tileItem.w,
          height: tileItem.h,
        },
        minW: tileItem.minW,
        minH: tileItem.minH,
        visible: tileItem.visible,
        type: tileItem.tab,  // 'Table' / 'Plot' / 'View'

        // Common fields shared across tile types
        moved: tileItem.moved,
        static: tileItem.static,

        context: tileItem.context,
        table: tileItem.table,
        auto_update: tileItem.auto_update,
        freeze: tileItem.freeze,
        filters: tileItem.filters,
        common_filter: tileItem.common_filter,
      }

      // If tileItem belongs to 'Table', update its tableData fields:
      // parse table_type, column_context, etc.
      let finalUpdates: Partial<Tile> = {...tileUpdates};
      if (tileItem.tab === "Table") {
        const tableDataUpdates: Partial<TableTileData> = {
          table_type: tileItem.table_type,
          column_context: tileItem.column_context,
          page_number: tileItem.page_number,
          metric: tileItem.metric,
          column_order: tileItem.column_order,
          hidden_columns: tileItem.hidden_columns,
          sorting: tileItem.sorting,
          grouping: tileItem.grouping,
          group_sorting: tileItem.group_sorting,
          columns_pin_left: tileItem.columns_pin_left,
          columns_pin_right: tileItem.columns_pin_right,
          selected: tileItem.selected,
          base_index: tileItem.base_index
        }
        finalUpdates = {...finalUpdates, ...tableDataUpdates} as Partial<Tile>;

      } else if (tileItem.tab === "Plot") {
        const plotDataUpdates: Partial<PlotTileData> = {
          plot_type: tileItem.plot_type,
          plot_scale_x: tileItem.plot_scale_x,
          plot_scale_y: tileItem.plot_scale_y,
          is_aggregated: tileItem.is_aggregated,
          x_axis: tileItem.x_axis,
          y_axis: tileItem.y_axis,
          plot_group_by: tileItem.plot_group_by,
          bin_count: tileItem.bin_count,
          regression_line: tileItem.regression_line,
        };
        finalUpdates = {...finalUpdates, ...plotDataUpdates} as Partial<Tile>;

      } else if (tileItem.tab === "View") {
        const viewDataUpdates: Partial<ViewTileData> = {
          // Add view-specific fields here if needed
        };
        finalUpdates = {...finalUpdates, ...viewDataUpdates} as Partial<Tile>;
      }

      // Apply all updates to the tile
      store.updateTile(projectId, interfaceId, tabId, tileId, finalUpdates);
      return true;
    }
  };
} 

/**
 * Custom hook to access tile state and actions
 * @param tileId The ID of the tile to access
 * @param tabId Optional tab ID (if not provided, will search for tile across all tabs)
 * @param interfaceId Optional interface ID (if not provided, active interface will be used)
 * @param projectId Optional project ID (if not provided, active project will be used)
 * @returns Object containing tile state, actions, and existence flag
 */
export function useTile(
  tileId: string | null,
  tabId?: string | null,
  interfaceId?: string | null,
  projectId?: string | null
) {
  // Always call hooks at the top level, unconditionally
  
  // Get active project and interface IDs if not provided
  const activeProjectId = useStoreContext(state => 
    projectId !== undefined ? projectId : state.activeProjectId
  );
  
  const activeInterfaceId = useStoreContext(state => 
    interfaceId !== undefined ? interfaceId : state.activeInterfaceId
  );
  
  const activeTabId = useStoreContext(state => {
    if (tabId !== undefined) return tabId;
    return state.activeTabId;
  });
  
  // Find the tab containing this tile if not provided
  const foundTabId = useStoreContext(state => {
    // If we have a specific tabId, use it
    if (activeTabId) return activeTabId;
    
    // Otherwise search for the tile in all tabs of the interface
    if (!tileId || !activeProjectId || !activeInterfaceId) return null;
    const interfaceTabs = state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs;
    if (!interfaceTabs) return null;
    
    // Search all tabs for the tile
    for (const tabId in interfaceTabs) {
      if (interfaceTabs[tabId].tiles?.[tileId]) {
        return tabId;
      }
    }
    
    return null;
  });

  // Instead of subscribing to the entire interface object,
  // we subscribe to individual properties. This way, changes in
  // unrelated fields won't cause a new reference for everything.

  // We'll check if this tab actually exists:
  const hasTile = useStoreContext(state => {
    if (!tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return false;
    return !!state.projectsById[activeProjectId]?.interfaces?.[activeInterfaceId]?.tabs?.[foundTabId]?.tiles?.[tileId];
  });

  // Narrow subscriptions for each property in the tile
  const name = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return '';
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].name;
  });
  const type = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].type;
  });
  const position = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return DEFAULT_TILE_POSITION;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].position;
  });
  const minW = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].minW;
  });
  const minH = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].minH;
  });
  const visible = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].visible;
  });
  const locked = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].locked;
  });
  const pending = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].pending;
  });
  const loading = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return false;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].loading;
  });
  const error = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return null;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].error;
  });
  const moved = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].moved;
  });
  const static_ = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].static;
  });
  const context = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].context;
  });
  const table = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].table;
  });
  const auto_update = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].auto_update;
  });
  const freeze = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].freeze;
  });
  const filters = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].filters;
  });
  const common_filter = useStoreContext((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return undefined;
    return state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId].common_filter;
  });

  // For tableData, plotData, viewData (we can subscribe or do a single subscription if we prefer)
  const tableData = useStoreContext(
    useShallow((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return null;
    const tileRef = state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId];
    return tileRef.tableData || null;
  }));
  const plotData = useStoreContext(
    useShallow((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return null;
    const tileRef = state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId];
    return tileRef.plotData || null;
  }));
  const viewData = useStoreContext(
    useShallow((state) => {
    if (!hasTile || !tileId || !activeProjectId || !activeInterfaceId || !foundTabId) return null;
    const tileRef = state.projectsById[activeProjectId].interfaces[activeInterfaceId].tabs[foundTabId].tiles[tileId];
    return tileRef.viewData || null;
  }));

  // We'll build a complete tile object from the individual fields
  const finalTile = useMemo(() => {
    if (!hasTile || !tileId) return null;

    return {
      // Core tile properties
      id: tileId,
      name,
      type,
      position,
      minW,
      minH,
      visible,
      locked,
      pending,
      loading,
      error,

      // Grid-specific optional fields
      moved,
      static: static_,

      // Common fields shared across tile types
      context,
      table,
      auto_update,
      freeze,
      filters,
      common_filter,
      
      // Reference to the content-specific data
      tableData,
      plotData,
      viewData
    };
  }, [
    tileId,
    hasTile,
    name,
    type,
    position,
    minW,
    minH,
    visible,
    locked,
    pending,
    loading,
    error,
    moved,
    static_,
    context,
    table,
    auto_update,
    freeze,
    filters,
    common_filter,
    tableData,
    plotData,
    viewData
  ]);

  // Access the global store api
  const storeApi = useStoreApiContext();
  
  // Use our factory to create actions
  const actions = useMemo(() => {
    if (!tileId || !foundTabId || !activeInterfaceId || !activeProjectId || !finalTile) {
      return null;
    }

    // Get the store state
    const storeState = storeApi.getState();

    return createTileActions(
      tileId, 
      foundTabId, 
      activeInterfaceId,
      activeProjectId,
      finalTile as unknown as Tile,
      storeState
    );
  }, [
    tileId, 
    foundTabId, 
    activeInterfaceId,
    activeProjectId,
    finalTile, 
    context,
    storeApi,
  ]);

  // Use tileId to conditionally return values, but only after all hooks are called
  if (tileId === null) {
    return DEFAULT_TILE_RETURN;
  }

  return {
    tile: finalTile,
    actions,
    exists: hasTile,
  };
}

/**
 * Hook to access tile actions for any tile without violating React hook rules
 */
export function useTileActions() {
  // Access the global store api
  const storeApi = useStoreApiContext();

  // // Use a ref to cache tile actions
  // const tileActionsCache = useRef<Record<string, TileActions>>({});
  
  // Create a memoized function to get tile actions
  const getTileActions = useCallback((
    tileId: string, 
    tabId: string | null, 
    interfaceId?: string | null, 
    projectId?: string | null
  ): TileActions | null => {
    if (!tileId || !tabId || !projectId || !interfaceId) return null;

    // We can read the store state once, do not cause subscription
    const storeState = storeApi.getState();
    
    // Check if tile exists in store
    const tile = storeState.projectsById?.[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId]?.tiles?.[tileId];
    if (!tile) return null;

    // // Include a version property (e.g., tile.updatedAt) in the cache key so that
    // // any update to the tile invalidates the cache.
    // const cacheKey = `${projectId}:${interfaceId}:${tabId}:${tileId}:${tile.updatedAt}`;
    
    // // Return cached actions if available
    // if (tileActionsCache.current[cacheKey]) {
    //   return tileActionsCache.current[cacheKey];
    // }

    // Create actions using the factory
    const actions = createTileActions(tileId, tabId, interfaceId, projectId, tile, storeState);
    
    // // Cache the actions
    // if (actions) {
    //   tileActionsCache.current[cacheKey] = actions;
    // }

    return actions;
  }, [storeApi]);
  
  return { getTileActions };
}