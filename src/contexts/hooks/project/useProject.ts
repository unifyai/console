import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { useProjectMeta } from './useProjectMeta';
import { useProjectData } from './useProjectData';
import { useProjectUI } from './useProjectUI';
import { Project } from '@/contexts/slices/selectors/project';

/**
 * Default return value when no project is specified
 */
export const DEFAULT_USE_PROJECT_RETURN = {
  project: {
    id: null,
    name: null,
    description: null,
    activeInterfaceId: null,
    interfaceIds: [],
    contexts: [],
  },
  meta: {
    id: null,
    name: null,
  },
  data: {
    description: null,
    interfaceIds: [],
    contexts: [],
  },
  ui: {
    activeInterfaceId: null,
  },
  operations: {},
  exists: false,
  projectId: null,
};

/**
 * Interface for all project-related actions
 */
export interface ProjectActions {
  // Basic project management
  initProject: (initialState?: Partial<Project>) => void;
  updateProject: (updates: Partial<Project>) => void;
  removeProject: () => void;

  // Helper methods
  getInterfaceIds: () => string[];
}

/**
 * Custom hook to access and manage project state
 * @param projectIdOrName The ID or name of the project to access
 * @returns Object containing project state and actions
 */
export function useProject(projectIdOrName: string | null) {
  // Use specialized hooks
  const { meta, metaActions, projectId, projectExists } = useProjectMeta(projectIdOrName);

  const { data, dataActions, interfaceIds } = useProjectData(projectIdOrName);

  const { ui, uiActions, activeInterfaceId } = useProjectUI(projectIdOrName);

  // const {
  //   operations,
  //   operationsActions
  // } = useProjectOperations(projectName);

  // Get store actions
  const storeInitProject = useStoreContext((state) => state.initProject);
  const storeUpdateProject = useStoreContext((state) => state.updateProject);
  const storeRemoveProject = useStoreContext((state) => state.removeProject);

  // Memoize all actions to prevent unnecessary re-renders
  const actions = useMemo<ProjectActions>(() => {
    return {
      // Basic project management
      initProject: (initialState) => {
        if (projectId) {
          storeInitProject(projectId, initialState);
        }
      },

      updateProject: (updates) => {
        if (projectId) {
          storeUpdateProject(projectId, updates);
        }
      },

      removeProject: () => {
        if (projectId) {
          storeRemoveProject(projectId);
        }
      },

      // Categorized actions
      meta: metaActions,
      data: dataActions,
      ui: uiActions,

      // Helper methods
      getInterfaceIds: () => {
        return interfaceIds;
      },
    };
  }, [
    projectId,
    interfaceIds,
    storeInitProject,
    storeUpdateProject,
    storeRemoveProject,
    metaActions,
    dataActions,
    uiActions,
  ]);

  // Build a final 'project' object from the separate meta, data, and UI objects
  const projectObj = useMemo<Partial<Project> | null>(() => {
    if (!meta || !data || !ui) return null;

    return {
      ...meta,
      ...data,
      ...ui,
    };
  }, [meta, data, ui]);

  // Use projectId to conditionally return values, but only after all hooks are called
  if (projectIdOrName === null) {
    return DEFAULT_USE_PROJECT_RETURN;
  }

  return {
    project: projectObj,
    meta,
    data,
    ui,
    metaActions,
    dataActions,
    uiActions,
    actions,
    // operationsActions,
    exists: projectExists,
    projectId,
  };
}
