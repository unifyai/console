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
  auto_update: 'true',
  freeze: null,
  filters: null,
  common_filter: null,
  metric: null,
  column_context: null,
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
    table_type: undefined,
    limit: 20,
    offset: 0,
    group_limit: 20,
    group_offset: 0,
    page_number: undefined,
    column_order: undefined,
    hidden_columns: undefined,
    default_hidden_columns: false,
    sorting: undefined,
    group_sorting: undefined,
    columns_pin_left: undefined,
    columns_pin_right: undefined,
    selected: undefined,
    infiniteQueryKeys: [],
  },
  plotTile: null,
  viewTile: null,
  editorTile: null,
  terminalTile: null,
};


