import type { Interface } from '@/contexts/slices/selectors/interface';
import { mockProjectId } from './projects';

export const mockInterfaceId = 'interface-1';

export const mockInterface: Interface & { updatedAt?: string } = {
  id: mockInterfaceId,
  name: 'Main Interface',
  projectId: mockProjectId,
  tabIds: ['tab-1'],
  tabNames: ['Tab 1'],
  activeTabId: 'tab-1',
  pending: false,
  updatedAt: new Date().toISOString(),
};


