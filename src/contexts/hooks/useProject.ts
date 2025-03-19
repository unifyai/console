import { useMemo } from 'react';
import { useStoreContext } from '../providers/StoreProvider';
import { Project, ProjectMeta, ProjectData, ProjectUI } from '../slices/selectors/project';
import { useShallow } from 'zustand/react/shallow';
import { Context } from '@/types/evals/grid';

// Define stable fallback references
const EMPTY_CONTEXTS: Context[] = [];
const EMPTY_INTERFACE_IDS: string[] = [];
const DEFAULT_USE_PROJECT_RETURN = {
  project: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  actions: null,
  exists: false
};

/**
 * Interface for project-related meta actions
 */
export interface ProjectMetaActions {
  setName: (name: string) => void;
}

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
 * Interface for project-related UI actions
 */
export interface ProjectUIActions {
  setActiveInterfaceId: (interfaceId: string | null) => void;
}

/**
 * Interface for all project-related actions
 */
export interface ProjectActions {
  // Basic project management
  initProject: (initialState?: Partial<Project>) => void;
  updateProject: (updates: Partial<Project>) => void;
  removeProject: () => void;
  
  // Categorized actions
  meta: ProjectMetaActions;
  data: ProjectDataActions;
  ui: ProjectUIActions;
  
  // Helper methods
  getInterfaceIds: () => string[];
}

/**
 * Custom hook to access project state and actions
 * @param projectName The name of the project to access
 * @returns Object containing project state, actions, and existence flag
 */
export function useProject(projectName: string | null) {
  // Call all hooks unconditionally at the top level
  const projectId = projectName

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

  // Granular subscriptions to Data properties
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

  // Granular subscriptions to UI properties
  const activeInterfaceId = useStoreContext(state => {
    if (!projectExists || !projectId) return null;
    return state.projectsById[projectId].activeInterfaceId;
  });

  // Get store actions
  const storeInitProject = useStoreContext(state => state.initProject);
  const storeUpdateProject = useStoreContext(state => state.updateProject);
  const storeRemoveProject = useStoreContext(state => state.removeProject);
  const storeInitInterface = useStoreContext(state => state.initInterface);
  const storeRemoveInterface = useStoreContext(state => state.removeInterface);
  const storeSetActiveInterface = useStoreContext(state => state.setActiveInterface);

  // Memoize the metadata object to prevent unnecessary rerenders
  const meta = useMemo<Partial<ProjectMeta> | null>(() => {
    if (!projectExists) return null;
    
    return {
      id,
      name,
    };
  }, [projectExists, id, name]);
  
  // Memoize the data object to prevent unnecessary rerenders
  const data = useMemo<Partial<ProjectData> | null>(() => {
    if (!projectExists) return null;
    
    return {
      description,
      contexts,
      interfaceIds
    };
  }, [projectExists, description, contexts, interfaceIds]);
  
  // Memoize the UI state object to prevent unnecessary rerenders
  const ui = useMemo<Partial<ProjectUI> | null>(() => {
    if (!projectExists) return null;
    
    return {
      activeInterfaceId
    };
  }, [projectExists, activeInterfaceId]);

  // Memoize the meta actions to prevent unnecessary re-renders
  const metaActions = useMemo<ProjectMetaActions>(() => ({
    setName: (name) => {
      if (projectId) {
        storeUpdateProject(projectId, { name });
      }
    }
  }), [projectId, storeUpdateProject]);
    
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
        const interfaceId = `${interfaceName}>${projectId}`;
        
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
      }
    };
  }, [
    projectId,
    interfaceIds,
    storeInitProject,
    storeUpdateProject,
    storeRemoveProject,
    metaActions,
    dataActions,
    uiActions
  ]);
  
  // Build a final 'project' object from the separate meta, data, and UI objects
  const projectObj = useMemo<Partial<Project> | null>(() => {
    if (!meta || !data || !ui) return null;
    
    return {
      ...meta,
      ...data,
      ...ui
    };
  }, [meta, data, ui]);

  // Use projectId to conditionally return values, but only after all hooks are called
  if (projectId === null) {
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
    exists: projectExists
  };
} 