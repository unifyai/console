import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";
import * as projectLogic from "./selectors/project";
import * as sliceUtils from "../utils/sliceUtils";

export interface ProjectState {
  // State
  projectsById: Record<string, projectLogic.Project>;
}

export interface ProjectActions {
  // Actions
  initProject: (projectId: string, initialState?: Partial<projectLogic.Project>) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<projectLogic.Project>) => void;
  setActiveProject: (projectId: string | null) => void;
}

export type ProjectSlice = ProjectState & ProjectActions;

export const createProjectSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  ProjectSlice
> = (set) => ({
  // State
  projectsById: {},
  
  // Actions
  initProject: (projectId, initialState) => set(state => {
    // Create a new project and add it to the dictionary
    // Only initialize if it doesn't exist
    if (!state.projectsById[projectId]) {
      const newProject = projectLogic.initProject(projectId, initialState);
      state.projectsById[projectId] = newProject;
    }
    
    // Add to projects list if not already present
    if (!state.projects.includes(projectId)) {
      state.projects.push(projectId);
    }
  }),
  
  removeProject: (projectId) => set(state => {
    // Get the project first
    const project = state.projectsById[projectId];
    if (!project) return;
    
    // Clean up associated interfaces
    if (project.interfaceIds) {
      project.interfaceIds.forEach(interfaceId => {
        const interfaceObj = state.interfacesById[interfaceId];
        if (interfaceObj && interfaceObj.tabIds) {
          // Clean up associated tabs
          interfaceObj.tabIds.forEach(tabId => {
            const tab = state.tabsById[tabId];
            if (tab && tab.tileIds) {
              // Clean up associated tiles
              tab.tileIds.forEach(tileId => {
                const tile = state.tilesById[tileId];
                if (tile) {
                  // Clean up tile-specific data
                  if (tile.type === 'Table') state.tilesById[tileId].tableTile = null;
                  else if (tile.type === 'Plot') state.tilesById[tileId].plotTile = null;
                  else if (tile.type === 'View') state.tilesById[tileId].viewTile = null;
                  else if (tile.type === 'Editor') state.tilesById[tileId].editorTile = null;
                  else if (tile.type === 'Terminal') state.tilesById[tileId].terminalTile = null;
                }
                // Remove the tile
                delete state.tilesById[tileId];
              });
            }
            // Remove the tab
            delete state.tabsById[tabId];
          });
        }
        // Remove the interface
        delete state.interfacesById[interfaceId];
      });
    }
    
    // Remove the project
    delete state.projectsById[projectId];
    
    // Remove from projects list
    state.projects = state.projects.filter(p => p !== projectId);
    
    // Reset active IDs if they match the removed project
    if (state.activeProjectId === projectId) {
      state.activeProjectId = null;
      state.activeInterfaceId = null;
      state.activeTabId = null;
    }
  }),
  
  updateProject: (projectId, updates) => set(state => {
    const project = state.projectsById[projectId];
    if (project) {
      // Filter out unchanged fields with the extended partially shallow logic
      const filteredUpdates = sliceUtils.filterUnchangedUpdates(project, updates);
      if (Object.keys(filteredUpdates).length === 0) return;
      state.projectsById[projectId] = projectLogic.updateProject(project, filteredUpdates);
    }
  }),
  
  setActiveProject: (projectId) => set(state => {
    // If the new project is different, reset other active IDs
    if (projectId && projectId !== state.activeProjectId) {
      state.activeInterfaceId = null;
      state.activeTabId = null;
    }

    state.activeProjectId = projectId;
  }),
}); 