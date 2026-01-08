import { Tile } from '../../slices/selectors/tile';
import { TableTile } from '../../slices/selectors/tableTile';
import { PlotTile } from '../../slices/selectors/plotTile';
import { ViewTile } from '../../slices/selectors/viewTile';
import { EditorTile } from '../../slices/selectors/editorTile';
import { TerminalTile } from '../../slices/selectors/terminalTile';
import { TileProps } from '@/types/interfaces/grid';
import { constructHierarchicalId, getParentId } from '@/contexts/utils/sliceUtils';

/**
 * Converts a Tile object to a TileProps object for grid layout
 * @param tile The tile object to convert
 * @returns A TileProps object representing the tile
 */
export function convertTileToTileItem(tile: Partial<Tile>): TileProps {
  // Create a base TileProps object with common properties
  const tileProps: TileProps = {
    id: tile.id || '',
    name: tile.name || '',
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
    columnContext: tile.columnContext || undefined,
    grouping: tile.grouping || undefined,
    color: tile.color || undefined,
    table: tile.table || undefined,
    autoUpdate: tile.autoUpdate || undefined,
    freeze: tile.freeze || undefined,
    filters: tile.filters || undefined,
    commonFilter: tile.commonFilter || undefined,
    metric: tile.metric || undefined,
  };
  
  // Add type-specific properties based on the tile type
  if (tile.type === 'Table' && tile.tableTile) {
    // Add table-specific properties
    Object.assign(tileProps, {
      tableType: tile.tableTile.tableType,
      pageNumber: tile.tableTile.pageNumber,
      columnOrder: tile.tableTile.columnOrder,
      hiddenColumns: tile.tableTile.hiddenColumns,
      defaultHiddenColumns: tile.tableTile.defaultHiddenColumns,
      sorting: tile.tableTile.sorting,
      groupSorting: tile.tableTile.groupSorting,
      columnsPinLeft: tile.tableTile.columnsPinLeft,
      columnsPinRight: tile.tableTile.columnsPinRight,
      selected: tile.tableTile.selected,
    });
  } else if (tile.type === 'Plot' && tile.plotTile) {
    // Add plot-specific properties
    Object.assign(tileProps, {
      plotType: tile.plotTile.plotType,
      plotScaleX: tile.plotTile.plotScaleX,
      plotScaleY: tile.plotTile.plotScaleY,
      plotAggregate: tile.plotTile.plotAggregate,
      xAxis: tile.plotTile.xAxis,
      yAxis: tile.plotTile.yAxis,
      plotGroupBy: tile.plotTile.plotGroupBy,
      plotGroupByColors: tile.plotTile.plotGroupByColors,
      binCount: tile.plotTile.binCount,
      regressionLine: tile.plotTile.regressionLine
    });
  } else if (tile.type === 'View' && tile.viewTile) {
    // Add view-specific properties
    // (Add view-specific fields here if needed)
    Object.assign(tileProps, {
      baseIndex: tile.viewTile.baseIndex
    });
  } else if (tile.type === 'Editor' && tile.editorTile) {
    // Add editor-specific properties
    Object.assign(tileProps, {
      fileName: tile.editorTile.fileName,
      fileType: tile.editorTile.fileType,
      content: tile.editorTile.content
    });
  } else if (tile.type === 'Terminal' && tile.terminalTile) {
    // Add terminal-specific properties
    Object.assign(tileProps, {
      shellType: tile.terminalTile.shellType
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
  const hierarchicalTileId = tileItem.name.includes('>') 
    ? tileItem.name
    : constructHierarchicalId(tileItem.name, [getParentId(tileId)]);

  // Create core Tile properties from base TileProps
  const tileUpdates: Partial<Tile> = {
    id: hierarchicalTileId,
    name: tileItem.name,
    position: {
      x: tileItem.x,
      y: tileItem.y,
      width: tileItem.w,
      height: tileItem.h
    },
    minW: tileItem.minW,
    minH: tileItem.minH,
    visible: tileItem.visible,
    type: tileItem.tab as any,  // 'Table' | 'Plot' | 'View' | 'Editor' | 'Terminal'
    
    // Common fields shared across tile types
    moved: tileItem.moved,
    static: tileItem.static,
    color: tileItem.color,
    context: tileItem.context,
    columnContext: tileItem.columnContext,
    grouping: tileItem.grouping,
    table: tileItem.table,
    autoUpdate: tileItem.autoUpdate,
    freeze: tileItem.freeze,
    filters: tileItem.filters,
    commonFilter: tileItem.commonFilter,
    metric: tileItem.metric,
  };
  
  // Handle type-specific properties based on the tile type
  let tableTileUpdates: Partial<TableTile> | null = null;
  let plotTileUpdates: Partial<PlotTile> | null = null;
  let viewTileUpdates: Partial<ViewTile> | null = null;
  let editorTileUpdates: Partial<EditorTile> | null = null;
  let terminalTileUpdates: Partial<TerminalTile> | null = null;

  if (tileItem.tab === 'Table') {
    tableTileUpdates = {
      tableType: tileItem.tableType,
      pageNumber: tileItem.pageNumber,
      columnOrder: tileItem.columnOrder,
      hiddenColumns: tileItem.hiddenColumns,
      defaultHiddenColumns: tileItem.defaultHiddenColumns,
      sorting: tileItem.sorting,
      groupSorting: tileItem.groupSorting,
      columnsPinLeft: tileItem.columnsPinLeft,
      columnsPinRight: tileItem.columnsPinRight,
      selected: tileItem.selected,
    };
    tileUpdates.tableTile = tableTileUpdates as TableTile;
  } else if (tileItem.tab === 'Plot') {
    plotTileUpdates = {
      plotType: tileItem.plotType,
      plotScaleX: tileItem.plotScaleX,
      plotScaleY: tileItem.plotScaleY,
      plotAggregate: tileItem.plotAggregate,
      xAxis: tileItem.xAxis,
      yAxis: tileItem.yAxis,
      plotGroupBy: tileItem.plotGroupBy,
      plotGroupByColors: tileItem.plotGroupByColors,
      binCount: tileItem.binCount,
      regressionLine: tileItem.regressionLine
    };
    tileUpdates.plotTile = plotTileUpdates as PlotTile;
  } else if (tileItem.tab === 'View') {
    // Apply view-specific updates
    // (Add view-specific updates here if needed)
    viewTileUpdates = {
      baseIndex: tileItem.baseIndex
    } as Partial<ViewTile>;
    tileUpdates.viewTile = viewTileUpdates as ViewTile;
  } else if (tileItem.tab === 'Editor') {
    editorTileUpdates = {
      fileName: tileItem.fileName,
      fileType: tileItem.fileType,
      content: tileItem.content
    } as Partial<EditorTile>;
    tileUpdates.editorTile = editorTileUpdates as EditorTile;
  } else if (tileItem.tab === 'Terminal') {
    terminalTileUpdates = {
      shellType: tileItem.shellType
    } as Partial<TerminalTile>;
    tileUpdates.terminalTile = terminalTileUpdates as TerminalTile;
  }
  
  return tileUpdates as Tile;
} 