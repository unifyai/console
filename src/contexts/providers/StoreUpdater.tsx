"use client";

import { useEffect, useRef } from 'react';
import { IStoreState } from '../store';
import { useStoreContext } from './StoreProvider';
import { useShallow } from 'zustand/react/shallow';
import isEqual from 'fast-deep-equal';
// import { OPERATIONS } from '../utils/asyncUtils';

// Component to handle store updates when initialState changes
function StoreUpdater({ initialState }: { initialState: Partial<IStoreState> }) {
  const storeActions = useStoreContext(
    useShallow(state => ({
      // Global actions
      setProjects: state.setProjects,
      setActiveProject: state.setActiveProject,
      setActiveInterface: state.setActiveInterface,
      setActiveTab: state.setActiveTab,
      resetState: state.resetState,
      
      // Granular entity update actions
      updateProject: state.updateProject,
      updateInterface: state.updateInterface,
      updateTab: state.updateTab,
      updateTile: state.updateTile,
      
      // Async tracking actions
      // trackOperation: state.trackOperation,
    }))
  );
  
  // Get the resetting state of the active tab
  const resetting = useStoreContext(state => state.tabsById?.[state.activeTabId || ""]?.resetting);

  // // Get operations separately to avoid unnecessary re-renders
  // const operations = useStoreContext(state => state.operations);
  
  const initialStateRef = useRef(initialState);
  // const operationsRef = useRef(operations);
  
  useEffect(() => {
    // Only process updates if initialState has changed
    if (initialStateRef.current === initialState) {
      return;
    }
    
    // // Create an operation ID for this update
    // const updateOpId = OPERATIONS.STORE_UPDATE(Date.now());
    
    // // Track the operation
    // storeActions.trackOperation(updateOpId, 'pending');
    
    try {
      const prevState = initialStateRef.current;
      
      // Check if this is a server-side reload by looking for the stateSource property
      const isServerReload = (initialState as any)?.stateSource === 'server';
      
      // Check for major differences to determine if full reset is needed
      const needsFullReset = !prevState 
        || !initialState
        || !prevState.activeProjectId 
        || prevState.activeProjectId !== initialState.activeProjectId
        || resetting;
      
      if (needsFullReset) {
        // Reset the entire state
        storeActions.resetState(initialState);
        initialStateRef.current = initialState;
        // storeActions.trackOperation(updateOpId, 'success');
        return;
      }

      if (isServerReload) {
        // Apply granular updates for server-side reloads
        applyGranularUpdates(prevState, initialState, storeActions);
      } else {
        // For client-side mutations, just update the entire state
        // This avoids processing unnecessary granular updates
        const stateWithoutSource = { ...initialState };
        delete (stateWithoutSource as any).stateSource;
        storeActions.resetState(stateWithoutSource);
      }
      
      // Update ref to current state
      initialStateRef.current = initialState;
      
      // // Mark operation as successful
      // storeActions.trackOperation(updateOpId, 'success');
    } catch (error) {
      // // Mark operation as failed
      // storeActions.trackOperation(
      //   updateOpId, 
      //   'error', 
      //   error instanceof Error ? error.message : String(error)
      // );
      console.error('Error updating store:', error);
    }
  }, [initialState, storeActions]);
  
  // // Update the operations ref when operations change
  // // This allows us to preserve operations during resets
  // // but doesn't cause the main effect to re-run
  // useEffect(() => {
  //   // Only process updates if initialState has changed
  //   if (operationsRef.current === operations) {
  //     return;
  //   }
  //   operationsRef.current = operations;
  // }, [operations]);
  
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
    if (!isEqual(prevState.projects || [], newState.projects)) {
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
    if (newProject && (!prevProject || !isEqual(prevProject, newProject))) {
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
    if (newInterface && (!prevInterface || !isEqual(prevInterface, newInterface))) {
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
    if (newTab && (!prevTab || !isEqual(prevTab, newTab))) {
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
    if (newTile && (!prevTile || !isEqual(prevTile, newTile))) {
      updateTile(tileId, newTile);
    }
  }
}

export default StoreUpdater;