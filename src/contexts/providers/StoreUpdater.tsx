"use client";

import { useEffect, useRef } from 'react';
import { IStoreState } from '../store';
import { useStoreContext } from './StoreProvider';
import { shallow } from 'zustand/vanilla/shallow';
import { useShallow } from 'zustand/react/shallow';

// Component to handle store updates when initialState changes
function StoreUpdater({ initialState }: { initialState: Partial<IStoreState> }) {
  const storeActions = useStoreContext(
    useShallow(state => ({
      // Global actions
      updateState: state.updateState,
      setProjects: state.setProjects,
      setActiveProject: state.setActiveProject,
      setActiveInterface: state.setActiveInterface,
      setActiveTab: state.setActiveTab,
      resetState: state.resetState,
      
      // Granular entity update actions
      updateProject: state.updateProject,
      updateInterface: state.updateInterface,
      updateTab: state.updateTab,
      updateTile: state.updateTile
    }))
  );
  
  const initialStateRef = useRef(initialState);
  
  useEffect(() => {
    // Only process updates if initialState has changed
    if (initialStateRef.current === initialState) {
      return;
    }
    
    const prevState = initialStateRef.current;
    
    // Check for major differences to determine if full reset is needed
    const needsFullReset = !prevState 
      || !initialState
      || !prevState.activeProjectId 
      || prevState.activeProjectId !== initialState.activeProjectId;
    
    if (needsFullReset) {
      // Do a full state reset
      storeActions.resetState(initialState);
      initialStateRef.current = initialState;
      return;
    }
    
    // Apply granular updates based on what has changed
    applyGranularUpdates(prevState, initialState, storeActions);
    
    // Update ref to current state
    initialStateRef.current = initialState;
  }, [initialState]);
  
  return null; // This component doesn't render anything
}

/**
 * Apply granular updates to the store based on what has changed
 */
function applyGranularUpdates(
  prevState: Partial<IStoreState>,
  newState: Partial<IStoreState>,
  actions: any
) {
  // Update global navigation state
  if (prevState.activeProjectId !== newState.activeProjectId && newState.activeProjectId) {
    actions.setActiveProject(newState.activeProjectId);
  }
  
  if (prevState.activeInterfaceId !== newState.activeInterfaceId && newState.activeInterfaceId) {
    actions.setActiveInterface(newState.activeInterfaceId);
  }
  
  if (prevState.activeTabId !== newState.activeTabId && newState.activeTabId) {
    const interfaceId = newState.activeInterfaceId || '';
    actions.setActiveTab(interfaceId, newState.activeTabId);
  }
  
  // Update projects list if changed
  if (prevState.projects !== newState.projects && newState.projects) {
    if (!shallow(prevState.projects || [], newState.projects)) {
      actions.setProjects(newState.projects);
    }
  }
  
  // Update entity collections using granular update methods
  updateProjectsCollection(
    prevState.projectsById, 
    newState.projectsById, 
    actions.updateProject
  );
  
  updateInterfacesCollection(
    prevState.interfacesById, 
    newState.interfacesById, 
    actions.updateInterface
  );
  
  updateTabsCollection(
    prevState.tabsById, 
    newState.tabsById, 
    actions.updateTab
  );
  
  updateTilesCollection(
    prevState.tilesById, 
    newState.tilesById, 
    actions.updateTile
  );
}

/**
 * Update projects collection using granular updateProject action
 * This leverages the internal optimizations of updateProject
 */
function updateProjectsCollection(
  prevCollection: Record<string, any> | undefined,
  newCollection: Record<string, any> | undefined,
  updateProject: (projectId: string, updates: any) => void
) {
  if (!prevCollection || !newCollection) {
    return;
  }

  // Get all keys from both collections
  const allKeys = new Set([
    ...Object.keys(prevCollection),
    ...Object.keys(newCollection)
  ]);
  
  // Iterate through all projects and update changed ones
  for (const projectId of Array.from(allKeys)) {
    const prevProject = prevCollection[projectId];
    const newProject = newCollection[projectId];
    
    // Skip if the project is the same reference or if it was removed (handled elsewhere)
    if (prevProject === newProject || (!newProject && prevProject)) {
      continue;
    }
    
    // If we have a new project or the project changed, update it
    if (newProject && (!prevProject || !shallow(prevProject, newProject))) {
      updateProject(projectId, newProject);
    }
  }
}

/**
 * Update interfaces collection using granular updateInterface action
 * This leverages the internal optimizations of updateInterface
 */
function updateInterfacesCollection(
  prevCollection: Record<string, any> | undefined,
  newCollection: Record<string, any> | undefined,
  updateInterface: (interfaceId: string, updates: any) => void
) {
  if (!prevCollection || !newCollection) {
    return;
  }

  // Get all keys from both collections
  const allKeys = new Set([
    ...Object.keys(prevCollection), 
    ...Object.keys(newCollection)
  ]);
  
  // Iterate through all interfaces and update changed ones
  for (const interfaceId of Array.from(allKeys)) {
    const prevInterface = prevCollection[interfaceId];
    const newInterface = newCollection[interfaceId];
    
    // Skip if the interface is the same reference or if it was removed (handled elsewhere)
    if (prevInterface === newInterface || (!newInterface && prevInterface)) {
      continue;
    }
    
    // If we have a new interface or the interface changed, update it
    if (newInterface && (!prevInterface || !shallow(prevInterface, newInterface))) {
      updateInterface(interfaceId, newInterface);
    }
  }
}

/**
 * Update tabs collection using granular updateTab action
 * This leverages the internal optimizations of updateTab
 */
function updateTabsCollection(
  prevCollection: Record<string, any> | undefined,
  newCollection: Record<string, any> | undefined,
  updateTab: (tabId: string, updates: any) => void
) {
  if (!prevCollection || !newCollection) {
    return;
  }

  // Get all keys from both collections
  const allKeys = new Set([
    ...Object.keys(prevCollection), 
    ...Object.keys(newCollection)
  ]);
  
  // Iterate through all tabs and update changed ones
  for (const tabId of Array.from(allKeys)) {
    const prevTab = prevCollection[tabId];
    const newTab = newCollection[tabId];
    
    // Skip if the tab is the same reference or if it was removed (handled elsewhere)
    if (prevTab === newTab || (!newTab && prevTab)) {
      continue;
    }
    
    // If we have a new tab or the tab changed, update it
    if (newTab && (!prevTab || !shallow(prevTab, newTab))) {
      updateTab(tabId, newTab);
    }
  }
}

/**
 * Update tiles collection using granular updateTile action
 * This leverages the internal optimizations of updateTile
 */
function updateTilesCollection(
  prevCollection: Record<string, any> | undefined,
  newCollection: Record<string, any> | undefined,
  updateTile: (tileId: string, updates: any) => void
) {
  if (!prevCollection || !newCollection) {
    return;
  }

  // Get all keys from both collections
  const allKeys = new Set([
    ...Object.keys(prevCollection), 
    ...Object.keys(newCollection)
  ]);
  
  // Iterate through all tiles and update changed ones
  for (const tileId of Array.from(allKeys)) {
    const prevTile = prevCollection[tileId];
    const newTile = newCollection[tileId];
    
    // Skip if the tile is the same reference or if it was removed (handled elsewhere)
    if (prevTile === newTile || (!newTile && prevTile)) {
      continue;
    }
    
    // If we have a new tile or the tile changed, update it
    if (newTile && (!prevTile || !shallow(prevTile, newTile))) {
      updateTile(tileId, newTile);
    }
  }
}

export default StoreUpdater;