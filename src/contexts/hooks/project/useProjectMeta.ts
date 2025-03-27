import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { ProjectMeta } from '../../slices/selectors/project';

/**
 * Interface for project-related meta actions
 */
export interface ProjectMetaActions {
  setName: (name: string) => void;
}

/**
 * Custom hook to access project metadata and related actions
 * @param projectName The name of the project to access
 * @returns Object containing project metadata, actions, and related IDs
 */
export function useProjectMeta(projectName: string | null) {
  // The project ID is the same as the name in this case
  const projectId = projectName;

  // Check if the project exists
  const projectExists = useStoreContext(state => {
    if (!projectId) return false;
    return !!state.projectsById[projectId];
  });

  // Granular subscriptions to Meta properties
  const id = useStoreContext(state => {
    if (!projectExists || !projectId) return null;
    return state.projectsById[projectId].id;
  });
  
  const name = useStoreContext(state => {
    if (!projectExists || !projectId) return null;
    return state.projectsById[projectId].name;
  });

  // Get store actions for meta updates
  const storeUpdateProject = useStoreContext(state => state.updateProject);

  // Memoize the metadata object to prevent unnecessary rerenders
  const meta = useMemo<Partial<ProjectMeta> | null>(() => {
    if (!projectExists) return null;
    
    return {
      id,
      name,
    };
  }, [projectExists, id, name]);

  // Memoize the meta actions to prevent unnecessary re-renders
  const metaActions = useMemo<ProjectMetaActions>(() => ({
    setName: (name) => {
      if (projectId) {
        storeUpdateProject(projectId, { name });
      }
    }
  }), [projectId, storeUpdateProject]);

  return {
    meta,
    metaActions,
    projectId,
    projectExists
  };
} 