import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { ProjectUI } from '../../slices/selectors/project';
import { useProjectMeta } from './useProjectMeta';

/**
 * Interface for project-related UI actions
 */
export interface ProjectUIActions {
  setActiveInterfaceId: (interfaceId: string | null) => void;
}

/**
 * Custom hook to access project UI state and actions
 * @param projectIdOrName The ID or name of the project to access
 * @returns Object containing project UI state and actions
 */
export function useProjectUI(projectIdOrName: string | null) {
  // Use the meta hook to get common project info
  const { 
    projectId, 
    projectExists 
  } = useProjectMeta(projectIdOrName);

  // Granular subscriptions to UI properties
  const activeInterfaceId = useStoreContext(state => {
    if (!projectExists || !projectId) return null;
    return state.projectsById[projectId].activeInterfaceId;
  });

  // Get store actions for UI state management
  const storeUpdateProject = useStoreContext(state => state.updateProject);
  const storeSetActiveInterface = useStoreContext(state => state.setActiveInterface);

  // Memoize the UI state object to prevent unnecessary rerenders
  const ui = useMemo<Partial<ProjectUI> | null>(() => {
    if (!projectExists) return null;
    
    return {
      activeInterfaceId
    };
  }, [projectExists, activeInterfaceId]);

  // Memoize the UI actions to prevent unnecessary re-renders
  const uiActions = useMemo<ProjectUIActions>(() => ({
    setActiveInterfaceId: (interfaceName) => {
      if (projectId) {
        // Check if the interface ID is already hierarchical
        const interfaceId = interfaceName && !interfaceName.includes('>')
          ? `${projectId}>${interfaceName}`
          : interfaceName;
        
        // Set the active interface at the global level
        if (interfaceId) {
          storeSetActiveInterface(interfaceId);
        } else {
          storeSetActiveInterface(null);
        }
        
        // Update the project's active interface
        storeUpdateProject(projectId, { activeInterfaceId: interfaceId });
      }
    }
  }), [
    projectId, 
    storeSetActiveInterface, 
    storeUpdateProject
  ]);

  return {
    ui,
    uiActions,
    activeInterfaceId
  };
} 