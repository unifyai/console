import { useCallback, useMemo } from 'react';
import { useStoreContext, useStoreApiContext } from '../providers/StoreProvider';
import { Tile, TileMeta, TileData, TileUI, TilePosition } from '../slices/selectors/tile';
import { TableTile } from '../slices/selectors/tableTile';
import { PlotTile } from '../slices/selectors/plotTile';
import { ViewTile } from '../slices/selectors/viewTile';
import { IStoreState } from '../store';
import { TileProps } from '@/types/evals/grid';
import { useShallow } from 'zustand/react/shallow';
import { constructHierarchicalId } from '../utils/sliceUtils';

// Define stable fallback references
const DEFAULT_TILE_POSITION: TilePosition = { x: 0, y: 0, width: 2, height: 2 };
const DEFAULT_TILE_RETURN = {
  tile: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  actions: null,
  exists: false
};

/**
 * Interface for tile meta-related actions
 */
export interface TileMetaActions {
  setName: (name: string) => void;
  setPosition: (position: Partial<TilePosition>) => void;
  setMinW: (minW?: number) => void;
  setMinH: (minH?: number) => void;
}

/**
 * Interface for tile data-related actions
 */
export interface TileDataActions {
  setType: (type: 'Table' | 'Plot' | 'View') => void;
  setContext: (context?: string) => void;
  setTable: (table?: string) => void;
  setAutoUpdate: (autoUpdate?: string) => void;
  setFreeze: (freeze?: string) => void;
  setFilters: (filters?: string) => void;
  setCommonFilter: (commonFilter?: string) => void;
  
  // Type-specific updates
  updateTableTile: (updates: Partial<TableTile>) => void;
  updatePlotTile: (updates: Partial<PlotTile>) => void;
  updateViewTile: (updates: Partial<ViewTile>) => void;
}

/**
 * Interface for tile UI-related actions
 */
export interface TileUIActions {
  setVisible: (visible: boolean) => void;
  setLocked: (locked: boolean) => void;
  setPending: (pending: boolean) => void;
  setLoading: (loading?: boolean) => void;
  setError: (error?: string | null) => void;
  setMoved: (moved?: boolean) => void;
  setStatic: (static_?: boolean) => void;
  setItemsNeedRecompute: (needsRecompute: boolean) => void;
}

/**
 * Combined interface for all tile-related actions
 */
export interface TileActions {
  // Basic tile management
  updateTile: (updates: Partial<Tile>) => void;
  removeTile: () => void;
  
  // Categorized actions
  meta: TileMetaActions;
  data: TileDataActions;
  ui: TileUIActions;

  // Conversion utilities
  asTileItem: () => TileProps;
  fromTileItem: (tileItem: TileProps) => boolean;
}

/**
 * Factory function to create tile actions
 */
