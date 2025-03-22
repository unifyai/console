import { useMemo, useCallback } from 'react';
import { useStoreContext, useStoreApiContext } from '../../providers/StoreProvider';
import { useTileMeta } from './useTileMeta';
import { useTileUI } from './useTileUI';
import { useTileData } from './useTileData';
import { Tile } from '../../slices/selectors/tile';
import { TableTile } from '../../slices/selectors/tableTile';
import { PlotTile } from '../../slices/selectors/plotTile';
import { TileProps } from '@/types/evals/grid';
import { constructHierarchicalId, getParentId } from '@/contexts/utils/sliceUtils';

/**
 * Interface for tile item conversion actions
 */
export interface TileItemActions {
  asTileItem: () => TileProps;
  fromTileItem: (tileItem: TileProps) => boolean;
}

/**
 * Factory function to create tile item actions
 */
export function createTileItemActions(
  tileId: string,
  tile: Partial<Tile> | null,
  storeUpdateTile: (id: string, updates: any) => void,
  storeUpdateTableTile: (id: string, updates: any) => void,
  storeUpdatePlotTile: (id: string, updates: any) => void,
  storeUpdateViewTile: (id: string, updates: any) => void
): TileItemActions | null {
  if (!tileId || !tile) {
    return null;
  }
  
  return {
    asTileItem: () => {
      // Create a base TileProps object with common properties
      const tileProps: TileProps = {
        i: tile.name || '',
        x: tile.position?.x || 0,
        y: tile.position?.y || 0,
        w: tile.position?.width || 2,
        h: tile.position?.height || 2,
        minW: tile.minW,
        minH: tile.minH,
        visible: tile.visible !== false,
        tab: tile.type as any,
        
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
        // Add table-specific properties
        Object.assign(tileProps, {
          table_type: tile.tableTile.table_type,
          column_context: tile.tableTile.column_context,
          page_number: tile.tableTile.page_number,
          metric: tile.tableTile.metric,
          column_order: tile.tableTile.column_order,
          hidden_columns: tile.tableTile.hidden_columns,
          sorting: tile.tableTile.sorting,
          grouping: tile.tableTile.grouping,
          group_sorting: tile.tableTile.group_sorting,
          columns_pin_left: tile.tableTile.columns_pin_left,
          columns_pin_right: tile.tableTile.columns_pin_right,
          selected: tile.tableTile.selected,
          base_index: tile.tableTile.base_index
        });
      } else if (tile.type === 'Plot' && tile.plotTile) {
        // Add plot-specific properties
        Object.assign(tileProps, {
          plot_type: tile.plotTile.plot_type,
          plot_scale_x: tile.plotTile.plot_scale_x,
          plot_scale_y: tile.plotTile.plot_scale_y,
          is_aggregated: tile.plotTile.is_aggregated,
          x_axis: tile.plotTile.x_axis,
          y_axis: tile.plotTile.y_axis,
          plot_group_by: tile.plotTile.plot_group_by,
          bin_count: tile.plotTile.bin_count,
          regression_line: tile.plotTile.regression_line
        });
      } else if (tile.type === 'View' && tile.viewTile) {
        // Add view-specific properties
        // (Add view-specific fields here if needed)
      }
      
      return tileProps;
    },
    
    fromTileItem: (tileItem: TileProps) => {
      
      // Create core Tile properties from base TileProps
      const hierarchicalTileId = tileItem.i.includes('>') 
        ? tileItem.i
        : constructHierarchicalId(tileItem.i, [getParentId(tileId)]);

      // Create core Tile properties from base TileProps
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
        type: tileItem.tab as any,  // 'Table' | 'Plot' | 'View'
        
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
      
      // Apply all updates to the tile
      storeUpdateTile(tileId, tileUpdates);
      
      // Now handle type-specific properties based on the tile type
      if (tileItem.tab === 'Table') {
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
        };
        
        storeUpdateTableTile(tileId, tableUpdates);
      } else if (tileItem.tab === 'Plot') {
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
        
        storeUpdatePlotTile(tileId, plotUpdates);
      } else if (tileItem.tab === 'View') {
        // Apply view-specific updates
        // (Add view-specific updates here if needed)
        storeUpdateViewTile(tileId, {});
      }
      
      return true;
    }
  };
}

/**
 * Custom hook to access tile item conversion utilities
 * @param tileName The name of the tile to access
 * @param tabName The name of the tab containing the tile
 * @param interfaceName The name of the interface containing the tab
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing tile item conversion actions
 */
export function useTileItem(
  tileName: string | null,
  tabName: string | null,
  interfaceName: string | null,
  projectName?: string | null
) {
  // Use the existing hooks to get all necessary tile information
  const { meta, tileId, tileExists } = useTileMeta(tileName, tabName, interfaceName, projectName);
  const { ui } = useTileUI(tileName, tabName, interfaceName, projectName);
  const { data, tableTile, plotTile, viewTile } = useTileData(tileName, tabName, interfaceName, projectName);
  
  // Get store actions for data management
  const storeUpdateTile = useStoreContext(state => state.updateTile);
  const storeUpdateTableTile = useStoreContext(state => state.updateTableTile);
  const storeUpdatePlotTile = useStoreContext(state => state.updatePlotTile);
  const storeUpdateViewTile = useStoreContext(state => state.updateViewTile);

  // Combine tile data for the action creator
  const tile = useMemo<Partial<Tile> | null>(() => {
    if (!meta || !tileId) return null;
    
    return {
      ...meta,
      ...data,
      ...ui,
      tableTile,
      plotTile,
      viewTile
    };
  }, [meta, data, ui, tableTile, plotTile, viewTile, tileId]);

  // Memoize the item actions using the factory function
  const itemActions = useMemo(() => {
    return createTileItemActions(
      tileId || '',
      tile,
      storeUpdateTile,
      storeUpdateTableTile,
      storeUpdatePlotTile,
      storeUpdateViewTile
    );
  }, [
    tileId,
    tile,
    storeUpdateTile,
    storeUpdateTableTile,
    storeUpdatePlotTile,
    storeUpdateViewTile
  ]);

  return {
    itemActions,
    tileExists
  };
}

/**
 * Hook to access tile item actions for any tile without violating React hook rules
 */
export function useTileItemActions() {
  // Access the global store api
  const storeApi = useStoreApiContext();
  
  // Create a memoized function to get tile item actions
  const getTileItemActions = useCallback((
    tileName: string,
    tabName: string | null,
    interfaceName: string | null = null,
    projectName: string | null = null
  ) => {
    if (!tileName || !tabName) return null;
    
    // Get state from store
    const state = storeApi.getState();
    
    // Resolve hierarchical IDs 
    const projectId = projectName || state.activeProjectId;
    if (!projectId) return null;
    
    const interfaceId = interfaceName 
      ? (interfaceName.includes('>') ? interfaceName : constructHierarchicalId(interfaceName, [projectId]))
      : state.activeInterfaceId;
    if (!interfaceId) return null;
    
    const resolvedTabId = tabName.includes('>') 
      ? tabName 
      : constructHierarchicalId(tabName, [interfaceId]);
    
    const resolvedTileId = tileName.includes('>')
      ? tileName
      : constructHierarchicalId(tileName, [resolvedTabId]);
    
    // Get the tile from state
    const tile = state.tilesById[resolvedTileId];
    if (!tile) return null;
    
    // Create actions for this tile using the factory function
    return createTileItemActions(
      resolvedTileId,
      tile,
      state.updateTile,
      state.updateTableTile,
      state.updatePlotTile,
      state.updateViewTile
    );
  }, [storeApi]);
  
  return { getTileItemActions };
} 