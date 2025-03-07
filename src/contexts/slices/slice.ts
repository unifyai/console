import { StateCreator } from "zustand";

// Import the domain logic from selector files
import * as projectLogic from "./selectors/project";
import * as interfaceLogic from "./selectors/interface";
import * as tabLogic from "./selectors/tab";
import * as tileLogic from "./selectors/tile";
import * as tableTileLogic from "./selectors/tableTile";
import * as plotTileLogic from "./selectors/plotTile";
import * as viewTileLogic from "./selectors/viewTile";
import { TableTileData } from "./selectors/tableTile";
import { PlotTileData } from "./selectors/plotTile";
import { ViewTileData } from "./selectors/viewTile";
import { Tile } from "./selectors/tile";

// Re-export the types from the domain logic
export type { Project } from "./selectors/project";
export type { Interface } from "./selectors/interface";
export type { Tab } from "./selectors/tab";
export type { Tile } from "./selectors/tile";
export type { TableTileData } from "./selectors/tableTile";
export type { PlotTileData } from "./selectors/plotTile";
export type { ViewTileData } from "./selectors/viewTile";

// tileKeys: all fields for Tile from TileProps in grid.ts
const TILE_KEYS: (keyof Tile)[] = [
  "id","name","type","position","minW","minH","visible","locked","pending",
  "createdAt","updatedAt","moved","static","context","table","auto_update","freeze",
  "filters","common_filter",
];

// tableTileKeys: all fields for TableTileData from TileProps in grid.ts
const TABLE_TILE_KEYS: (keyof TableTileData)[] = [
  "table","table_type","column_context","page_number","metric",
  "column_order","hidden_columns","sorting","grouping","group_sorting",
  "columns_pin_left","columns_pin_right","selected","base_index",
];

// plotTileKeys: all fields for PlotTileData from TileProps in grid.ts
const PLOT_TILE_KEYS: (keyof PlotTileData)[] = [
  "plot_type","plot_scale_x","plot_scale_y","is_aggregated",
  "x_axis","y_axis","plot_group_by","bin_count","regression_line"
];

// viewTileKeys: all fields for ViewTileData from TileProps in grid.ts
const VIEW_TILE_KEYS: (keyof ViewTileData)[] = [];

function splitTileUpdates(
  updates: Record<string, any>
): {
  tileUpdates: Partial<Tile>;
  tableTileUpdates: Partial<TableTileData>;
  plotTileUpdates: Partial<PlotTileData>;
  viewTileUpdates: Partial<ViewTileData>;
} {
  const tileUpdates: Partial<Tile> = {};
  const tableTileUpdates: Partial<TableTileData> = {};
  const plotTileUpdates: Partial<PlotTileData> = {};
  const viewTileUpdates: Partial<ViewTileData> = {};
  
  for (const key in updates) {
    if (TILE_KEYS.includes(key as keyof Tile)) {
      tileUpdates[key as keyof Tile] = updates[key];
    } else if (TABLE_TILE_KEYS.includes(key as keyof TableTileData)) {
      tableTileUpdates[key as keyof TableTileData] = updates[key];
    } else if (PLOT_TILE_KEYS.includes(key as keyof PlotTileData)) {
      plotTileUpdates[key as keyof PlotTileData] = updates[key];
    } else if (VIEW_TILE_KEYS.includes(key as keyof ViewTileData)) {
      viewTileUpdates[key as keyof ViewTileData] = updates[key];
    } else {
      console.warn(`Unknown property '${key}' not in Tile or TableTileData.`);
    }
  }

  return { tileUpdates, tableTileUpdates, plotTileUpdates, viewTileUpdates };
}

// Top-level projects state
export interface StoreState {
  // Project hierarchy
  projectsById: Record<string, projectLogic.Project>;
  // Global navigation state
  activeProjectId: string | null;
  activeInterfaceId: string | null;
  activeTabId: string | null;
}

