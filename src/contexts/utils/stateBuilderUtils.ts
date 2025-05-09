import { IStoreState } from "../store";
import { InterfaceData, TabData, TileData } from "@/types/evals/grid";
import { buildInterfaceState as buildInterfaceObject, addTabToInterface } from "./builders/interfaceStateBuilder";
import { buildTabState as buildTabObject, addTileToTab, updateTabParentReferences } from "./builders/tabStateBuilder";
import { buildTileState as buildTileObject, updateTileParentReferences } from "./builders/tileStateBuilder";
import { buildProjectState } from "./builders/projectStateBuilder";
import { Context } from "@/types/evals/grid";

// Add a new interface that extends IStoreState to include stateSource
export interface IServerStateData extends Partial<IStoreState> {
  stateSource?: 'server';
}

/**
 * Build initial state for a project or multiple projects
 */
export function buildProjectStateForStore(
  projectId: string | string[],
  projectName: string | string[],
  contexts: Context[] | Context[][] = [],
  interfaceIds: string[] | string[][] = [],
  activeInterfaceId?: string | string[]
): IServerStateData {
  // Handle array case
  if (Array.isArray(projectId)) {
    const result: IServerStateData = { projectsById: {} };
    
    // Process each project
    for (let i = 0; i < projectId.length; i++) {
      const id = projectId[i];
      if (!id) continue;
      
      const name = Array.isArray(projectName) ? projectName[i] : projectName;
      const ctxs = Array.isArray(contexts[0]) ? contexts[i] as Context[] : contexts as Context[];
      const ids = Array.isArray(interfaceIds[0]) ? interfaceIds[i] as string[] : interfaceIds as string[];
      const activeId = Array.isArray(activeInterfaceId) ? activeInterfaceId[i] : activeInterfaceId;
      
      // Build project
      const project = buildProjectState(id, name, ctxs, ids);
      
      if (project) {
        // Override active interface if specified
        if (activeId) {
          project.activeInterfaceId = activeId;
        }
        
        // Add to result
        result.projectsById![String(id)] = project;
      }
    }
    
    // Set active project to first one if available
    if (projectId.length > 0 && result.projectsById![String(projectId[0])]) {
      result.activeProjectId = projectId[0];
    }
    
    return result;
  }
  
  // Handle single project case
  if (!projectId) {
    return {};
  }

  // Build project
  const project = buildProjectState(projectId, projectName as string, contexts as Context[], interfaceIds as string[]);
  
  if (!project) {
    return {};
  }
  
  // Override active interface if specified
  if (activeInterfaceId) {
    project.activeInterfaceId = activeInterfaceId as string;
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
 * Build initial state for an interface or multiple interfaces
 */
export function buildInterfaceStateForStore(
  interfaceData: InterfaceData | InterfaceData[],
  activeTabId?: string | string[],
  tabIds?: string[] | string[][],
  tabNames?: string[] | string[][]
): Partial<IStoreState> {
  // Handle array case
  if (Array.isArray(interfaceData)) {
    const result: Partial<IStoreState> = { interfacesById: {} };
    
    // Process each interface
    for (let i = 0; i < interfaceData.length; i++) {
      const data = interfaceData[i];
      if (!data || !data.id) continue;
      
      const aTabId = Array.isArray(activeTabId) ? activeTabId[i] : activeTabId;
      const tIds = Array.isArray(tabIds![0]) ? tabIds![i] as string[] : tabIds as string[];
      const tNames = Array.isArray(tabNames![0]) ? tabNames![i] as string[] : tabNames as string[];
      
      // Build interface object
      const interface_ = buildInterfaceObject(data, aTabId, tIds, tNames);
      
      // Add to result
      result.interfacesById![String(interface_.id)] = interface_;
    }
    
    // Set active interface to first one if available
    if (interfaceData.length > 0 && interfaceData[0].id && result.interfacesById![String(interfaceData[0].id)]) {
      result.activeInterfaceId = interfaceData[0].id;
    }
    
    return result;
  }
  
  // Handle single interface case
  if (!interfaceData || !interfaceData.id) {
    return {};
  }

  // Build interface object
  const interface_ = buildInterfaceObject(interfaceData, activeTabId as string, tabIds as string[], tabNames as string[]);
  
  // Create initial store state
  return {
    activeInterfaceId: interface_.id,
    interfacesById: {
      [String(interface_.id)]: interface_
    }
  };
}

/**
 * Build initial state with a tab or multiple tabs
 */
export function buildTabStateForStore(
  tabData: TabData | TabData[],
  isActive: boolean | boolean[] = false,
  interfaceId?: string | string[],
  tileIds?: string[] | string[][],
  tileNames?: string[] | string[][]
): Partial<IStoreState> {
  // Handle array case
  if (Array.isArray(tabData)) {
    const result: Partial<IStoreState> = { tabsById: {} };
    
    // Process each tab
    for (let i = 0; i < tabData.length; i++) {
      const data = tabData[i];
      if (!data || !data.id) continue;
      
      const active = Array.isArray(isActive) ? isActive[i] : isActive;
      const iId = Array.isArray(interfaceId) ? interfaceId[i] : interfaceId;
      const tIds = Array.isArray(tileIds![0]) ? tileIds![i] as string[] : tileIds as string[];
      const tNames = Array.isArray(tileNames![0]) ? tileNames![i] as string[] : tileNames as string[];
      
      // Build tab
      const tab = buildTabObject(data, active, tIds, tNames);
      
      // Update parent references if interfaceId is provided
      const updatedTab = iId ? 
        updateTabParentReferences(tab, iId) : 
        tab;
      
      // Add to result
      result.tabsById![String(tab.id)] = updatedTab;
      
      // Set active tab if needed
      if (active && !result.activeTabId) {
        result.activeTabId = tab.id;
      }
    }
    
    return result;
  }
  
  // Handle single tab case
  if (!tabData || !tabData.id) {
    return {};
  }

  // Build tab
  const tab = buildTabObject(tabData, isActive as boolean, tileIds as string[], tileNames as string[]);
  
  // Update parent references if interfaceId is provided
  const updatedTab = interfaceId ? 
    updateTabParentReferences(tab, interfaceId as string) : 
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
 * Build initial state with a tile or multiple tiles
 */
export function buildTileStateForStore(
  tileData: TileData | TileData[], 
  tabId?: string | string[]
): Partial<IStoreState> {
  // Handle array case
  if (Array.isArray(tileData)) {
    const result: Partial<IStoreState> = { tilesById: {} };
    
    // Process each tile
    for (let i = 0; i < tileData.length; i++) {
      const data = tileData[i];
      if (!data || !data.id) continue;
      
      const tId = Array.isArray(tabId) ? tabId[i] : tabId;
      
      // Build tile
      const tile = buildTileObject(data);
      
      // Update parent references if provided
      const updatedTile = updateTileParentReferences(
        tile, 
        tId || null
      );
      
      // Add to result
      result.tilesById![String(tile.id)] = updatedTile;
    }
    
    return result;
  }
  
  // Handle single tile case
  if (!tileData || !tileData.id) {
    return {};
  }

  // Build tile
  const tile = buildTileObject(tileData);
  
  // Update parent references if provided
  const updatedTile = updateTileParentReferences(
    tile, 
    tabId as string || null
  );
  
  // Create initial state
  return {
    tilesById: {
      [String(tile.id)]: updatedTile
    }
  };
}