export function createTileActions(
  tileId: string,
  tabId: string | null,
  tile: Tile | null,
  store: IStoreState
): TileActions | null {
  if (!tileId || !tabId || !tile) {
    return null;
  }
  
  // Get action functions for tiles
  const updateTile = store.updateTile;
  const removeTile = store.removeTile;
  const updateTableTile = store.updateTableTile;
  const updatePlotTile = store.updatePlotTile;
  const updateViewTile = store.updateViewTile;

  // Meta actions
  const metaActions: TileMetaActions = {
    setName: (name) => {
      updateTile(tileId, { name });
    },
    
    setPosition: (position) => {
      updateTile(tileId, { 
        position: { ...tile.position, ...position } 
      });
    },
    
    setMinW: (minW) => {
      updateTile(tileId, { minW });
    },
    
    setMinH: (minH) => {
      updateTile(tileId, { minH });
    }
  };
  
  // Data actions
  const dataActions: TileDataActions = {
    setType: (type) => {
      updateTile(tileId, { type });
    },
    
    setContext: (context) => {
      updateTile(tileId, { context });
    },
    
    setTable: (table) => {
      updateTile(tileId, { table });
    },
    
    setAutoUpdate: (autoUpdate) => {
      updateTile(tileId, { auto_update: autoUpdate });
    },
    
    setFreeze: (freeze) => {
      updateTile(tileId, { freeze });
    },
    
    setFilters: (filters) => {
      updateTile(tileId, { filters });
    },
    
    setCommonFilter: (commonFilter) => {
      updateTile(tileId, { common_filter: commonFilter });
    },
    
    // Type-specific updates
    updateTableTile: (updates) => {
      if (tile.type === 'Table') {
        updateTableTile(tileId, updates);
      }
    },
    
    updatePlotTile: (updates) => {
      if (tile.type === 'Plot') {
        updatePlotTile(tileId, updates);
      }
    },
    
    updateViewTile: (updates) => {
      if (tile.type === 'View') {
        updateViewTile(tileId, updates);
      }
    }
  };
  
  // UI actions
  const uiActions: TileUIActions = {
    setVisible: (visible) => {
      updateTile(tileId, { visible });
    },
    
    setLocked: (locked) => {
      updateTile(tileId, { locked });
    },
    
    setPending: (pending) => {
      updateTile(tileId, { pending });
    },
    
    setLoading: (loading) => {
      updateTile(tileId, { loading });
    },
    
    setError: (error) => {
      updateTile(tileId, { error });
    },
    
    setMoved: (moved) => {
      updateTile(tileId, { moved });
    },
    
    setStatic: (static_) => {
      updateTile(tileId, { static: static_ });
    },
    
    setItemsNeedRecompute: (needsRecompute) => {
      updateTile(tileId, { itemsNeedRecompute: needsRecompute });
    }
  };

  // Combined actions object
  return {
    // Basic tile management
    updateTile: (updates) => {
      updateTile(tileId, updates);
    },
    
    removeTile: () => {
      removeTile(tabId, tileId);
    },
    
    // Categorized actions
    meta: metaActions,
    data: dataActions,
    ui: uiActions,

    // Conversion utilities
    asTileItem: () => {
      if (!tile) {
        return { i: tileId.split('>').pop() } as TileProps;
      }

      // Create a base TileProps object with common properties
      const tileProps: TileProps = {
        i: tile.name,
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
      if (tile.type === 'Table' && tile.tableTile) {
        // Add table-specific properties from TableTileData
        const tableTile = tile.tableTile;
        tileProps.table_type = tableTile.table_type || 'Data Table';
        tileProps.column_context = tableTile.column_context;
        tileProps.page_number = tableTile.page_number;
        tileProps.metric = tableTile.metric;
        tileProps.column_order = tableTile.column_order;
        tileProps.hidden_columns = tableTile.hidden_columns;
        tileProps.sorting = tableTile.sorting;
        tileProps.grouping = tableTile.grouping;
        tileProps.group_sorting = tableTile.group_sorting;
        tileProps.columns_pin_left = tableTile.columns_pin_left;
        tileProps.columns_pin_right = tableTile.columns_pin_right;
        tileProps.selected = tableTile.selected;
        tileProps.base_index = tableTile.base_index;
        
      } else if (tile.type === 'Plot' && tile.plotTile) {
        // Add plot-specific properties from PlotTileData
        const plotTile = tile.plotTile;
        tileProps.plot_type = plotTile.plot_type;
        tileProps.plot_scale_x = plotTile.plot_scale_x;
        tileProps.plot_scale_y = plotTile.plot_scale_y;
        tileProps.is_aggregated = plotTile.is_aggregated;
        tileProps.x_axis = plotTile.x_axis;
        tileProps.y_axis = plotTile.y_axis;
        tileProps.plot_group_by = plotTile.plot_group_by;
        tileProps.bin_count = plotTile.bin_count;
        tileProps.regression_line = plotTile.regression_line;
        
      } else if (tile.type === 'View' && tile.viewTile) {
        // Add view-specific fields here if needed
      }
      
      return tileProps;
    },
    
    fromTileItem: (tileItem: TileProps) => {
      // Create core Tile properties from base TileProps
      const hierarchicalTileId = tileItem.i.includes('>') 
        ? tileItem.i
        : `${tabId}>${tileItem.i}`;

      const tileUpdates: Partial<Tile> = {
        id: hierarchicalTileId,
        name: tileItem.i,
        position: {
          x: tileItem.x,
          y: tileItem.y,
          width: tileItem.w,
          height: tileItem.h
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
        common_filter: tileItem.common_filter
      };

      let finalUpdates: Partial<Tile> = {...tileUpdates};
      // Now handle type-specific properties
      if (tile.type === 'Table') {
        // Apply table-specific updates
        const tableUpdates: Partial<TableTile> = {
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
        finalUpdates = {...finalUpdates, ...tableUpdates} as Partial<Tile>;

      } else if (tileItem.tab === "Plot") {
        // Apply plot-specific updates
        const plotUpdates: Partial<PlotTile> = {
          plot_type: tileItem.plot_type,
          plot_scale_x: tileItem.plot_scale_x,
          plot_scale_y: tileItem.plot_scale_y,
          is_aggregated: tileItem.is_aggregated,
          x_axis: tileItem.x_axis,
          y_axis: tileItem.y_axis,
          plot_group_by: tileItem.plot_group_by,
          bin_count: tileItem.bin_count,
          regression_line: tileItem.regression_line
        };
        
        finalUpdates = {...finalUpdates, ...plotUpdates} as Partial<Tile>;
        
      } else if (tileItem.tab === "View") {
        // Apply view-specific updates
        const viewUpdates: Partial<ViewTile> = {
          // Add view-specific fields here if needed
        };
        finalUpdates = {...finalUpdates, ...viewUpdates} as Partial<Tile>;
      }

      // Apply all updates to the tile
      store.updateTile(tileId, finalUpdates);
      return true;
    }
  };
}

/**
 * Custom hook to access tile state and actions
 * @param tileName The name of the tile to access
 * @param tabName Optional tab name (if not provided, will search for tile across all tabs)
 * @param interfaceName Optional interface name (if not provided, active interface will be used)
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing tile state, actions, and existence flag
 */
export function useTile(
  tileName: string | null,
  tabName?: string | null,
  interfaceName?: string | null,
  projectName?: string | null
) {
  // Call all hooks unconditionally at the top level
  
  // Get active project ID, interface ID, and tab ID if not provided
  const activeProjectId = useStoreContext(state => 
    projectName ? projectName : state.activeProjectId
  );
  
  const interfaceId = useStoreContext(state => 
    interfaceName ? interfaceName : state.activeInterfaceId
  );

  // Construct hierarchical interface ID if needed
  const activeInterfaceId = useMemo(() => {
    if (!interfaceId || !activeProjectId) return null;
    return interfaceId.includes('>') ? interfaceId : constructHierarchicalId(interfaceId, [activeProjectId]);
  }, [interfaceId, activeProjectId]);
  
  const tabId = useStoreContext(state => 
    tabName ? tabName : state.activeTabId
  );

  // Construct hierarchical tab ID if needed
  const activeTabId = useMemo(() => {
    if (!tabId || !activeInterfaceId) return null;
    return tabId.includes('>') ? tabId : constructHierarchicalId(tabId, [activeInterfaceId]);
  }, [tabId, activeInterfaceId]);

  // Find the tab that contains this tile (if needed)
  const foundTabId = useStoreContext(state => {
    if (!tileName || !activeProjectId || !activeInterfaceId) return null;
    
    // First check if the tab was explicitly provided
    if (activeTabId) {
      // Check if the tile exists in this tab
      const hierarchicalTileId = tileName.includes('>')
        ? tileName
        : `${activeTabId}>${tileName}`;
      
      if (state.tilesById?.[hierarchicalTileId]) {
        return activeTabId;
      }
    }
    
    // Otherwise, look for the tile in all tabs
    const interfaceTabs = state.tabsById;
    if (!interfaceTabs) return null;
    
    // Find all tabs for this interface
    const tabPrefix = `${activeInterfaceId}>`;
    for (const id in interfaceTabs) {
      if (id.startsWith(tabPrefix)) {
        // Get the tile IDs in this tab
        const tabTileIds = interfaceTabs[id].tileIds || [];
        
        // Check if this tile ID is in the tab's tile IDs
        if (tabTileIds.some(t => t.endsWith(`>${tileName}`))) {
          // Extract the tab ID from the full ID
          return id;
        }
      }
    }
    
    return null;
  });

  // Construct hierarchical ID if needed
  const tileId = useMemo(() => {
    if (!tileName || !foundTabId) return null;
    
    // Check if the tileId already has the hierarchical format
    if (tileName.includes('>')) {
      return tileName;
    }
    
    // Otherwise, construct it
    return `${foundTabId}>${tileName}`;
  }, [tileName, foundTabId]);
  
  // Check if tile exists
  const hasTile = useStoreContext(state => {
    if (!tileId) return false;
    return !!state.tilesById[tileId];
  });

  // Granular subscriptions to Meta properties
  const id = tileId;
  
  const name = useStoreContext(state => {
    if (!hasTile || !tileId) return '';
    return state.tilesById[tileId].name;
  });
  
  const type = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].type;
  });
  
  const position = useStoreContext(state => {
    if (!hasTile || !tileId) return DEFAULT_TILE_POSITION;
    return state.tilesById[tileId].position;
  });
  
  const minW = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].minW;
  });
  
  const minH = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].minH;
  });

  // Granular subscriptions to Data properties
  const context = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].context;
  });
  
  const table = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].table;
  });
  
  const auto_update = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].auto_update;
  });
  
  const freeze = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].freeze;
  });
  
  const filters = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].filters;
  });
  
  const common_filter = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].common_filter;
  });

  // Granular subscriptions to UI properties
  const projectIdFromState = useStoreContext(state => {
    if (!hasTile || !tileId) return null;
    return state.tilesById[tileId].projectId;
  });
  
  const interfaceIdFromState = useStoreContext(state => {
    if (!hasTile || !tileId) return null;
    return state.tilesById[tileId].interfaceId;
  });
  
  const tabIdFromState = useStoreContext(state => {
    if (!hasTile || !tileId) return null;
    return state.tilesById[tileId].tabId;
  });
  
  const visible = useStoreContext(state => {
    if (!hasTile || !tileId) return false;
    return state.tilesById[tileId].visible;
  });
  
  const locked = useStoreContext(state => {
    if (!hasTile || !tileId) return false;
    return state.tilesById[tileId].locked;
  });
  
  const pending = useStoreContext(state => {
    if (!hasTile || !tileId) return false;
    return state.tilesById[tileId].pending;
  });
  
  const loading = useStoreContext(state => {
    if (!hasTile || !tileId) return false;
    return state.tilesById[tileId].loading;
  });
  
  const error = useStoreContext(state => {
    if (!hasTile || !tileId) return null;
    return state.tilesById[tileId].error;
  });
  
  const moved = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].moved;
  });
  
  const static_ = useStoreContext(state => {
    if (!hasTile || !tileId) return undefined;
    return state.tilesById[tileId].static;
  });

  // Type-specific data
  const tableTile = useStoreContext(
    useShallow(state => {
      if (!hasTile || !tileId) return null;
      if (state.tilesById[tileId].type !== 'Table') return null;
      return state.tilesById[tileId].tableTile;
    })
  );
  
  const plotTile = useStoreContext(
    useShallow(state => {
      if (!hasTile || !tileId) return null;
      if (state.tilesById[tileId].type !== 'Plot') return null;
      return state.tilesById[tileId].plotTile;
    })
  );
  
  const viewTile = useStoreContext(
    useShallow(state => {
      if (!hasTile || !tileId) return null;
      if (state.tilesById[tileId].type !== 'View') return null;
      return state.tilesById[tileId].viewTile;
    })
  );

  // Access store API for actions
  const storeApi = useStoreApiContext();
  
  // Memoize the meta object to prevent unnecessary rerenders
  const meta = useMemo<Partial<TileMeta> | null>(() => {
    if (!hasTile) return null;
    
    return {
      id: id as string,
      name,
      type,
      position,
      minW,
      minH,
    };
  }, [
    hasTile,
    id,
    name,
    type,
    position,
    minW,
    minH,
  ]);
  
  // Memoize the data object to prevent unnecessary rerenders
  const data = useMemo<Partial<TileData> | null>(() => {
    if (!hasTile) return null;
    
    return {
      context,
      table,
      auto_update,
      freeze,
      filters,
      common_filter
    };
  }, [
    hasTile,
    context,
    table,
    auto_update,
    freeze,
    filters,
    common_filter
  ]);
  
  // Memoize the UI state object to prevent unnecessary rerenders
  const ui = useMemo<Partial<TileUI> | null>(() => {
    if (!hasTile) return null;
    
    return {
      projectId: projectIdFromState,
      interfaceId: interfaceIdFromState,
      tabId: tabIdFromState,
      visible,
      locked,
      pending,
      loading,
      error,
      moved,
      static: static_
    };
  }, [
    hasTile,
    projectIdFromState,
    interfaceIdFromState,
    tabIdFromState,
    visible,
    locked,
    pending,
    loading,
    error,
    moved,
    static_
  ]);

  // Create tile actions using our factory function
  const actions = useMemo(() => {
    // Build the complete tile object for the factory function
    const tileObj: Tile | null = meta && data && ui ? {
      ...meta,
      ...data,
      ...ui,
      tableTile,
      plotTile,
      viewTile
    } as Tile : null;
    
    return createTileActions(
      tileId || '',
      foundTabId || null,
      tileObj,
      storeApi.getState()
    );
  }, [
    meta,
    data,
    ui,
    tableTile,
    plotTile,
    viewTile,
    tileId,
    foundTabId,
    activeInterfaceId,
    activeProjectId,
    storeApi
  ]);

  // Memoize the final tile object to prevent unnecessary rerenders
  const finalTile = useMemo<Partial<Tile> | null>(() => {
    if (!meta || !data || !ui) return null;
    
    return {
      ...meta,
      ...data,
      ...ui,
      tableTile,
      plotTile,
      viewTile
    };
  }, [
    meta,
    data,
    ui,
    tableTile,
    plotTile,
    viewTile
  ]);

  // Use tileId to conditionally return values, but only after all hooks are called
  if (tileName === null) {
    return DEFAULT_TILE_RETURN;
  }

  return {
    tile: finalTile,
    meta,
    data,
    ui,
    metaActions: actions?.meta || null,
    dataActions: actions?.data || null,
    uiActions: actions?.ui || null,
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
  
  // Create a memoized function to get tile actions
  const getTileActions = useCallback((
    tileId: string, 
    tabId: string | null, 
  ): TileActions | null => {
    if (!tileId || !tabId) return null;
    
    // Resolve optional IDs if not provided
    const state = storeApi.getState();
    
    // Get the tile from state
    const tile = state.tilesById[tileId];
    if (!tile) return null;
    
    // Create actions for this tile
    return createTileActions(
      tileId,
      tabId,
      tile,
      state
    );
  }, [storeApi]);
  
  return { getTileActions };
}