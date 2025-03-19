import { Interface } from "./interface";
import { Context } from "@/types/evals/grid";

// Project metadata - core identifying information
export interface ProjectMeta {
  id: string | null;
  name: string | null;
  // createdAt: string;
  // updatedAt: string;
}

// Project data - business data and relationships
export interface ProjectData {
  description: string;
  contexts: Context[];
  interfaceIds: string[]; // References to interfaces instead of containing them directly
}

// Project UI state - UI-related state
export interface ProjectUI {
  activeInterfaceId: string | null;
}

// Combined Project state definition
export interface Project extends ProjectMeta, ProjectData, ProjectUI {}

/**
 * Initialize a new project
 */
export function initProject(projectId: string, initialState: Partial<Project> = {}): Project {
  return {
    // Meta
    id: projectId,
    name: initialState.name || null,
    // createdAt: initialState.createdAt || new Date().toISOString(),
    // updatedAt: initialState.updatedAt || new Date().toISOString(),
    
    // Data
    description: initialState.description || "",
    contexts: initialState.contexts || [],
    interfaceIds: initialState.interfaceIds || [],
    
    // UI
    activeInterfaceId: initialState.activeInterfaceId || null,
    
    ...initialState,
  };
}

/**
 * Update an existing project
 */
export function updateProject(project: Project, updates: Partial<Project>): Project {
  return {
    ...project,
    ...updates,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Set a specific property of a project
 */
export function setProjectProperty<K extends keyof Project>(
  project: Project, 
  property: K, 
  value: Project[K]
): Project {
  return {
    ...project,
    [property]: value,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Add an interface to a project
 */
export function addInterfaceId(project: Project, interfaceId: string): Project {
  // If the interface already exists in the project, don't add it again
  if (project.interfaceIds.includes(interfaceId)) {
    return project;
  }
  
  // Create a new array with the new interface ID
  const interfaceIds = [...project.interfaceIds, interfaceId];
  
  // Return the updated project
  return {
    ...project,
    interfaceIds,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Remove an interface from a project
 */
export function removeInterfaceId(project: Project, interfaceId: string): Project {
  // Filter out the interface ID to remove
  const interfaceIds = project.interfaceIds.filter(id => id !== interfaceId);
  
  // Update the active interface if needed
  let activeInterfaceId = project.activeInterfaceId;
  if (project.activeInterfaceId === interfaceId) {
    activeInterfaceId = interfaceIds.length > 0 ? interfaceIds[0] : null;
  }
  
  // Return the updated project
  return {
    ...project,
    interfaceIds,
    activeInterfaceId,
    // updatedAt: new Date().toISOString()
  };
}

/**
 * Set the active interface for a project
 */
export function setActiveInterface(project: Project, interfaceId: string | null): Project {
  return {
    ...project,
    activeInterfaceId: interfaceId,
    //updatedAt: new Date().toISOString()
  };
} 