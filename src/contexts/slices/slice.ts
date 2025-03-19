import { StateCreator } from "zustand";

// Import the domain logic from selector files
import * as projectLogic from "./selectors/project";
import * as interfaceLogic from "./selectors/interface";
import * as tabLogic from "./selectors/tab";
import * as tileLogic from "./selectors/tile";
import * as tableTileLogic from "./selectors/tableTile";
import * as plotTileLogic from "./selectors/plotTile";
import * as viewTileLogic from "./selectors/viewTile";
import * as sliceUtils from "../utils/sliceUtils";
import { Tile } from "./selectors/tile";

// Re-export the types from the domain logic
export type { Project } from "./selectors/project";
export type { Interface } from "./selectors/interface";
export type { Tab } from "./selectors/tab";

// Top-level projects state
export interface StoreState {
  // Flat dictionaries for each entity type
  projectsById: Record<string, projectLogic.Project>;
  interfacesById: Record<string, interfaceLogic.Interface>;
  tabsById: Record<string, tabLogic.Tab>;
  tilesById: Record<string, tileLogic.Tile>;

  // Global navigation state
  activeProjectId: string | null;
  activeInterfaceId: string | null;
  activeTabId: string | null;
  
  // Global states
  projects: string[];
}

// Update the StoreActions to work with the flat structure
export interface StoreActions {
  // Global actions
  setProjects: (projects: string[]) => void;
  
  // Project level actions
  initProject: (projectId: string, initialState?: Partial<projectLogic.Project>) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<projectLogic.Project>) => void;
  setActiveProject: (projectId: string | null) => void;
  
  // Interface level actions
  initInterface: (projectId: string, interfaceId: string, initialState?: Partial<interfaceLogic.Interface>) => void;
  removeInterface: (projectId: string, interfaceId: string) => void;
  updateInterface: (interfaceId: string, updates: Partial<interfaceLogic.Interface>) => void;
  setActiveInterface: (interfaceId: string | null) => void;
  
  // Tab level actions
  initTab: (interfaceId: string, tabId: string, initialState?: Partial<tabLogic.Tab>) => void;
  addTab: (interfaceId: string, sourceTabId: string, newTabId: string, initialState?: Partial<tabLogic.Tab>) => void;
  removeTab: (interfaceId: string, tabId: string) => void;
  renameTab: (interfaceId: string, sourceTabId: string, newTabId: string, initialState?: Partial<tabLogic.Tab>) => void;
  updateTab: (tabId: string, updates: Partial<tabLogic.Tab>) => void;
  setActiveTab: (interfaceId: string, tabId: string | null) => void;

  // Tile level actions
  initTile: (tabId: string, tileId: string, initialState?: Partial<tileLogic.Tile>) => void;
  addTile: (tabId: string, sourceTileId: string, newTileId: string, initialState?: Partial<tileLogic.Tile>) => void;
  removeTile: (tabId: string, tileId: string) => void;
  renameTile: (tabId: string, sourceTileId: string, newTileId: string, initialState?: Partial<tileLogic.Tile>) => void;
  updateTile: (tileId: string, updates: Partial<tileLogic.Tile>) => void;
  
  // Table tile specific actions
  initTableTile: (tileId: string, initialState?: Partial<tableTileLogic.TableTile>) => void;
  updateTableTile: (tileId: string, updates: Partial<tableTileLogic.TableTile>) => void;
  
  // Plot tile specific actions
  initPlotTile: (tileId: string, initialState?: Partial<plotTileLogic.PlotTile>) => void;
  updatePlotTile: (tileId: string, updates: Partial<plotTileLogic.PlotTile>) => void;
  
  // View tile specific actions
  initViewTile: (tileId: string, initialState?: Partial<viewTileLogic.ViewTile>) => void;
  updateViewTile: (tileId: string, updates: Partial<viewTileLogic.ViewTile>) => void;
  
  // Global state reset action
  resetState: (newState: Partial<StoreState>) => void;

  // Global state update action
  updateState: (updates: Partial<StoreState>) => void;
}

// Combined slice type
export type StoreSlice = StoreState & StoreActions;