// Actions for managing the projects state
export interface StoreActions {
  // Project level actions
  initProject: (projectId: string, initialState?: Partial<projectLogic.Project>) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: Partial<projectLogic.Project>) => void;
  setActiveProject: (projectId: string | null) => void;
  
  // Interface level actions
  initInterface: (projectId: string, interfaceId: string, initialState?: Partial<interfaceLogic.Interface>) => void;
  removeInterface: (projectId: string, interfaceId: string) => void;
  updateInterface: (projectId: string, interfaceId: string, updates: Partial<interfaceLogic.Interface>) => void;
  setActiveInterface: (interfaceId: string | null) => void;
  
  // Tab level actions
  initTab: (projectId: string, interfaceId: string, tabId: string, initialState?: Partial<tabLogic.Tab>) => void;
  removeTab: (projectId: string, interfaceId: string, tabId: string) => void;
  updateTab: (projectId: string, interfaceId: string, tabId: string, updates: Partial<tabLogic.Tab>) => void;
  setActiveTab: (projectId: string, interfaceId: string, tabId: string | null) => void;

  // Tile level actions
  initTile: (
    projectId: string, 
    interfaceId: string, 
    tabId: string, 
    tileId: string, 
    initialState?: Partial<tileLogic.Tile>
  ) => void;
  removeTile: (projectId: string, interfaceId: string, tabId: string, tileId: string) => void;
  updateTile: (projectId: string, interfaceId: string, tabId: string, tileId: string, updates: Partial<tileLogic.Tile>) => void;
  
  // Table tile specific actions
  initTableTile: (
    projectId: string, 
    interfaceId: string, 
    tabId: string, 
    tileId: string, 
    initialState?: Partial<tableTileLogic.TableTileData>
  ) => void;
  updateTableTile: (
    projectId: string, 
    interfaceId: string, 
    tabId: string, 
    tileId: string, 
    updates: Partial<tableTileLogic.TableTileData>
  ) => void;
  
  // Plot tile specific actions
  initPlotTile: (
    projectId: string, 
    interfaceId: string, 
    tabId: string, 
    tileId: string, 
    initialState?: Partial<plotTileLogic.PlotTileData>
  ) => void;
  updatePlotTile: (
    projectId: string, 
    interfaceId: string, 
    tabId: string, 
    tileId: string, 
    updates: Partial<plotTileLogic.PlotTileData>
  ) => void;
  
  // View tile specific actions
  initViewTile: (
    projectId: string, 
    interfaceId: string, 
    tabId: string, 
    tileId: string, 
    initialState?: Partial<viewTileLogic.ViewTileData>
  ) => void;
  updateViewTile: (
    projectId: string, 
    interfaceId: string, 
    tabId: string, 
    tileId: string, 
    updates: Partial<viewTileLogic.ViewTileData>
  ) => void;
  
  // Global state reset action
  resetState: (newState: Partial<StoreState>) => void;
}

// Combined slice type
export type StoreSlice = StoreState & StoreActions;

