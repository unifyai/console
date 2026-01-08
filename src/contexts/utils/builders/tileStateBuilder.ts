import {
  Tile,
  TileMeta,
  TileData as TileSliceData,
  TileUI,
} from '@/contexts/slices/selectors/tile';
import {
  TableTile,
  TableTileData as TableTileSliceData,
} from '@/contexts/slices/selectors/tableTile';
import { PlotTile, PlotTileData as PlotTileSliceData } from '@/contexts/slices/selectors/plotTile';
import {
  ViewTile,
  ViewTileMeta,
  ViewTileData as ViewTileSliceData,
  ViewTileUI,
} from '@/contexts/slices/selectors/viewTile';
import {
  EditorTile,
  EditorTileData as EditorTileSliceData,
} from '@/contexts/slices/selectors/editorTile';
import {
  TerminalTile,
  TerminalTileData as TerminalTileSliceData,
} from '@/contexts/slices/selectors/terminalTile';
import {
  TileData,
  TableTileData,
  PlotTileData,
  ViewTileData,
  EditorTileData,
  TerminalTileData,
} from '@/types/interfaces/grid';

/**
 * Build tile state from API-returned tile data
 */
export function buildTileState(tileData: TileData): Tile {
  if (!tileData || !tileData.id) {
    throw new Error('Invalid tile data provided');
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
    autoUpdate: tileData.autoUpdate,
    freeze: tileData.freeze,
    filters: tileData.filters,
    commonFilter: tileData.commonFilter,
    metric: tileData.metric,
    columnContext: tileData.columnContext,
    grouping: tileData.grouping,
  };

  // Build tile UI state
  const tileUI: TileUI = {
    tabId: tileData.tabId || null,
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
    terminalTile: null,
  };

  // Add specialized tile data based on type
  return addSpecializedTileData(tile, tileData);
}

/**
 * Add specialized tile data based on tile type
 */
function addSpecializedTileData(tile: Tile, tileData: TileData): Tile {
  switch (tileData.type) {
    case 'Table':
      if (tileData.tableTile) {
        const tableTileData = buildTableTileData(tileData.tableTile);
        tile.tableTile = tableTileData;
      }
      break;
    case 'Plot':
      if (tileData.plotTile) {
        const plotTileData = buildPlotTileData(tileData.plotTile);
        tile.plotTile = plotTileData;
      }
      break;
    case 'View':
      if (tileData.viewTile) {
        tile.viewTile = buildViewTileData(tileData.viewTile);
      }
      break;
    case 'Editor':
      if (tileData.editorTile) {
        tile.editorTile = buildEditorTileData(tileData.editorTile);
      }
      break;
    case 'Terminal':
      if (tileData.terminalTile) {
        tile.terminalTile = buildTerminalTileData(tileData.terminalTile);
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
    tableType: tableTileData.tableType,
    pageNumber: tableTileData.pageNumber,
    limit: 20, // Hardcoded for now
    offset: tableTileData.pageNumber ? parseInt(tableTileData.pageNumber) * 20 : 0, // Hardcoded for now
    groupLimit: tableTileData.groupLimit ?? 20,
    groupOffset: tableTileData.groupOffset ?? 0,
    columnOrder: tableTileData.columnOrder,
    hiddenColumns: tableTileData.hiddenColumns,
    defaultHiddenColumns: tableTileData.defaultHiddenColumns,
    sorting: tableTileData.sorting,
    groupSorting: tableTileData.groupSorting,
    columnsPinLeft: tableTileData.columnsPinLeft,
    columnsPinRight: tableTileData.columnsPinRight,
    selected: tableTileData.selected,
  };
}

/**
 * Build PlotTile data from API-returned PlotTileData
 */
function buildPlotTileData(plotTileData: PlotTileData): PlotTile {
  return {
    plotType: plotTileData.plotType,
    plotScaleX: plotTileData.plotScaleX,
    plotScaleY: plotTileData.plotScaleY,
    plotAggregate: plotTileData.plotAggregate,
    xAxis: plotTileData.xAxis,
    yAxis: plotTileData.yAxis,
    plotGroupBy: plotTileData.plotGroupBy,
    plotGroupByColors: plotTileData.plotGroupByColors,
    binCount: plotTileData.binCount,
    regressionLine: plotTileData.regressionLine,
  };
}

/**
 * Build ViewTile data from API-returned ViewTileData
 */
function buildViewTileData(viewTileData: ViewTileData): ViewTile {
  return {
    baseIndex: viewTileData.baseIndex,
  };
}

/**
 * Build EditorTile data from API-returned EditorTileData
 */
function buildEditorTileData(editorTileData: EditorTileData): EditorTile {
  return {
    fileName: editorTileData.fileName,
    fileType: editorTileData.fileType,
    content: editorTileData.content,
  };
}

/**
 * Build TerminalTile data from API-returned TerminalTileData
 */
function buildTerminalTileData(terminalTileData: TerminalTileData): TerminalTile {
  return {
    shellType: terminalTileData.shellType,
  };
}

/**
 * Update a tile with parent references
 */
export function updateTileParentReferences(tileState: Tile, tabId: string | null): Tile {
  return {
    ...tileState,
    tabId,
  };
}
