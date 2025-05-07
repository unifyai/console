import { IStoreState } from "../store";
import { InterfaceData, TabData, TileData } from "@/types/evals/grid";
import { buildInterfaceState as buildInterfaceObject, addTabToInterface } from "./builders/interfaceStateBuilder";
import { buildTabState as buildTabObject, addTileToTab, updateTabParentReferences } from "./builders/tabStateBuilder";
import { buildTileState as buildTileObject, updateTileParentReferences } from "./builders/tileStateBuilder";
import { TableDataProps, PlotDataProps } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";
import { buildProjectState } from "./builders/projectStateBuilder";
import { Context } from "@/types/evals/grid";

// Add a new interface that extends IStoreState to include stateSource
export interface IServerStateData extends Partial<IStoreState> {
  stateSource?: 'server';
}

/**
 * Build initial state for a project
 */
export function buildProjectStateForStore(
  projectId: string,
  projectName: string,
  contexts: Context[] = [],
  interfaceIds: string[] = [],
  activeInterfaceId?: string
): IServerStateData {
  if (!projectId) {
    return {};
  }

  // Build project
  const project = buildProjectState(projectId, projectName, contexts, interfaceIds);
  
  if (!project) {
    return {};
  }
  
  // Override active interface if specified
  if (activeInterfaceId) {
    project.activeInterfaceId = activeInterfaceId;
  }
  
  // Create initial state
  return {
    activeProjectId: projectId,
    projectsById: {
      [String(projectId)]: project
    }
  };
}

/**
 * Build initial state for an interface
 */
export function buildInterfaceStateForStore(
  interfaceData: InterfaceData,
  activeTabId?: string
): Partial<IStoreState> {
  if (!interfaceData || !interfaceData.id) {
    return {};
  }

  // Build interface object
  const interface_ = buildInterfaceObject(interfaceData, activeTabId);
  
  // Create initial store state
  return {
    activeInterfaceId: interface_.id,
    interfacesById: {
      [String(interface_.id)]: interface_
    }
  };
}

/**
 * Build initial state with a tab
 */
export function buildTabStateForStore(
  tabData: TabData,
  tableArguments: TableArguments = {},
  isActive: boolean = false,
  interfaceId?: string
): Partial<IStoreState> {
  if (!tabData || !tabData.id) {
    return {};
  }

  // Build tab
  const tab = buildTabObject(tabData, tableArguments, isActive);
  
  // Update parent references if interfaceId is provided
  const updatedTab = interfaceId ? 
    updateTabParentReferences(tab, null, interfaceId) : 
    tab;
  
  // Create initial state
  const state: Partial<IStoreState> = {
    tabsById: {
      [String(tab.id)]: updatedTab
    }
  };
  
  // Set active tab if needed
  if (isActive) {
    state.activeTabId = tab.id;
  }
  
  return state;
}

/**
 * Build initial state with a tile
 */
export function buildTileStateForStore(
  tileData: TileData,
  tableData?: TableDataProps,
  plotData?: PlotDataProps,
  tabId?: string,
  interfaceId?: string,
  projectId?: string
): Partial<IStoreState> {
  if (!tileData || !tileData.id) {
    return {};
  }

  // Build tile
  const tile = buildTileObject(tileData, tableData, plotData);
  
  // Update parent references if provided
  const updatedTile = updateTileParentReferences(
    tile, 
    projectId || null, 
    interfaceId || null, 
    tabId || null
  );
  
  // Create initial state
  return {
    tilesById: {
      [String(tile.id)]: updatedTile
    }
  };
}

/**
 * Create initial state with complete interface tree (interface, tabs, tiles)
 */
export function buildCompleteState(
  interfaceData: InterfaceData,
  tabsData: TabData[] = [],
  tilesDataByTabId: Record<string, TileData[]> = {},
  tableArguments: TableArguments = {},
  tableData?: TableDataProps,
  plotData?: PlotDataProps,
  activeTabId?: string
): IServerStateData {
  if (!interfaceData || !interfaceData.id) {
    return {};
  }

  // Start with empty state
  const state: IServerStateData = {
    activeInterfaceId: interfaceData.id,
    interfacesById: {},
    tabsById: {},
    tilesById: {},
  };
  
  // Build interface
  const interface_ = buildInterfaceObject(interfaceData, activeTabId);
  if (state.interfacesById && interface_) {
    state.interfacesById[String(interface_.id)] = interface_;
  }
  
  // Add each tab
  for (const tabData of tabsData) {
    if (tabData && tabData.id) {
      const isActive = activeTabId ? tabData.id === activeTabId : false;
      
      // Build tab
      const tab = buildTabObject(tabData, tableArguments, isActive);
      
      // Update parent references
      if (interfaceData.id && tab) {
        updateTabParentReferences(tab, null, interfaceData.id);
      }
      
      // Add tab to state
      if (state.tabsById && tab) {
        state.tabsById[String(tab.id)] = tab;
      }
      
      // Add tab to interface
      if (interface_ && tab && tab.id) {
        addTabToInterface(interface_, tab.id, tabData.name || '');
      }
      
      // Set active tab if needed
      if (isActive && tab) {
        state.activeTabId = tab.id;
      }
      
      // Add tiles for this tab
      const tabTiles = tabData.id ? (tilesDataByTabId[tabData.id] || []) : [];
      for (const tileData of tabTiles) {
        if (tileData && tileData.id && tab) {
          // Build tile
          const tile = buildTileObject(tileData, tableData, plotData);
          
          // Update parent references
          if (tile) {
            updateTileParentReferences(
              tile, 
              interfaceData.project_id || null, 
              interfaceData.id, 
              tab.id
            );
          }
          
          // Add tile to state
          if (state.tilesById && tile) {
            state.tilesById[String(tile.id)] = tile;
          }
          
          // Add tile to tab
          if (tab && tile && tile.id) {
            addTileToTab(tab, tile.id);
          }
        }
      }
    }
  }
  
  return {
    ...state,
    stateSource: 'server'
  };
}