// Create the store slice
export const createStoreSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  StoreSlice
> = (set, get, api) => ({
  // Initialize the store with empty dictionaries
  projectsById: {},
  interfacesById: {},
  tabsById: {},
  tilesById: {},
  activeProjectId: null,
  activeInterfaceId: null,
  activeTabId: null,
  projects: [],

  // Global actions
  setProjects: (projects: string[]) => set(state => {
    state.projects = projects;
  }),

  // Project level actions
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
      const filteredUpdates = sliceUtils.filterUnchangedProps(state.projectsById[projectId], updates);
      if (Object.keys(filteredUpdates).length === 0) return;
      console.log("[StoreUpdater] project", projectId, filteredUpdates);
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

  // Interface level actions
  initInterface: (projectId, interfaceId, initialState) => set(state => {
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
  
  removeInterface: (projectId, interfaceId) => set(state => {
    const project = state.projectsById[projectId];
    const interfaceObj = state.interfacesById[interfaceId];
    
    if (!project || !interfaceObj) return;
    
    // Clean up associated tabs
    if (interfaceObj.tabIds) {
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
      project.interfaceIds = project.interfaceIds.filter(iid => iid !== interfaceId);
    }
    
    // Reset active IDs if they match the removed interface
    if (state.activeInterfaceId === interfaceId) {
      state.activeInterfaceId = null;
      state.activeTabId = null;
    }
  }),
  
  updateInterface: (interfaceId, updates) => set(state => {
    const interfaceObj = state.interfacesById[interfaceId];
    if (interfaceObj) {
      // Filter out unchanged fields with the extended partially shallow logic
      const filteredUpdates = sliceUtils.filterUnchangedProps(state.interfacesById[interfaceId], updates);
      if (Object.keys(filteredUpdates).length === 0) return;  
      console.log("[StoreUpdater] interface", interfaceId, filteredUpdates);
      state.interfacesById[interfaceId] = interfaceLogic.updateInterface(interfaceObj, filteredUpdates);
    }
  }),
  
  setActiveInterface: (interfaceId) => set(state => {
    // If the new interface is different, reset other active IDs
    if (interfaceId && interfaceId !== state.activeInterfaceId) {
      state.activeTabId = null;
    }

    state.activeInterfaceId = interfaceId;
  }),

  // Tab level actions
  initTab: (interfaceId, tabId, initialState) => set(state => {
    const interfaceObj = state.interfacesById[interfaceId];
    if (!interfaceObj) return;
    
    // Only initialize if it doesn't exist
    if (!state.tabsById[tabId]) {
      const newTab = tabLogic.initTab(tabId, initialState);
      state.tabsById[tabId] = newTab;
    }
    
    // Update the interface's tabIds array using the proper function
    state.interfacesById[interfaceId] = interfaceLogic.addTabId(interfaceObj, tabId);
  }),

  addTab: (interfaceId, sourceTabId, newTabId, initialState) => set(state => {
    sliceUtils.addTab(state, interfaceId, sourceTabId, newTabId, initialState);
  }),
  
  removeTab: (interfaceId, tabId) => set(state => {
    sliceUtils.removeTab(state, interfaceId, tabId);
  }),

  renameTab: (interfaceId, sourceTabId, newTabId, initialState) => set(state => {
    sliceUtils.renameTab(state, interfaceId, sourceTabId, newTabId, initialState);
  }),
  
  updateTab: (tabId, updates) => set(state => {
    const tab = state.tabsById[tabId];
    if (tab) {
      // Filter out unchanged fields with the extended partially shallow logic
      const filteredUpdates = sliceUtils.filterUnchangedProps(state.tabsById[tabId], updates);
      if (Object.keys(filteredUpdates).length === 0) return;
      if (filteredUpdates.resetting || filteredUpdates.pending) {
        console.log("HERE")
      }
      console.log("[StoreUpdater] tab", tabId, filteredUpdates);
      state.tabsById[tabId] = tabLogic.updateTab(tab, filteredUpdates);
    }
  }),
  
  setActiveTab: (interfaceId, tabId) => set(state => {
    // Set active tab in the global state
    state.activeTabId = tabId;

    // Update the active tab in the interface
    if (state.interfacesById[interfaceId]) {
      const iface = state.interfacesById[interfaceId];
      
      // Deactivate the currently active tab if any
      if (iface.activeTabId && iface.tabIds[iface.activeTabId as unknown as number]) {
        state.tabsById[iface.activeTabId].active = false;
      }
      
      // Set the new active tab
      state.interfacesById[interfaceId].activeTabId = tabId;
      
      // Mark the new tab as active if it exists
      if (tabId && iface.tabIds[tabId as unknown as number]) {
        state.tabsById[tabId].active = true;
      }
    }
  }),

  // Tile level actions
  initTile: (tabId, tileId, initialState) => set(state => {
    const tab = state.tabsById[tabId];
    if (!tab) return;
    
    // Only initialize if it doesn't exist
    if (!state.tilesById[tileId]) {
      const newTile = tileLogic.initTile(tileId, initialState);
      state.tilesById[tileId] = newTile;
      
      // Initialize type-specific data if needed
      if (newTile.type === 'Table') {
        state.tilesById[tileId].tableTile = tableTileLogic.initTableTile();
      } else if (newTile.type === 'Plot') {
        state.tilesById[tileId].plotTile = plotTileLogic.initPlotTile();
      } else if (newTile.type === 'View') {
        state.tilesById[tileId].viewTile = viewTileLogic.initViewTile();
      }
      
      // Add the tile to the tab
      state.tabsById[tabId] = tabLogic.addTileId(tab, tileId);
    }
  }),

  addTile: (tabId, sourceTileId, newTileId, initialState) => set(state => {
    sliceUtils.addTile(state, tabId, sourceTileId, newTileId, initialState);
  }),
  
  removeTile: (tabId, tileId) => set(state => {
    sliceUtils.removeTile(state, tabId, tileId);
  }),

  renameTile: (tabId, sourceTileId, newTileId, initialState) => set(state => {
    sliceUtils.renameTile(state, tabId, sourceTileId, newTileId, initialState);
  }),
  
  updateTile: (tileId, updates) => set(state => {
    const tile = state.tilesById[tileId];

    if (tile) {
      const { tileUpdates, tableTileUpdates, plotTileUpdates, viewTileUpdates } = sliceUtils.splitTileUpdates(updates);

      let updatedTile = tile;
      let tileUpdated = false;
      let itemsNeedRecompute = false;
      
      // Update core tile properties
      if (Object.keys(tileUpdates).length > 0) {
        // Filter out unchanged fields with the extended partially shallow logic
        const filteredTileUpdates = sliceUtils.filterUnchangedProps(tile, tileUpdates);
        if (Object.keys(filteredTileUpdates).length > 0) {
          updatedTile = tileLogic.updateTile(tile, filteredTileUpdates);
          tileUpdated = true;

          // Check if core tile updates need to recompute items
          itemsNeedRecompute = Object.keys(tileUpdates).some(
            key => tileLogic.TILE_PROPS_KEYS_AS_TILE_KEYS.includes(key as keyof Tile)
          );
        }
      }
      
      // Update table-specific data if needed
      if (Object.keys(tableTileUpdates).length > 0) {
        if (!updatedTile.tableTile) {
          updatedTile.tableTile = tableTileLogic.initTableTile();
          tileUpdated = true;
        }
        
        // Filter out unchanged fields with the extended partially shallow logic
        const filteredTableTileUpdates = sliceUtils.filterUnchangedProps(updatedTile.tableTile, tableTileUpdates);
        if (Object.keys(filteredTableTileUpdates).length > 0) {
          
          updatedTile.tableTile = tableTileLogic.updateTableTile(updatedTile.tableTile, filteredTableTileUpdates);
          tileUpdated = true;

          // Check if table tile updates need recompute
          itemsNeedRecompute = Object.keys(filteredTableTileUpdates).some(
            key => tileLogic.TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS.includes(key as keyof typeof tile.tableTile)
          );
        }
      }
      
      // Update plot-specific data if needed
      if (Object.keys(plotTileUpdates).length > 0) {
        if (!updatedTile.plotTile) {
          updatedTile.plotTile = plotTileLogic.initPlotTile();
          tileUpdated = true;
        }
        
        // Filter out unchanged fields with the extended partially shallow logic
        const filteredPlotTileUpdates = sliceUtils.filterUnchangedProps(updatedTile.plotTile, plotTileUpdates);
        if (Object.keys(filteredPlotTileUpdates).length > 0) {
          updatedTile.plotTile = plotTileLogic.updatePlotTile(updatedTile.plotTile, filteredPlotTileUpdates);
          tileUpdated = true;

          // Check if plot tile updates need recompute
          itemsNeedRecompute = Object.keys(filteredPlotTileUpdates).some(
            key => tileLogic.PLOT_TILE_PROPS_KEYS_AS_PLOT_TILE_KEYS.includes(key as keyof typeof tile.plotTile)
          );
        }
      }

      // Update view-specific data if needed
      if (Object.keys(viewTileUpdates).length > 0) {
        if (!updatedTile.viewTile) {
          updatedTile.viewTile = viewTileLogic.initViewTile();
          tileUpdated = true;
        }

        // Filter out unchanged fields with the extended partially shallow logic
        const filteredViewTileUpdates = sliceUtils.filterUnchangedProps(updatedTile.viewTile, viewTileUpdates);
        if (Object.keys(filteredViewTileUpdates).length > 0) {
          updatedTile.viewTile = viewTileLogic.updateViewTile(updatedTile.viewTile, filteredViewTileUpdates);
          tileUpdated = true;

          // Check if view tile updates need recompute
          itemsNeedRecompute = Object.keys(filteredViewTileUpdates).some(
            key => tileLogic.VIEW_TILE_PROPS_KEYS_AS_VIEW_TILE_KEYS.includes(key as keyof typeof tile.viewTile)
          );
        }
      }

      // If we need to recompute, add the flag to the updates
      if (itemsNeedRecompute && !updatedTile.itemsNeedRecompute) {
        updatedTile.itemsNeedRecompute = true;
        tileUpdated = true;

        // Also set the tab's flag if this tile has a tabId
        if (tile.tabId && state.tabsById[tile.tabId] && !state.tabsById[tile.tabId].itemsNeedRecompute) {
          state.tabsById[tile.tabId].itemsNeedRecompute = true;
        }
      }

      // Apply the updated tile if needed
      if (tileUpdated) {
        state.tilesById[tileId] = updatedTile;
      }
    }
  }),

  // Table tile specific actions
  initTableTile: (tileId, initialState) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile) return;
    
    // Initialize table tile data
    state.tilesById[tileId] = {
      ...tile,
      tableTile: tableTileLogic.initTableTile(initialState),
      type: 'Table' // Ensure the tile type is set to 'Table'
    };
  }),
  
  updateTableTile: (tileId, updates) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile || !tile.tableTile) return;
    
    // Filter out unchanged fields with the extended partially shallow logic
    const filteredUpdates = sliceUtils.filterUnchangedProps(tile.tableTile, updates);
    if (Object.keys(filteredUpdates).length === 0) return;

    // Update table-specific data if needed
    let updatedTile = tile;
    let tileUpdated = false;
    let itemsNeedRecompute = false;

    if (!updatedTile.tableTile) {
      updatedTile.tableTile = tableTileLogic.initTableTile();
      tileUpdated = true;
    }

    updatedTile.tableTile = tableTileLogic.updateTableTile(updatedTile.tableTile, filteredUpdates);
    tileUpdated = true;

    // Check if relevant fields are being updated that affect the tile item
    itemsNeedRecompute = Object.keys(filteredUpdates).some(
      key => tileLogic.TABLE_TILE_PROPS_KEYS_AS_TABLE_TILE_KEYS.includes(key as keyof typeof tile.tableTile)
    );

    // If we need to recompute, add the flag to the updates
    if (itemsNeedRecompute && !tile.itemsNeedRecompute) {
      updatedTile.itemsNeedRecompute = true;
      tileUpdated = true;
    }

    // Also set the tab's flag if this tile has a tabId and needs recompute
    if (itemsNeedRecompute && tile.tabId && state.tabsById[tile.tabId] && !state.tabsById[tile.tabId].itemsNeedRecompute) {
      state.tabsById[tile.tabId].itemsNeedRecompute = true;
    }

    // Apply the updated tile if needed
    if (tileUpdated) {
      state.tilesById[tileId] = updatedTile;
    }
  }),
  
  // Plot tile specific actions
  initPlotTile: (tileId, initialState) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile) return;
    
    // Initialize plot tile data
    state.tilesById[tileId] = {
      ...tile,
      plotTile: plotTileLogic.initPlotTile(initialState),
      type: 'Plot' // Ensure the tile type is set to 'Plot'
    };
  }),
  
  updatePlotTile: (tileId, updates) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile || !tile.plotTile) return;
    
    // Filter out unchanged fields with the extended partially shallow logic
    const filteredUpdates = sliceUtils.filterUnchangedProps(tile.plotTile, updates);
    if (Object.keys(filteredUpdates).length === 0) return;
    
    // Update table-specific data if needed
    let updatedTile = tile;
    let tileUpdated = false;
    let itemsNeedRecompute = false;

    if (!updatedTile.plotTile) {
      updatedTile.plotTile = plotTileLogic.initPlotTile();
      tileUpdated = true;
    }

    updatedTile.plotTile = plotTileLogic.updatePlotTile(updatedTile.plotTile, filteredUpdates);
    tileUpdated = true;

    // Check if relevant fields are being updated that affect the tile item
    itemsNeedRecompute = Object.keys(filteredUpdates).some(
      key => tileLogic.PLOT_TILE_PROPS_KEYS_AS_PLOT_TILE_KEYS.includes(key as keyof typeof tile.plotTile)
    );

    // If we need to recompute, add the flag to the updates
    if (itemsNeedRecompute && !tile.itemsNeedRecompute) {
      updatedTile.itemsNeedRecompute = true;
      tileUpdated = true;
    }

    // Also set the tab's flag if this tile has a tabId and needs recompute
    if (itemsNeedRecompute && tile.tabId && state.tabsById[tile.tabId] && !state.tabsById[tile.tabId].itemsNeedRecompute) {
      state.tabsById[tile.tabId].itemsNeedRecompute = true;
    }

    // Apply the updated tile if needed
    if (tileUpdated) {
      state.tilesById[tileId] = updatedTile;
    }
  }),
  
  // View tile specific actions
  initViewTile: (tileId, initialState) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile) return;
    
    // Initialize view tile data
    state.tilesById[tileId] = {
      ...tile,
      viewTile: viewTileLogic.initViewTile(initialState),
      type: 'View' // Ensure the tile type is set to 'View'
    };
  }),
  
  updateViewTile: (tileId, updates) => set(state => {
    // Get the tile
    const tile = state.tilesById[tileId];
    if (!tile || !tile.viewTile) return;
    
    // Filter out unchanged fields with the extended partially shallow logic
    const filteredUpdates = sliceUtils.filterUnchangedProps(tile.viewTile, updates);
    if (Object.keys(filteredUpdates).length === 0) return;
    
    // Update table-specific data if needed
    let updatedTile = tile;
    let tileUpdated = false;
    let itemsNeedRecompute = false;

    if (!updatedTile.viewTile) {
      updatedTile.viewTile = viewTileLogic.initViewTile();
      tileUpdated = true;
    }

    updatedTile.viewTile = viewTileLogic.updateViewTile(updatedTile.viewTile, filteredUpdates);
    tileUpdated = true;

    // Check if relevant fields are being updated that affect the tile item
    itemsNeedRecompute = Object.keys(filteredUpdates).some(
      key => tileLogic.VIEW_TILE_PROPS_KEYS_AS_VIEW_TILE_KEYS.includes(key as keyof typeof tile.viewTile)
    );

    // If we need to recompute, add the flag to the updates
    if (itemsNeedRecompute && !tile.itemsNeedRecompute) {
      updatedTile.itemsNeedRecompute = true;
      tileUpdated = true;
    }

    // Also set the tab's flag if this tile has a tabId and needs recompute
    if (itemsNeedRecompute && tile.tabId && state.tabsById[tile.tabId] && !state.tabsById[tile.tabId].itemsNeedRecompute) {
      state.tabsById[tile.tabId].itemsNeedRecompute = true;
    }

    // Apply the updated tile if needed
    if (tileUpdated) {
      state.tilesById[tileId] = updatedTile;
    }
  }),

  // Global state reset action
  resetState: (newState) => set({ ...newState }),

  // Global state update action
  updateState: (updates) => set((state) => ({
    ...state,
    ...updates,
  })),
}); 