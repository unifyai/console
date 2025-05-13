import { Tile, TileMeta, TileData as TileSliceData, TileUI } from '@/contexts/slices/selectors/tile';
import { TableTile, TableTileData as TableTileSliceData } from '@/contexts/slices/selectors/tableTile';
import { PlotTile, PlotTileData as PlotTileSliceData } from '@/contexts/slices/selectors/plotTile';
import { ViewTile, ViewTileMeta, ViewTileData as ViewTileSliceData, ViewTileUI } from '@/contexts/slices/selectors/viewTile';
import { EditorTile, EditorTileData as EditorTileSliceData } from '@/contexts/slices/selectors/editorTile';
import { TileData, TableTileData, PlotTileData, ViewTileData, EditorTileData } from '@/types/evals/grid';

/**
 * Build tile state from API-returned tile data
 */
export function buildTileState(tileData: TileData): Tile {
  if (!tileData || !tileData.id) {
    throw new Error("Invalid tile data provided");
  }

  // Build tile meta
  const tileMeta: TileMeta = {
    id: tileData.id,
    name: tileData.name,
    type: tileData.type,
    position: tileData.position,
    minW: tileData.minW,
    minH: tileData.minH,
  };

  // Build tile data
  const tileSliceData: TileSliceData = {
    context: tileData.context,
    table: tileData.table,
    auto_update: tileData.auto_update,
    freeze: tileData.freeze,
    filters: tileData.filters,
    common_filter: tileData.common_filter,
    metric: tileData.metric,
    column_context: tileData.column_context,
    grouping: tileData.grouping,
  };

  // Build tile UI state
  const tileUI: TileUI = {
    tabId: tileData.tab_id || null,
    visible: tileData.visible,
    locked: tileData.locked || false,
    pending: false,
    loading: false,
    error: null,
    moved: false, // API doesn't track this UI state
    static: false, // API doesn't track this UI state
    color: undefined, // Might be derived from parent tab
    itemsNeedRecompute: false,
  };

  // Create initial tile with null specialized tile data
  const tile: Tile = {
    ...tileMeta,
    ...tileSliceData,
    ...tileUI,
    tableTile: null,
    plotTile: null,
    viewTile: null,
    editorTile: null,
  };

  // Add specialized tile data based on type
  return addSpecializedTileData(tile, tileData);
}

/**
 * Add specialized tile data based on tile type
 */
function addSpecializedTileData(
  tile: Tile, 
  tileData: TileData,
): Tile {
  switch(tileData.type) {
    case 'Table':
      if (tileData.table_tile) {
        const tableTileData = buildTableTileData(tileData.table_tile);
        tile.tableTile = tableTileData;
      }
      break;
    case 'Plot':
      if (tileData.plot_tile) {
        const plotTileData = buildPlotTileData(tileData.plot_tile);
        tile.plotTile = plotTileData;
      }
      break;
    case 'View':
      if (tileData.view_tile) {
        tile.viewTile = buildViewTileData(tileData.view_tile);
      }
      break;
    case 'Editor':
      if (tileData.editor_tile) {
        tile.editorTile = buildEditorTileData(tileData.editor_tile);
      }
      break;
  }
  
  return tile;
}

/**
 * Build TableTile data from API-returned TableTileData
 */
function buildTableTileData(tableTileData: TableTileData): TableTile {
  return {
    table_type: tableTileData.table_type,
    page_number: tableTileData.page_number,
    column_order: tableTileData.column_order,
    hidden_columns: tableTileData.hidden_columns,
    sorting: tableTileData.sorting,
    group_sorting: tableTileData.group_sorting,
    columns_pin_left: tableTileData.columns_pin_left,
    columns_pin_right: tableTileData.columns_pin_right,
    selected: tableTileData.selected,
  };
}

/**
 * Build PlotTile data from API-returned PlotTileData
 */
function buildPlotTileData(plotTileData: PlotTileData): PlotTile {
  return {
    plot_type: plotTileData.plot_type,
    plot_scale_x: plotTileData.plot_scale_x,
    plot_scale_y: plotTileData.plot_scale_y,
    plot_aggregate: plotTileData.plot_aggregate,
    x_axis: plotTileData.x_axis,
    y_axis: plotTileData.y_axis,
    plot_group_by: plotTileData.plot_group_by,
    bin_count: plotTileData.bin_count,
    regression_line: plotTileData.regression_line,
  };
}

/**
 * Build ViewTile data from API-returned ViewTileData
 */
function buildViewTileData(viewTileData: ViewTileData): ViewTile {
  return {
    base_index: viewTileData.base_index,
  };
}

/**
 * Build EditorTile data from API-returned EditorTileData
 */
function buildEditorTileData(editorTileData: EditorTileData): EditorTile {
  return {
    file_name: editorTileData.file_path,
    file_type: editorTileData.file_type,
    content: editorTileData.content,
  };
}

/**
 * Update a tile with parent references
 */
export function updateTileParentReferences(
  tileState: Tile,
  tabId: string | null
): Tile {
  return {
    ...tileState,
    tabId,
  };
}
