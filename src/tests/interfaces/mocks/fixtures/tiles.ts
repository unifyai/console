import type { Tile } from '@/contexts/slices/selectors/tile';
import { mockTabId } from './tabs';

export const mockTileId = 'tile-1';

export const mockTile: Tile = {
  // Meta
  id: mockTileId,
  name: 'Logs',
  type: 'Table',
  position: { x: 0, y: 0, width: 8, height: 8 },
  minW: null,
  minH: null,

  // Data
  context: 'default',
  table: 'logs',
  autoUpdate: 'true',
  freeze: null,
  filters: null,
  commonFilter: null,
  metric: null,
  columnContext: null,
  grouping: null,

  // UI
  tabId: mockTabId,
  visible: true,
  locked: false,
  pending: false,
  loading: false,
  error: null,
  moved: false,
  static: false,
  color: undefined,
  itemsNeedRecompute: false,

  // Type-specific data
  tableTile: {
    tableType: undefined,
    limit: 20,
    offset: 0,
    groupLimit: 20,
    groupOffset: 0,
    pageNumber: undefined,
    columnOrder: undefined,
    hiddenColumns: undefined,
    defaultHiddenColumns: false,
    sorting: undefined,
    groupSorting: undefined,
    columnsPinLeft: undefined,
    columnsPinRight: undefined,
    selected: undefined,
    infiniteQueryKeys: [],
  },
  plotTile: null,
  viewTile: null,
  editorTile: null,
  terminalTile: null,
};