// Create the store slice
export const createStoreSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  StoreSlice
> = (set, get) => ({
  // Initial state
  projectsById: {},
  activeProjectId: null,
  activeInterfaceId: null,
  activeTabId: null,
  
  // Project level actions
  initProject: (projectId, initialState = {}) => set(state => {
    // Only initialize if it doesn't exist
    if (!state.projectsById[projectId]) {
      state.projectsById[projectId] = projectLogic.initProject(projectId, initialState);
    }
  }),
  
  removeProject: (projectId) => set(state => {
    if (state.projectsById[projectId]) {
      delete state.projectsById[projectId];
      
      // Reset active IDs if they were in this project
      if (state.activeProjectId === projectId) {
        state.activeProjectId = null;
        state.activeInterfaceId = null;
        state.activeTabId = null;
      }
    }
  }),
  
  updateProject: (projectId, updates) => set(state => {
    if (state.projectsById[projectId]) {
      state.projectsById[projectId] = projectLogic.updateProject(
        state.projectsById[projectId],
        updates
      );
    }
  }),
  
  setActiveProject: (projectId) => set(state => {
    state.activeProjectId = projectId;
    
    // If the new project is different, reset other active IDs
    if (projectId && projectId !== state.activeProjectId) {
      state.activeInterfaceId = null;
      state.activeTabId = null;
    }
  }),
  
  // Interface level actions
  initInterface: (projectId, interfaceId, initialState = {}) => set(state => {
    if (state.projectsById[projectId]) {
      const project = state.projectsById[projectId];
      const iface = interfaceLogic.initInterface(interfaceId, initialState);
      
      state.projectsById[projectId] = projectLogic.addInterface(project, interfaceId, iface);
    }
  }),
  
  removeInterface: (projectId, interfaceId) => set(state => {
    if (state.projectsById[projectId]) {
      state.projectsById[projectId] = projectLogic.removeInterface(
        state.projectsById[projectId],
        interfaceId
      );
      
      // Reset active interface ID if it was this one
      if (state.activeInterfaceId === interfaceId) {
        state.activeInterfaceId = null;
        state.activeTabId = null;
      }
    }
  }),
  
  updateInterface: (projectId, interfaceId, updates) => set(state => {
    if (state.projectsById[projectId]?.interfaces?.[interfaceId]) {
      const updatedInterface = interfaceLogic.updateInterface(
        state.projectsById[projectId].interfaces[interfaceId],
        updates
      );
      
      state.projectsById[projectId].interfaces[interfaceId] = updatedInterface;
    }
  }),
  
  setActiveInterface: (interfaceId) => set(state => {
    state.activeInterfaceId = interfaceId;
    
    // If the interface changed, reset the active tab
    if (interfaceId !== state.activeInterfaceId) {
      state.activeTabId = null;
    }
  }),
  
  // Tab level actions
  initTab: (projectId, interfaceId, tabId, initialState = {}) => set(state => {
    if (state.projectsById[projectId]?.interfaces?.[interfaceId]) {
      const tab = tabLogic.initTab(tabId, initialState);
      
      if (!state.projectsById[projectId].interfaces[interfaceId].tabs) {
        state.projectsById[projectId].interfaces[interfaceId].tabs = {};
      }
      
      state.projectsById[projectId].interfaces[interfaceId].tabs[tabId] = tab;
    }
  }),
  
  removeTab: (projectId, interfaceId, tabId) => set(state => {
    if (state.projectsById[projectId]?.interfaces?.[interfaceId]) {
      const iface = state.projectsById[projectId].interfaces[interfaceId];
      
      if (iface.tabs && iface.tabs[tabId]) {
        const newTabs = { ...iface.tabs };
        delete newTabs[tabId];
        
        state.projectsById[projectId].interfaces[interfaceId].tabs = newTabs;
        
        // Reset active tab ID if it was this one
        if (state.activeTabId === tabId) {
          state.activeTabId = null;
        }
        
        // Reset interface's activeTabId if needed
        if (iface.activeTabId === tabId) {
          state.projectsById[projectId].interfaces[interfaceId].activeTabId = null;
        }
      }
    }
  }),
  
  updateTab: (projectId, interfaceId, tabId, updates) => set(state => {
    if (state.projectsById[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId]) {
      const updatedTab = tabLogic.updateTab(
        state.projectsById[projectId].interfaces[interfaceId].tabs[tabId],
        updates
      );
      
      state.projectsById[projectId].interfaces[interfaceId].tabs[tabId] = updatedTab;
    }
  }),
  
  setActiveTab: (projectId, interfaceId, tabId) => set(state => {
    // Set active tab in the global state
    state.activeTabId = tabId;
    
    // Update the active tab in the interface
    if (state.projectsById[projectId]?.interfaces?.[interfaceId]) {
      const iface = state.projectsById[projectId].interfaces[interfaceId];
      
      // Deactivate the currently active tab if any
      if (iface.activeTabId && iface.tabs[iface.activeTabId]) {
        state.projectsById[projectId].interfaces[interfaceId].tabs[iface.activeTabId].active = false;
      }
      
      // Set the new active tab
      state.projectsById[projectId].interfaces[interfaceId].activeTabId = tabId;
      
      // Mark the new tab as active if it exists
      if (tabId && iface.tabs[tabId]) {
        state.projectsById[projectId].interfaces[interfaceId].tabs[tabId].active = true;
      }
    }
  }),
  
  // Tile level actions
  initTile: (
    projectId: string, 
    interfaceId: string, 
    tabId: string, 
    tileId: string, 
    initialState?: Partial<tileLogic.Tile>
  ) => set(state => {
    if (state.projectsById[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId]) {
      const tile = tileLogic.initTile(tileId, initialState || {});
      
      if (!state.projectsById[projectId].interfaces[interfaceId].tabs[tabId].tiles) {
        state.projectsById[projectId].interfaces[interfaceId].tabs[tabId].tiles = {};
      }
      
      state.projectsById[projectId].interfaces[interfaceId].tabs[tabId].tiles[tileId] = tile;
    }
  }),
  
  removeTile: (projectId, interfaceId, tabId, tileId) => set(state => {
    const tab = state.projectsById[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId];
    
    if (tab?.tiles?.[tileId]) {
      const newTiles = { ...tab.tiles };
      delete newTiles[tileId];
      
      state.projectsById[projectId].interfaces[interfaceId].tabs[tabId].tiles = newTiles;
    }
  }),
  
  updateTile: (projectId, interfaceId, tabId, tileId, updates) => set(state => {
    const tile = state.projectsById[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId]?.tiles?.[tileId];
    
    if (tile) {
      const { tileUpdates, tableTileUpdates, plotTileUpdates, viewTileUpdates } = splitTileUpdates(updates);
      
      let updatedTile = tile;
      if (tileUpdates) {
        updatedTile = tileLogic.updateTile(tile, tileUpdates);
      }
      
      if (tableTileUpdates) {
        updatedTile.tableData = tableTileLogic.updateTableTile(updatedTile.tableData || tableTileLogic.initTableTile(tileId), tableTileUpdates);
      }

      if (plotTileUpdates) {
        updatedTile.plotData = plotTileLogic.updatePlotTile(updatedTile.plotData || plotTileLogic.initPlotTile(tileId), plotTileUpdates);
      }

      if (viewTileUpdates) {
        updatedTile.viewData = viewTileLogic.updateViewTile(updatedTile.viewData || viewTileLogic.initViewTile(tileId), viewTileUpdates);
      }

      state.projectsById[projectId].interfaces[interfaceId].tabs[tabId].tiles[tileId] = updatedTile;
    }
  }),
  
  // Table tile specific actions
  initTableTile: (projectId, interfaceId, tabId, tileId, initialState = {}) => set(state => {
    const tile = state.projectsById[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId]?.tiles?.[tileId];
    
    if (tile && tile.type === 'Table') {
      tile.tableData = tableTileLogic.initTableTile(tileId, initialState);
    }
  }),
  
  updateTableTile: (projectId, interfaceId, tabId, tileId, updates) => set(state => {
    const tile = state.projectsById[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId]?.tiles?.[tileId];
    
    if (tile && tile.type === 'Table' && tile.tableData) {
      tile.tableData = tableTileLogic.updateTableTile(tile.tableData, updates);
    }
  }),
  
  // Plot tile specific actions
  initPlotTile: (projectId, interfaceId, tabId, tileId, initialState = {}) => set(state => {
    const tile = state.projectsById[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId]?.tiles?.[tileId];
    
    if (tile && tile.type === 'Plot') {
      tile.plotData = plotTileLogic.initPlotTile(tileId, initialState);
    }
  }),
  
  updatePlotTile: (projectId, interfaceId, tabId, tileId, updates) => set(state => {
    const tile = state.projectsById[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId]?.tiles?.[tileId];
    
    if (tile && tile.type === 'Plot' && tile.plotData) {
      tile.plotData = plotTileLogic.updatePlotTile(tile.plotData, updates);
    }
  }),
  
  // View tile specific actions
  initViewTile: (projectId, interfaceId, tabId, tileId, initialState = {}) => set(state => {
    const tile = state.projectsById[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId]?.tiles?.[tileId];
    
    if (tile && tile.type === 'View') {
      // Add a viewData property to the tile with the initialized view data
      viewTileLogic.initViewTile(tileId, initialState);
    }
  }),
  
  updateViewTile: (projectId, interfaceId, tabId, tileId, updates) => set(state => {
    const tile = state.projectsById[projectId]?.interfaces?.[interfaceId]?.tabs?.[tabId]?.tiles?.[tileId];
    
    if (tile && tile.type === 'View' && tile.viewData) {
      viewTileLogic.updateViewTile(tile.viewData, updates);
    }
  }),
  
  // Global state reset action
  resetState: (newState) => set((state) => {
    // Handle projects
    if (newState.projectsById) {
      for (const projectId in newState.projectsById) {
        const newProject = newState.projectsById[projectId];
        
        // Add new projects that don't exist
        if (!state.projectsById[projectId]) {
          state.projectsById[projectId] = projectLogic.initProject(projectId, newProject);
        } else {
          // Deep merge existing projects
          const project = state.projectsById[projectId];
          
          // Update top-level project properties (except interfaces)
          if (newProject.name) project.name = newProject.name;
          if (newProject.description) project.description = newProject.description;
          if (newProject.createdAt) project.createdAt = newProject.createdAt;
          if (newProject.updatedAt) project.updatedAt = newProject.updatedAt;
          if (newProject.activeInterfaceId !== undefined) {
            project.activeInterfaceId = newProject.activeInterfaceId;
          }
          
          // Handle interfaces
          if (newProject.interfaces) {
            for (const interfaceId in newProject.interfaces) {
              const newInterface = newProject.interfaces[interfaceId];
              
              // Add new interfaces that don't exist
              if (!project.interfaces[interfaceId]) {
                project.interfaces[interfaceId] = interfaceLogic.initInterface(interfaceId, newInterface);
              } else {
                // Deep merge existing interfaces
                const iface = project.interfaces[interfaceId];
                
                // Update top-level interface properties (except tabs)
                if (newInterface.name) iface.name = newInterface.name;
                if (newInterface.createdAt) iface.createdAt = newInterface.createdAt;
                if (newInterface.updatedAt) iface.updatedAt = newInterface.updatedAt;
                if (newInterface.activeTabId !== undefined) {
                  iface.activeTabId = newInterface.activeTabId;
                }
                
                // Handle tabs
                if (newInterface.tabs) {
                  for (const tabId in newInterface.tabs) {
                    const newTab = newInterface.tabs[tabId];
                    
                    // Add new tabs that don't exist
                    if (!iface.tabs[tabId]) {
                      iface.tabs[tabId] = tabLogic.initTab(tabId, newTab);
                    } else {
                      // Deep merge existing tabs
                      const tab = iface.tabs[tabId];
                      
                      // Update top-level tab properties (except tiles)
                      if (newTab.name) tab.name = newTab.name;
                      if (newTab.visible !== undefined) tab.visible = newTab.visible;
                      if (newTab.active !== undefined) tab.active = newTab.active;
                      if (newTab.order !== undefined) tab.order = newTab.order;
                      if (newTab.tabCreated !== undefined) tab.tabCreated = newTab.tabCreated;
                      if (newTab.tempTabCreated !== undefined) tab.tempTabCreated = newTab.tempTabCreated;
                      if (newTab.savedTab) tab.savedTab = newTab.savedTab;
                      if (newTab.createdAt) tab.createdAt = newTab.createdAt;
                      if (newTab.updatedAt) tab.updatedAt = newTab.updatedAt;
                      
                      // Handle tiles
                      if (newTab.tiles) {
                        for (const tileId in newTab.tiles) {
                          const newTile = newTab.tiles[tileId];
                          
                          // Add new tiles that don't exist
                          if (!tab.tiles[tileId]) {
                            tab.tiles[tileId] = tileLogic.initTile(tileId, { type: newTile.type, ...newTile });
                          } else {
                            // Deep merge existing tiles
                            const tile = tab.tiles[tileId];
                            
                            // Update tile properties
                            if (newTile.name) tile.name = newTile.name;
                            if (newTile.position) tile.position = { ...tile.position, ...newTile.position };
                            if (newTile.visible !== undefined) tile.visible = newTile.visible;
                            if (newTile.locked !== undefined) tile.locked = newTile.locked;
                            if (newTile.pending !== undefined) tile.pending = newTile.pending;
                            if (newTile.createdAt) tile.createdAt = newTile.createdAt;
                            if (newTile.updatedAt) tile.updatedAt = newTile.updatedAt;
                            
                            // Update tile data based on type
                            if (tile.type === 'Table' && newTile.tableData) {
                              tile.tableData = tableTileLogic.updateTableTile(
                                tile.tableData || tableTileLogic.initTableTile(tileId),
                                newTile.tableData
                              );
                            } else if (tile.type === 'Plot' && newTile.plotData) {
                              tile.plotData = plotTileLogic.updatePlotTile(
                                tile.plotData || plotTileLogic.initPlotTile(tileId),
                                newTile.plotData
                              );
                            } else if (tile.type === 'View' && newTile.viewData) {
                              tile.viewData = viewTileLogic.updateViewTile(
                                tile.viewData || viewTileLogic.initViewTile(tileId),
                                newTile.viewData
                              );
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Update active IDs
    if (newState.activeProjectId !== undefined) {
      state.activeProjectId = newState.activeProjectId;
    }
    if (newState.activeInterfaceId !== undefined) {
      state.activeInterfaceId = newState.activeInterfaceId;
    }
    if (newState.activeTabId !== undefined) {
      state.activeTabId = newState.activeTabId;
    }
  }),
}); 