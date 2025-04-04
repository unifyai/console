import { Tile } from '../../slices/selectors/tile';
import { TableTile } from '../../slices/selectors/tableTile';
import { PlotTile } from '../../slices/selectors/plotTile';
import { ViewTile } from '../../slices/selectors/viewTile';
import { EditorTile } from '../../slices/selectors/editorTile';
import { TileProps } from '@/types/evals/grid';
import { constructHierarchicalId, getParentId } from '@/contexts/utils/sliceUtils';

/**
 * Converts a Tile object to a TileProps object for grid layout
 * @param tile The tile object to convert
 * @returns A TileProps object representing the tile
 */
export function convertTileToTileItem(tile: Partial<Tile>): TileProps {
  // Create a base TileProps object with common properties
  const tileProps: TileProps = {
    i: tile.name || '',
    x: tile.position?.x || 0,
    y: tile.position?.y || 0,
    w: tile.position?.width || 2,
    h: tile.position?.height || 2,
    minW: tile.minW || undefined,
    minH: tile.minH || undefined,
    visible: tile.visible !== false,
    tab: tile.type as any,
    
    // Common fields shared across tile types
    moved: tile.moved,
    static: tile.static,
    context: tile.context || undefined,
    table: tile.table || undefined,
    auto_update: tile.auto_update || undefined,
    freeze: tile.freeze || undefined,
    filters: tile.filters || undefined,
    common_filter: tile.common_filter || undefined,
    metric: tile.metric || undefined,
  };
  
  // Add type-specific properties based on the tile type
  if (tile.type === 'Table' && tile.tableTile) {
    // Add table-specific properties
    Object.assign(tileProps, {
      table_type: tile.tableTile.table_type,
      column_context: tile.tableTile.column_context,
      page_number: tile.tableTile.page_number,
      column_order: tile.tableTile.column_order,
      hidden_columns: tile.tableTile.hidden_columns,
      sorting: tile.tableTile.sorting,
      grouping: tile.tableTile.grouping,
      group_sorting: tile.tableTile.group_sorting,
      columns_pin_left: tile.tableTile.columns_pin_left,
      columns_pin_right: tile.tableTile.columns_pin_right,
      selected: tile.tableTile.selected,
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
    Object.assign(tileProps, {
      base_index: tile.viewTile.base_index
    });
  } else if (tile.type === 'Editor' && tile.editorTile) {
    // Add editor-specific properties
    Object.assign(tileProps, {
      file_name: tile.editorTile.file_name,
      file_type: tile.editorTile.file_type,
      content: tile.editorTile.content
    });
  }
  
  return tileProps;
}

/**
 * Converts a TileProps object to Tile update objects
 * @param tileItem The TileProps object to convert
 * @param tileId The ID of the tile being updated
 * @returns An object containing updates for the tile and its type-specific properties
 */
export function convertTileItemToTile(tileItem: TileProps, tileId: string) {
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
    type: tileItem.tab as any,  // 'Table' | 'Plot' | 'View' | 'Editor'
    
    // Common fields shared across tile types
    moved: tileItem.moved,
    static: tileItem.static,
    context: tileItem.context,
    table: tileItem.table,
    auto_update: tileItem.auto_update,
    freeze: tileItem.freeze,
    filters: tileItem.filters,
    common_filter: tileItem.common_filter,
    metric: tileItem.metric,
  };
  
  // Handle type-specific properties based on the tile type
  let tableTileUpdates: Partial<TableTile> | null = null;
  let plotTileUpdates: Partial<PlotTile> | null = null;
  let viewTileUpdates: Partial<ViewTile> | null = null;
  let editorTileUpdates: Partial<EditorTile> | null = null;
  
  if (tileItem.tab === 'Table') {
    tableTileUpdates = {
      table_type: tileItem.table_type,
      column_context: tileItem.column_context,
      page_number: tileItem.page_number,
      column_order: tileItem.column_order,
      hidden_columns: tileItem.hidden_columns,
      sorting: tileItem.sorting,
      grouping: tileItem.grouping,
      group_sorting: tileItem.group_sorting,
      columns_pin_left: tileItem.columns_pin_left,
      columns_pin_right: tileItem.columns_pin_right,
      selected: tileItem.selected,
    };
    tileUpdates.tableTile = tableTileUpdates as TableTile;
  } else if (tileItem.tab === 'Plot') {
    plotTileUpdates = {
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
    tileUpdates.plotTile = plotTileUpdates as PlotTile;
  } else if (tileItem.tab === 'View') {
    // Apply view-specific updates
    // (Add view-specific updates here if needed)
    viewTileUpdates = {
      base_index: tileItem.base_index
    } as Partial<ViewTile>;
    tileUpdates.viewTile = viewTileUpdates as ViewTile;
  } else if (tileItem.tab === 'Editor') {
    editorTileUpdates = {
      file_name: tileItem.file_name,
      file_type: tileItem.file_type,
      content: tileItem.content
    } as Partial<EditorTile>;
    tileUpdates.editorTile = editorTileUpdates as EditorTile;
  }
  
  return tileUpdates as Tile;
} 