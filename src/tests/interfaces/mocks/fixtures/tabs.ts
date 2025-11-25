import type { Tab } from '@/contexts/slices/selectors/tab';
import { mockInterfaceId } from './interfaces';

export const mockTabId = 'tab-1';

export const mockTab: Tab = {
  id: mockTabId,
  name: 'Tab 1',
  // Meta
  visible: true,
  active: true,
  order: 0,
  // Data
  globalContext: undefined,
  tileIds: ['tile-1'],
  tileNames: ['Logs'],
  itemsNeedRecompute: false,
  // UI
  interfaceId: mockInterfaceId,
  focusedTileNames: [undefined, undefined],
  saveSuccess: undefined,
  resetting: false,
  edit: true,
  interactive: true,
  help: true,
  copied: undefined,
  deleting: false,
  refreshing: false,
  color: undefined,
  hoveredLog: undefined,
  editTile: undefined,
  dataPending: false,
  pending: false,
};


