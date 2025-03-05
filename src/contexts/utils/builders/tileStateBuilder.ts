import { PlotTileData } from "@/contexts/slices/selectors/plotTile";
import { TableTileData } from "@/contexts/slices/selectors/tableTile";
import { Tile } from "@/contexts/slices/selectors/tile";
import { TableDataProps } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";

/**
 * Build initial state for a tile
 */
export function buildTileState(
  tileId: string,
  tileData: any = {},
  type: 'Table' | 'Plot' | 'View' = 'Table'
) {
  return {
    id: tileId,
    name: tileData.name || tileId,
    type: type,
    position: {
      x: tileData.x || 0,
      y: tileData.y || 0,
      width: tileData.w || (type === 'Table' ? 6 : 4),
      height: tileData.h || (type === 'Table' ? 4 : 2)
    },
    minW: tileData.minW || undefined,
    minH: tileData.minH || undefined,
    visible: tileData.visible !== false,
    locked: tileData.locked || false,
    pending: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as Tile;
}

/**
 * Build initial state for a table tile with table-specific data
 */
export function buildTableTileState(
  tileId: string,
  tileData: any = {},
  tableData: TableDataProps = {},
  tableArguments: TableArguments = {},
  limit: number = 10,
  offsets: number[],
  tileIndex: number = 0
) {
  const baseTile = buildTileState(tileId, tileData, 'Table');
  
  // Add table-specific data
  return {
    ...baseTile,
    tableData: {
      // Fields from TableDataItem
      id: tileId,
      title: tileData.name || tileId,
      // Additional fields for internal state
      limit: limit,
      offset: offsets[tileIndex],
      loading: false,
      error: null,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Table-specific fields from TileProps
      table: tileData.table || "",
      table_type: tileData.table_type || "",
      column_context: tileData.column_context || "",
      page_number: tileData.page_number || "",
      metric: tileData.metric || "",
      column_order: tileData.column_order || "",
      hidden_columns: tileData.hidden_columns || "",
      sorting: tileData.sorting || "",
      grouping: tileData.grouping || "",
      group_sorting: tileData.group_sorting || "",
      columns_pin_left: tileData.columns_pin_left || "",
      columns_pin_right: tileData.columns_pin_right || "",
      selected: tileData.selected || "",
      base_index: tileData.base_index || "",

      // Table-specific fields from TableDataItem
      tableDataItem: tableData[tileId] || {},

      // Table arguments
      tableArguments: tableArguments[tileIndex] || {},
    } as TableTileData,
  } as Tile;
}

/**
 * Build initial state for a plot tile with plot-specific data
 */
export function buildPlotTileState(
  tileId: string,
  tileData: any = {},
  plotData: any = {}
) {
  const baseTile = buildTileState(tileId, tileData, 'Plot');
  
  // Add plot-specific data
  return {
    ...baseTile,
    plotData: {
      id: tileId,
      title: tileData.name || tileId,
      plotType: tileData.plot_type || 'scatter',
      xAxis: tileData.x_axis || null,
      yAxis: tileData.y_axis || null,
      groupBy: tileData.plot_group_by || null,
      data: plotData[tileId]?.plotLogs || [],
      plotArguments: plotData[tileId]?.plotArguments || {},
      plotFields: plotData[tileId]?.plotFields || {},
      loading: false,
      error: null,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as PlotTileData,
  } as Tile;
}