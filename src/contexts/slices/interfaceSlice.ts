import { StateCreator } from 'zustand';
import { StoreSlice } from './slice';
import * as interfaceLogic from './selectors/interface';
import * as projectLogic from './selectors/project';
import * as sliceUtils from '../utils/sliceUtils';

export interface InterfaceState {
  // State
  interfacesById: Record<string, interfaceLogic.Interface>;
}

export interface InterfaceActions {
  // Actions
  initInterface: (
    projectId: string,
    interfaceId: string,
    initialState?: Partial<interfaceLogic.Interface>
  ) => void;
  removeInterface: (projectId: string, interfaceId: string) => void;
  updateInterface: (interfaceId: string, updates: Partial<interfaceLogic.Interface>) => void;
  setActiveInterface: (interfaceId: string | null) => void;
}

export type InterfaceSlice = InterfaceState & InterfaceActions;

export const createInterfaceSlice: StateCreator<
  StoreSlice,
  [['zustand/immer', never]],
  [],
  InterfaceSlice
> = (set) => ({
  // State
  interfacesById: {},

  // Actions
  initInterface: (projectId, interfaceId, initialState) =>
    set((state) => {
      const project = state.projectsById[projectId];
      if (!project) return;

      // Create a new interface and add it to the dictionary
      // Only initialize if it doesn't exist
      if (!state.interfacesById[interfaceId]) {
        const newInterface = interfaceLogic.initInterface(interfaceId, initialState);
        state.interfacesById[interfaceId] = newInterface;
      }

      // Update the project's interfaceIds array using the proper function
      state.projectsById[projectId] = projectLogic.addInterfaceId(project, interfaceId);
    }),

  removeInterface: (projectId, interfaceId) =>
    set((state) => {
      const project = state.projectsById[projectId];
      const interfaceObj = state.interfacesById[interfaceId];

      if (!project || !interfaceObj) return;

      // Clean up associated tabs
      if (interfaceObj.tabIds) {
        interfaceObj.tabIds.forEach((tabId) => {
          const tab = state.tabsById[tabId];
          if (tab && tab.tileIds) {
            // Clean up associated tiles
            tab.tileIds.forEach((tileId) => {
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

      // Update the project's interfaceIds array
      if (project.interfaceIds) {
        project.interfaceIds = project.interfaceIds.filter((iid) => iid !== interfaceId);
      }

      // Reset active IDs if they match the removed interface
      if (state.activeInterfaceId === interfaceId) {
        state.activeInterfaceId = null;
        state.activeTabId = null;
      }
    }),

  updateInterface: (interfaceId, updates) =>
    set((state) => {
      const interfaceObj = state.interfacesById[interfaceId];
      if (interfaceObj) {
        // Filter out unchanged fields with the extended partially shallow logic
        const filteredUpdates = sliceUtils.filterUnchangedUpdates(interfaceObj, updates);
        if (Object.keys(filteredUpdates).length === 0) return;
        state.interfacesById[interfaceId] = interfaceLogic.updateInterface(
          interfaceObj,
          filteredUpdates
        );
      }
    }),

  setActiveInterface: (interfaceId) =>
    set((state) => {
      // If the new interface is different, reset other active IDs
      if (interfaceId && interfaceId !== state.activeInterfaceId) {
        state.activeTabId = null;
      }

      state.activeInterfaceId = interfaceId;
    }),
});
