import { Tile, TileMeta, TileData, TileUI } from '@/contexts/slices/selectors/tile';
import { TableTile, TableTileData, TableTileMeta, TableTileUI } from '@/contexts/slices/selectors/tableTile';
import { PlotTile, PlotTileData, PlotTileMeta, PlotTileUI } from '@/contexts/slices/selectors/plotTile';
import { ViewTile, ViewTileMeta, ViewTileData, ViewTileUI } from '@/contexts/slices/selectors/viewTile';
import { PlotDataProps, TableDataProps, TileProps } from '@/types/evals/grid';
import { EditorTile, EditorTileData, EditorTileMeta, EditorTileUI } from '@/contexts/slices/selectors/editorTile';

/**
 * Build a generic tile state object
 */
export function buildTileState(
  tabId: string | null = null,
  interfaceId: string | null = null,
  projectId: string | null = null,
  tileProps: TileProps,
  type: "Table" | "Plot" | "View" | "Editor" | null = "Table",
): Tile {
  // Generate the hierarchical tile ID
  const tileId = `${tabId}>${tileProps.i}`;
  
  // Build tile meta
  const tileMeta: TileMeta = {
    id: tileId,
    name: tileProps.i,
    type: type,
    position: {
      x: tileProps.x,
      y: tileProps.y,
      width: tileProps.w,
      height: tileProps.h
    },
    minW: tileProps.minW,
    minH: tileProps.minH,
    // createdAt: new Date().toISOString(),
    // updatedAt: new Date().toISOString(),
  };

  // Build tile data
  const tileData: TileData = {
    context: tileProps.context,
    table: tileProps.table,
    auto_update: tileProps.auto_update,
    freeze: tileProps.freeze,
    filters: tileProps.filters,
    common_filter: tileProps.common_filter,
    metric: tileProps.metric,
  };

  // Build tile UI state
  const tileUI: TileUI = {
    projectId,
    interfaceId,
    tabId,
    visible: tileProps.visible,
    locked: false,
    pending: false,
    loading: false,
    error: null,
    moved: tileProps.moved,
    static: tileProps.static,
    color: tileProps.color,
    itemsNeedRecompute: false,
  };

  // Create base tile
  const tile: Tile = {
    ...tileMeta,
    ...tileData,
    ...tileUI,
    tableTile: null,
    plotTile: null,
    viewTile: null,
    editorTile: null,
  };

  return tile;
}

/**
 * Build table tile state
 */
export function buildTableTileState(
  tabId: string | null = null,
  interfaceId: string | null = null,
  projectId: string | null = null,
  tileProps: TileProps,
  tableData: TableDataProps = {},
  limit: number = 10,
  offsets: number[],
  tileIndex: number = 0,
): Tile {
  // Create the base tile
  const tile = buildTileState(tabId, interfaceId, projectId, tileProps, "Table");
  
  // Build table tile meta
  const tableTileMeta: TableTileMeta = {
  };

  // Build table tile data
  const tableTileData: TableTileData = {
    table_type: tileProps.table_type,
    column_order: tileProps.column_order,
    hidden_columns: tileProps.hidden_columns,
    sorting: tileProps.sorting,
    grouping: tileProps.grouping,
    group_sorting: tileProps.group_sorting,
    columns_pin_left: tileProps.columns_pin_left,
    columns_pin_right: tileProps.columns_pin_right,
    selected: tileProps.selected,
    tableDataItem: tableData[tileProps.i],
  };

  // Build table tile UI
  const tableTileUI: TableTileUI = {
    limit: limit,
    offset: offsets[tileIndex],
    column_context: tileProps.column_context,
    page_number: tileProps.page_number,
  };

  // Build the complete table tile
  const tableTile: TableTile = {
    ...tableTileMeta,
    ...tableTileData,
    ...tableTileUI,
  };
  
  // Build the complete tile with table-specific data
  return {
    ...tile,
    tableTile,
  };
}

/**
 * Build plot tile state
 */
export function buildPlotTileState(
  tabId: string | null = null,
  interfaceId: string | null = null,
  projectId: string | null = null,
  tileProps: TileProps,
  plotData: PlotDataProps = {},
): Tile {
  // Create the base tile
  const tile = buildTileState(tabId, interfaceId, projectId, tileProps, "Plot");

  // Build plot tile meta
  const plotTileMeta: PlotTileMeta = {
  };

  // Build plot tile data
  const plotTileData: PlotTileData = {
    plot_type: tileProps.plot_type,
    plot_scale_x: tileProps.plot_scale_x,
    plot_scale_y: tileProps.plot_scale_y,
    plot_aggregate: tileProps.plot_aggregate,
    x_axis: tileProps.x_axis,
    y_axis: tileProps.y_axis,
    plot_group_by: tileProps.plot_group_by,
    bin_count: tileProps.bin_count,
    regression_line: tileProps.regression_line,
    plotDataItem: plotData[tileProps.i],
  };
  
  // Build plot tile UI
  const plotTileUI: PlotTileUI = {
    plot_group_by_colors: tileProps.plot_group_by_colors,
  };

  // Build the complete plot tile
  const plotTile: PlotTile = {
    ...plotTileMeta,
    ...plotTileData,
    ...plotTileUI,
  };
  
  // Return the complete tile with plot-specific data
  return {
    ...tile,
    plotTile,
  };
}

/**
 * Build view tile state
 */
export function buildViewTileState(
  tabId: string | null = null,
  interfaceId: string | null = null,
  projectId: string | null = null,
  tileProps: TileProps,
): Tile {
  // Create the base tile
  const tile = buildTileState(tabId, interfaceId, projectId, tileProps, "View");
  
  // Build view tile meta
  const viewTileMeta: ViewTileMeta = {
  };

  // Build view tile data
  const viewTileData: ViewTileData = {
    base_index: tileProps.base_index,
  };

  // Build view tile UI
  const viewTileUI: ViewTileUI = {
  };

  // Build the complete view tile
  const viewTile: ViewTile = {
    ...viewTileMeta,
    ...viewTileData,
    ...viewTileUI,
  };
  
  // Return the complete tile with view-specific data
  return {
    ...tile,
    viewTile,
  };
}

/**
 * Build editor tile state
 */
export function buildEditorTileState(
  tabId: string | null = null,
  interfaceId: string | null = null,
  projectId: string | null = null,
  tileProps: TileProps,
): Tile {
  // Create the base tile
  const tile = buildTileState(tabId, interfaceId, projectId, tileProps, "Editor");
  
  // Build editor tile meta
  const editorTileMeta: EditorTileMeta = {
  };

  // Build editor tile data
  const editorTileData: EditorTileData = {
    file_name: tileProps.file_name,
    file_type: tileProps.file_type,
    content: tileProps.content,
  };

  // Build editor tile UI
  const editorTileUI: EditorTileUI = {
  };

  // Build the complete editor tile
  const editorTile: EditorTile = {
    ...editorTileMeta,
    ...editorTileData,
    ...editorTileUI,
  };
  
  // Return the complete tile with editor-specific data
  return {
    ...tile,
    editorTile,
  };
}
