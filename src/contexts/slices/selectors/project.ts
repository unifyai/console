import { Interface } from "./interface";
import { Context } from "@/types/evals/grid";

// Project state definition
export interface Project {
  id: string | null;
  name: string | null;
  description: string;
  createdAt: string;
  updatedAt: string;
  contexts: Context[];
  activeInterfaceId: string | null;
  interfaces: Record<string, Interface>; // Child interfaces indexed by ID
}

/**
 * Initialize a new project
 */
export function initProject(projectId: string, initialState: Partial<Project> = {}): Project {
  return {
    id: projectId,
    name: initialState.name || null,
    description: initialState.description || "",
    createdAt: initialState.createdAt || new Date().toISOString(),
    updatedAt: initialState.updatedAt || new Date().toISOString(),
    activeInterfaceId: initialState.activeInterfaceId || null,
    contexts: initialState.contexts || [],
    interfaces: initialState.interfaces || {},
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
    updatedAt: new Date().toISOString()
  };
}

/**
 * Set a specific property on a project
 */
export function setProjectProperty<K extends keyof Project>(
  project: Project, 
  property: K, 
  value: Project[K]
): Project {
  return {
    ...project,
    [property]: value,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Add an interface to a project
 */
export function addInterface(project: Project, interfaceId: string, iface: Interface): Project {
  if (!project.interfaces) {
    project.interfaces = {};
  }
  
  return {
    ...project,
    interfaces: {
      ...project.interfaces,
      [interfaceId]: iface
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Remove an interface from a project
 */
export function removeInterface(project: Project, interfaceId: string): Project {
  if (project.interfaces && project.interfaces[interfaceId]) {
    const newInterfaces = { ...project.interfaces };
    delete newInterfaces[interfaceId];
    
    return {
      ...project,
      interfaces: newInterfaces,
      activeInterfaceId: project.activeInterfaceId === interfaceId ? null : project.activeInterfaceId,
      updatedAt: new Date().toISOString()
    };
  }
  return project;
}

/**
 * Set the active interface for a project
 */
export function setActiveInterface(project: Project, interfaceId: string | null): Project {
  return {
    ...project,
    activeInterfaceId: interfaceId,
    updatedAt: new Date().toISOString()
  };
} 