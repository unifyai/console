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
 * @param projectIdOrName The ID or name of the project to access
 * @returns Object containing project metadata, actions, and related IDs
 */
export function useProjectMeta(projectIdOrName: string | null) {
  // First, try to directly find the project by ID
  const projectInStoreById = useStoreContext(state => {
    if (!projectIdOrName) return null;
    return state.projectsById[projectIdOrName] || null;
  });

  // If not found by ID, try to find it by name
  const projectInStoreByName = useStoreContext(state => {
    if (!projectIdOrName || projectInStoreById) return null;
    
    // Find project by name - this is a more expensive operation
    return Object.values(state.projectsById).find(
      project => project.name === projectIdOrName
    ) || null;
  });

  // Determine the project ID based on the lookup results
  const projectId = useMemo(() => {
    if (!projectIdOrName) return null;
    if (projectInStoreById) return projectIdOrName;
    return projectInStoreByName?.id || null;
  }, [projectIdOrName, projectInStoreById, projectInStoreByName]);

  // Check if the project exists
  const projectExists = !!projectId && !!(projectInStoreById || projectInStoreByName);

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