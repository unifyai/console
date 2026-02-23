import { Project, ProjectMeta, ProjectData, ProjectUI } from '@/contexts/slices/selectors/project';
import { Context } from '@/types/interfaces/grid';

/**
 * Build project state from project data
 */
export function buildProjectState(
  projectId: string | null,
  projectName: string | null,
  contexts: Context[],
  interfaceIds: string[] = []
): Project | null {
  if (!projectId) {
    return null;
  }

  // Create project meta
  const projectMeta: ProjectMeta = {
    id: projectId,
    name: projectName,
  };

  // Create project data
  const projectData: ProjectData = {
    description: '',
    contexts: contexts || [],
    interfaceIds: interfaceIds,
  };

  // Create project UI
  const projectUI: ProjectUI = {
    activeInterfaceId: interfaceIds[0] || null,
  };

  // Create the complete project
  const project: Project = {
    ...projectMeta,
    ...projectData,
    ...projectUI,
  };

  return project;
}
