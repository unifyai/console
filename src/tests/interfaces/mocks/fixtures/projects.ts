import type { Project } from '@/contexts/slices/selectors/project';
import type { Context } from '@/types/interfaces/grid';

export const mockContexts: Context[] = [
  {
    name: 'default',
    description: 'Default project context for Interfaces tests',
  },
];

export const mockProjectId = 'project-1';

export const mockProject: Project = {
  id: mockProjectId,
  name: 'Test Project',
  description: 'Mock project for Interfaces tests',
  contexts: mockContexts,
  interfaceIds: ['interface-1'],
  activeInterfaceId: 'interface-1',
};
