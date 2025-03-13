import { PlotTileData } from "@/contexts/slices/selectors/plotTile";
import { TableTileData } from "@/contexts/slices/selectors/tableTile";
import { ViewTileData } from "@/contexts/slices/selectors/viewTile";
import { Tile } from "@/contexts/slices/selectors/tile";
import { PlotDataProps, TableDataProps, TileProps } from "@/types/evals/grid";

/**
 * Build initial state for a tile
 */
export function buildTileState(
  tileProps: TileProps,
  type: "Table" | "Plot" | "View" = "Table",
) {
  return {
    id: tileProps.i,
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
    visible: tileProps.visible,
    locked: false,
    pending: false,
    loading: false,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    moved: tileProps.moved,
    static: tileProps.static,

    context: tileProps.context,
    table: tileProps.table,
    auto_update: tileProps.auto_update,
    freeze: tileProps.freeze,
    filters: tileProps.filters,
    common_filter: tileProps.common_filter,
  } as Tile;
}

/**
 * Build initial state for a table tile with table-specific data
 */
export function buildTableTileState(
  tileProps: TileProps,
  tableData: TableDataProps = {},
  limit: number = 10,
  offsets: number[],
  tileIndex: number = 0,
) {
  const baseTile = buildTileState(tileProps, 'Table');
  
  // Add table-specific data
  return {
    ...baseTile,
    tableData: {
      // Additional fields for internal state
      limit: limit,
      offset: offsets[tileIndex],
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Table-specific fields from TileProps
      table_type: tileProps.table_type,
      column_context: tileProps.column_context,
      page_number: tileProps.page_number,
      metric: tileProps.metric,
      column_order: tileProps.column_order,
      hidden_columns: tileProps.hidden_columns,
      sorting: tileProps.sorting,
      grouping: tileProps.grouping,
      group_sorting: tileProps.group_sorting,
      columns_pin_left: tileProps.columns_pin_left,
      columns_pin_right: tileProps.columns_pin_right,
      selected: tileProps.selected,
      base_index: tileProps.base_index,

      // Table-specific fields from TableDataItem
      tableDataItem: tableData[tileProps.i] || {},

    } as TableTileData,
  } as Tile;
}

/**
 * Build initial state for a plot tile with plot-specific data
 */
export function buildPlotTileState(
  tileProps: TileProps,
  plotData: PlotDataProps,
) {
  const baseTile = buildTileState(tileProps, 'Plot');
  
  // Add plot-specific data
  return {
    ...baseTile,
    plotData: {
      plotType: tileProps.plot_type,
      xAxis: tileProps.x_axis,
      yAxis: tileProps.y_axis,
      groupBy: tileProps.plot_group_by,
      data: plotData[tileProps.i]?.plotLogs,
      plotArguments: plotData[tileProps.i]?.plotArguments,
      plotFields: plotData[tileProps.i]?.plotFields,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as PlotTileData,
  } as Tile;
}

/**
 * Build initial state for a view tile with view-specific data
 */
export function buildViewTileState(
  tileProps: TileProps,
) {
  const baseTile = buildTileState(tileProps, 'View');
  
  // Add table-specific data
  return {
    ...baseTile,
    viewData: {
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as ViewTileData,
  } as Tile;
}