import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { ProjectData } from '../../slices/selectors/project';
import { useShallow } from 'zustand/react/shallow';
import { Context } from '@/types/evals/grid';
import { useProjectMeta } from './useProjectMeta';

// Define stable fallback references
const EMPTY_CONTEXTS: Context[] = [];
const EMPTY_INTERFACE_IDS: string[] = [];

/**
 * Interface for project-related data actions
 */
export interface ProjectDataActions {
  setDescription: (description: string) => void;
  setContexts: (contexts: Context[]) => void;
  addInterfaceId: (interfaceId: string) => void;
  removeInterfaceId: (interfaceId: string) => void;
}

/**
 * Custom hook to access project data and related actions
 * @param projectName The name of the project to access
 * @returns Object containing project data, actions, and other related state
 */
export function useProjectData(projectName: string | null) {
  // Use the meta hook to get common project info
  const { 
    projectId, 
    projectExists 
  } = useProjectMeta(projectName);

  // Granular subscriptions to Data properties using useShallow for arrays and objects
  const description = useStoreContext(state => {
    if (!projectExists || !projectId) return '';
    return state.projectsById[projectId].description;
  });
  
  const contexts = useStoreContext(
    useShallow(state => {
      if (!projectExists || !projectId) return EMPTY_CONTEXTS;
      return state.projectsById[projectId].contexts;
    })
  );
  
  const interfaceIds = useStoreContext(
    useShallow(state => {
      if (!projectExists || !projectId) return EMPTY_INTERFACE_IDS;
      return state.projectsById[projectId].interfaceIds;
    })
  );

  // Get store actions for data management
  const storeUpdateProject = useStoreContext(state => state.updateProject);
  const storeInitInterface = useStoreContext(state => state.initInterface);
  const storeRemoveInterface = useStoreContext(state => state.removeInterface);

  // Memoize the data object to prevent unnecessary rerenders
  const data = useMemo<Partial<ProjectData> | null>(() => {
    if (!projectExists) return null;
    
    return {
      description,
      contexts,
      interfaceIds
    };
  }, [projectExists, description, contexts, interfaceIds]);

  // Memoize the data actions to prevent unnecessary re-renders
  const dataActions = useMemo<ProjectDataActions>(() => ({
    setDescription: (description) => {
      if (projectId) {
        storeUpdateProject(projectId, { description });
      }
    },
    
    setContexts: (contexts) => {
      if (projectId) {
        storeUpdateProject(projectId, { contexts });
      }
    },
    
    addInterfaceId: (interfaceName) => {
      if (projectId && interfaceIds) {
        // Create the interface with the hierarchical ID pattern
        const interfaceId = `${projectId}>${interfaceName}`;
        
        // Initialize the interface
        storeInitInterface(projectId, interfaceId, {
          id: interfaceId,
          name: interfaceName,
          projectId: projectId
        });
        
        // Add the interface ID to the project's interfaceIds array
        if (!interfaceIds.includes(interfaceId)) {
          const newInterfaceIds = [...interfaceIds, interfaceId];
          storeUpdateProject(projectId, { interfaceIds: newInterfaceIds });
        }
      }
    },
    
    removeInterfaceId: (interfaceName) => {
      if (projectId && interfaceIds) {
        // Check if the interface ID is already hierarchical
        const interfaceId = interfaceName.includes('>')
          ? interfaceName
          : `${projectId}>${interfaceName}`;
        
        // Remove the interface from the store
        storeRemoveInterface(projectId, interfaceId);
        
        // Remove the interface ID from the project's interfaceIds array
        const newInterfaceIds = interfaceIds.filter(id => id !== interfaceId);
        storeUpdateProject(projectId, { interfaceIds: newInterfaceIds });
      }
    }
  }), [
    projectId, 
    interfaceIds, 
    storeUpdateProject, 
    storeInitInterface, 
    storeRemoveInterface
  ]);

  return {
    data,
    dataActions,
    interfaceIds,
    contexts
  };
} 