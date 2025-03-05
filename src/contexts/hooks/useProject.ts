import { useCallback, useMemo } from 'react';
import { useStoreContext } from '../providers/StoreProvider';
import { Project } from '../slices/selectors/project';

/**
 * Interface for project-related actions
 */
export interface ProjectActions {
  // Basic project management
  initProject: (initialState?: Partial<Project>) => void;
  updateProject: (updates: Partial<Project>) => void;
  removeProject: () => void;
  
  // Property setters
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  
  // Interface management
  addInterface: (interfaceId: string, initialState?: any) => void;
  removeInterface: (interfaceId: string) => void;
  setActiveInterface: (interfaceId: string | null) => void;
  
  // Helper methods
  getInterface: (interfaceId: string) => any;
  getInterfaceIds: () => string[];
}

/**
 * Custom hook to access project state and actions
 * @param projectId The ID of the project to access
 * @returns Object containing project state, actions, and existence flag
 */
export function useProject(projectId: string | null) {
  // Early return if projectId is null
  if (projectId === null) {
    return { project: null, actions: null, exists: false };
  }
  
  // Get project state from the store using useStoreContext
  const project = useStoreContext(state => 
    state.projectsById[projectId] || null
  );

  // Instead of subscribing to the entire project object,
  // we will subscribe to individual fields. This approach ensures
  // changes to unrelated fields won't force a re-render of everything.

  // 1) Check if the project even exists
  const hasProject = useStoreContext((state) => {
    return !!(projectId && state.projectsById[projectId]);
  });

  // 2) Subscriptions for each property we care about
  const name = useStoreContext((state) => {
    if (!hasProject) return null;
    return state.projectsById[projectId].name;
  });
  const description = useStoreContext((state) => {
    if (!hasProject) return '';
    return state.projectsById[projectId].description;
  });
  const activeInterfaceId = useStoreContext((state) => {
    if (!hasProject) return null;
    return state.projectsById[projectId].activeInterfaceId;
  });
  const interfaces = useStoreContext((state) => {
    if (!hasProject) return null;
    return state.projectsById[projectId].interfaces || null;
  });
  
  // Get store actions
  const storeInitProject = useStoreContext(state => state.initProject);
  const storeUpdateProject = useStoreContext(state => state.updateProject);
  const storeRemoveProject = useStoreContext(state => state.removeProject);
  const storeInitInterface = useStoreContext(state => state.initInterface);
  const storeRemoveInterface = useStoreContext(state => state.removeInterface);
  const storeSetActiveInterface = useStoreContext(state => state.setActiveInterface);
  
  // Memoize all actions to prevent unnecessary re-renders
  const actions = useMemo<ProjectActions>(() => ({
    // Basic project management
    initProject: (initialState) => {
      storeInitProject(projectId, initialState);
    },
    
    updateProject: (updates) => {
      storeUpdateProject(projectId, updates);
    },

    removeProject: () => {
      storeRemoveProject(projectId);
    },

    // Property setters
    setName: (name) => {
      storeUpdateProject(projectId, { name });
    },

    setDescription: (description) => {
      storeUpdateProject(projectId, { description });
    },

    // Interface management
    addInterface: (interfaceId, initialState) => {
      storeInitInterface(projectId, interfaceId, initialState);
    },

    removeInterface: (interfaceId) => {
      storeRemoveInterface(projectId, interfaceId);
    },

    setActiveInterface: (interfaceId) => {
      storeSetActiveInterface(interfaceId);

      if (!hasProject) return;
      storeUpdateProject(projectId, { activeInterfaceId: interfaceId });
    },

    // Helper methods
    getInterface: (interfaceId) => {
      if (!hasProject || !interfaces) return null;
      return interfaces[interfaceId] || null;
    },

    getInterfaceIds: () => {
      if (!hasProject || !interfaces) return [];
      return Object.keys(interfaces);
    },
  }), [
    projectId,
    hasProject,
    name,
    description,
    activeInterfaceId,
    interfaces,
    storeInitProject,
    storeUpdateProject,
    storeRemoveProject,
    storeInitInterface,
    storeRemoveInterface,
    storeSetActiveInterface
  ]);

  // We build a final 'interface' object from the narrower fields
  // so the calling component has a shape similar to before, if needed.
  const finalProject = hasProject
    ? {
        name,
        description,
        activeInterfaceId,
        interfaces,
    } as Project : null;

  return {
    project: finalProject,
    actions,
    exists: hasProject
  };
} 