import { useMemo } from 'react';
import { useStoreContext } from '../providers/StoreProvider';
import { useShallow } from 'zustand/react/shallow';
import { Project } from '../slices/selectors/project';
import { Interface } from '../slices/selectors/interface';
import { Tab } from '../slices/selectors/tab';
import { Tile } from '../slices/selectors/tile';

// Define stable fallback references
const EMPTY_PROJECTS: string[] = [];
const EMPTY_TILES: Partial<Tile>[] = [];
const EMPTY_PROJECTS_ARRAY: Partial<Project>[] = [];
const EMPTY_INTERFACES_ARRAY: Partial<Interface>[] = [];
const EMPTY_TABS_ARRAY: Partial<Tab>[] = [];
const EMPTY_RECORD: Record<string, number> = {};

/**
 * Helper function to get a nested property from an object using dot notation
 * e.g., getNestedProperty(obj, "a.b.c") will return obj.a.b.c
 */
function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((prev, curr) => {
    return prev && typeof prev === 'object' ? prev[curr] : undefined;
  }, obj);
}

/**
 * Core hook that provides direct access to common store selectors
 */
export function useStore() {
  // Basic store access functions - simplified and focused
  return {
    // Active state getters - use these when you only need the active IDs
    useActiveIds: () => {
      // Step 1: Subscribe to raw state
      const activeIds = useStoreContext(
        useShallow(state => ({
          projectId: state.activeProjectId,
          interfaceId: state.activeInterfaceId,
          tabId: state.activeTabId
        }))
      );
      
      // Step 2: Memoize the result (simpler than other hooks since no transformation needed)
      return useMemo(() => activeIds, [activeIds]);
    },

    // Simple selectors for lists
    useProjectNames: () => {
      // Step 1: Subscribe to raw state
      const projectNames = useStoreContext(
        useShallow(state => state.projects || EMPTY_PROJECTS)
      );
      
      // Step 2: Memoize the result (simpler than other hooks since no transformation needed)
      return useMemo(() => projectNames, [projectNames]);
    },
    
    // Common store actions
    useSetProjects: () => useStoreContext(state => state.setProjects),
    useSetActiveProject: () => useStoreContext(state => state.setActiveProject),
    useSetActiveInterface: () => useStoreContext(state => state.setActiveInterface),
    useSetActiveTab: () => useStoreContext(state => state.setActiveTab),
  };
}

/**
 * Hook to get properties of a specific project
 */
export function useProjectProperties(projectId: string | undefined, properties: string[] = []): Partial<Project> | undefined {
  // Step 1: Subscribe to raw project data using useShallow
  const project = useStoreContext(
    useShallow(state => {
      if (!projectId || !state.projectsById[projectId]) return undefined;
      return state.projectsById[projectId];
    })
  );
  
  // Step 2: Memoize the transformation of raw data
  return useMemo(() => {
    if (!project) return undefined;
    
    // If no specific properties requested, return the whole project
    if (!properties.length) return project;
    
    // Return only requested properties (including nested ones)
    const result: Record<string, any> = {};
    properties.forEach(prop => {
      const propPath = prop as string;
      if (propPath.includes('.')) {
        // Handle nested property
        const value = getNestedProperty(project, propPath);
        if (value !== undefined) {
          // For nested properties, only store the final property in the result
          const lastPart = propPath.split('.').pop() as string;
          result[lastPart] = value;
        }
      } else {
        // Handle top-level property
        result[prop] = project[prop as keyof Project];
      }
    });
    
    return result as Partial<Project>;
  }, [project, properties]);
}

/**
 * Hook to get a list of projects with specified properties
 */
export function useProjects(projectIds?: string[], properties?: string[]): Partial<Project>[] {
  // Step 1: Subscribe to raw data - both the project IDs and the projects themselves
  const { ids, rawProjectsById } = useStoreContext(
    useShallow(state => {
      // Determine which project IDs to use
      const idsToUse = projectIds?.length ? projectIds : state.projects;
      
      // Get the raw projects data
      const projectsData: Record<string, Project> = {};
      if (idsToUse?.length) {
        idsToUse.forEach(id => {
          if (state.projectsById[id]) {
            projectsData[id] = state.projectsById[id];
          }
        });
      }
      
      return {
        ids: idsToUse || EMPTY_PROJECTS,
        rawProjectsById: projectsData
      };
    })
  );
  
  // Step 2: Memoize the transformation of raw data
  return useMemo(() => {
    if (!ids?.length) return EMPTY_PROJECTS_ARRAY;
    
    const props = properties || [];
    
    // Map to projects with selected properties
    return ids
      .filter(id => rawProjectsById[id])
      .map(id => {
        const project = rawProjectsById[id];
        
        if (!props.length) return project;
        
        // Return only requested properties (including nested ones)
        const result: Record<string, any> = {};
        props.forEach(prop => {
          const propPath = prop as string;
          if (propPath.includes('.')) {
            // Handle nested property
            const value = getNestedProperty(project, propPath);
            if (value !== undefined) {
              // For nested properties, only store the final property in the result
              const lastPart = propPath.split('.').pop() as string;
              result[lastPart] = value;
            }
          } else {
            // Handle top-level property
            result[prop] = project[prop as keyof Project];
          }
        });
        
        return result as Partial<Project>;
      });
  }, [ids, properties, rawProjectsById]);
}

/**
 * Hook to get properties of a specific interface
 */
export function useInterfaceProperties(interfaceId: string | undefined, properties: string[] = []): Partial<Interface> | undefined {
  // Step 1: Subscribe to raw interface data using useShallow
  const interfaceObj = useStoreContext(
    useShallow(state => {
      if (!interfaceId || !state.interfacesById[interfaceId]) return undefined;
      return state.interfacesById[interfaceId];
    })
  );
  
  // Step 2: Memoize the transformation of raw data
  return useMemo(() => {
    if (!interfaceObj) return undefined;
    
    // If no specific properties requested, return the whole interface
    if (!properties.length) return interfaceObj;
    
    // Return only requested properties (including nested ones)
    const result: Record<string, any> = {};
    properties.forEach(prop => {
      const propPath = prop as string;
      if (propPath.includes('.')) {
        // Handle nested property
        const value = getNestedProperty(interfaceObj, propPath);
        if (value !== undefined) {
          // For nested properties, only store the final property in the result
          const lastPart = propPath.split('.').pop() as string;
          result[lastPart] = value;
        }
      } else {
        // Handle top-level property
        result[prop] = interfaceObj[prop as keyof Interface];
      }
    });
    
    return result as Partial<Interface>;
  }, [interfaceObj, properties]);
}

/**
 * Hook to get a list of interfaces with specified properties
 */
export function useInterfaces(interfaceIds?: string[], properties?: string[]): Partial<Interface>[] {
  // Step 1: Subscribe to raw data - both interface IDs and interface objects
  const { ids, rawInterfacesById } = useStoreContext(
    useShallow(state => {
      // Determine which interface IDs to use
      const idsToUse = interfaceIds?.length 
        ? interfaceIds 
        : Object.keys(state.interfacesById);
      
      // Get the raw interfaces data
      const interfacesData: Record<string, Interface> = {};
      if (idsToUse?.length) {
        idsToUse.forEach(id => {
          if (state.interfacesById[id]) {
            interfacesData[id] = state.interfacesById[id];
          }
        });
      }
      
      return {
        ids: idsToUse || [],
        rawInterfacesById: interfacesData
      };
    })
  );
  
  // Step 2: Memoize the transformation of raw data
  return useMemo(() => {
    if (!ids?.length) return EMPTY_INTERFACES_ARRAY;
    
    const props = properties || [];
    
    // Map to interfaces with selected properties
    return ids
      .filter(id => rawInterfacesById[id])
      .map(id => {
        const interfaceObj = rawInterfacesById[id];
        
        if (!props.length) return interfaceObj;
        
        // Return only requested properties (including nested ones)
        const result: Record<string, any> = {};
        props.forEach(prop => {
          const propPath = prop as string;
          if (propPath.includes('.')) {
            // Handle nested property
            const value = getNestedProperty(interfaceObj, propPath);
            if (value !== undefined) {
              // For nested properties, only store the final property in the result
              const lastPart = propPath.split('.').pop() as string;
              result[lastPart] = value;
            }
          } else {
            // Handle top-level property
            result[prop] = interfaceObj[prop as keyof Interface];
          }
        });
        
        return result as Partial<Interface>;
      });
  }, [ids, properties, rawInterfacesById]);
}

/**
 * Hook to get properties of a specific tab
 */
export function useTabProperties(tabId: string | undefined, properties: string[] = []): Partial<Tab> | undefined {
  // Step 1: Subscribe to raw tab data using useShallow
  const tab = useStoreContext(
    useShallow(state => {
      if (!tabId || !state.tabsById[tabId]) return undefined;
      return state.tabsById[tabId];
    })
  );
  
  // Step 2: Memoize the transformation of raw data
  return useMemo(() => {
    if (!tab) return undefined;
    
    // If no specific properties requested, return the whole tab
    if (!properties.length) return tab;
    
    // Return only requested properties (including nested ones)
    const result: Record<string, any> = {};
    properties.forEach(prop => {
      const propPath = prop as string;
      if (propPath.includes('.')) {
        // Handle nested property
        const value = getNestedProperty(tab, propPath);
        if (value !== undefined) {
          // For nested properties, only store the final property in the result
          const lastPart = propPath.split('.').pop() as string;
          result[lastPart] = value;
        }
      } else {
        // Handle top-level property
        result[prop] = tab[prop as keyof Tab];
      }
    });
    
    return result as Partial<Tab>;
  }, [tab, properties]);
}

/**
 * Hook to get a list of tabs with specified properties
 */
export function useTabs(tabIds?: string[], properties?: string[]): Partial<Tab>[] {
  // Step 1: Subscribe to raw data - both tab IDs and tab objects
  const { ids, rawTabsById } = useStoreContext(
    useShallow(state => {
      // Determine which tab IDs to use
      const idsToUse = tabIds?.length 
        ? tabIds 
        : Object.keys(state.tabsById);
      
      // Get the raw tabs data
      const tabsData: Record<string, Tab> = {};
      if (idsToUse?.length) {
        idsToUse.forEach(id => {
          if (state.tabsById[id]) {
            tabsData[id] = state.tabsById[id];
          }
        });
      }
      
      return {
        ids: idsToUse || [],
        rawTabsById: tabsData
      };
    })
  );
  
  // Step 2: Memoize the transformation of raw data
  return useMemo(() => {
    if (!ids?.length) return EMPTY_TABS_ARRAY;
    
    const props = properties || [];
    
    // Map to tabs with selected properties
    return ids
      .filter(id => rawTabsById[id])
      .map(id => {
        const tab = rawTabsById[id];
        
        if (!props.length) return tab;
        
        // Return only requested properties (including nested ones)
        const result: Record<string, any> = {};
        props.forEach(prop => {
          const propPath = prop as string;
          if (propPath.includes('.')) {
            // Handle nested property
            const value = getNestedProperty(tab, propPath);
            if (value !== undefined) {
              // For nested properties, only store the final property in the result
              const lastPart = propPath.split('.').pop() as string;
              result[lastPart] = value;
            }
          } else {
            // Handle top-level property
            result[prop] = tab[prop as keyof Tab];
          }
        });
        
        return result as Partial<Tab>;
      });
  }, [ids, properties, rawTabsById]);
}

/**
 * Hook to get properties of a specific tile
 */
export function useTileProperties(tileId: string | undefined, properties: string[] = []): Partial<Tile> | undefined {
  // Step 1: Subscribe to raw tile data using useShallow
  const tile = useStoreContext(
    useShallow(state => {
      if (!tileId || !state.tilesById[tileId]) return undefined;
      return state.tilesById[tileId];
    })
  );
  
  // Step 2: Memoize the transformation of raw data
  return useMemo(() => {
    if (!tile) return undefined;
    
    // If no specific properties requested, return the whole tile
    if (!properties.length) return tile;
    
    // Return only requested properties (including nested ones)
    const result: Record<string, any> = {};
    properties.forEach(prop => {
      const propPath = prop as string;
      if (propPath.includes('.')) {
        // Handle nested property
        const value = getNestedProperty(tile, propPath);
        if (value !== undefined) {
          // For nested properties, only store the final property in the result
          const lastPart = propPath.split('.').pop() as string;
          result[lastPart] = value;
        }
      } else {
        // Handle top-level property
        result[prop] = tile[prop as keyof Tile];
      }
    });
    
    return result as Partial<Tile>;
  }, [tile, properties]);
}

/**
 * Hook to get multiple tiles by their IDs with selected properties
 */
export function useTiles(tileIds: string[] = [], properties: string[] = []): Partial<Tile>[] {
  // Step 1: Subscribe to raw tile data using useShallow for efficient store updates
  // This will only trigger re-renders when the relevant tiles change
  const rawTilesById = useStoreContext(
    useShallow(state => {
      // If no tileIds provided, return empty object to avoid unnecessary processing
      if (!tileIds.length) return {};
      
      // Extract only the specific tiles we care about to minimize subscriptions
      const result: Record<string, Tile> = {};
      for (const id of tileIds) {
        if (state.tilesById[id]) {
          result[id] = state.tilesById[id];
        }
      }
      return result;
    })
  );
  
  // Step 2: Memoize the transformation of raw data
  // This prevents creating new arrays/objects when inputs or data haven't changed
  return useMemo(() => {
    // If no IDs to process, return empty array (using stable reference)
    if (!tileIds.length) return EMPTY_TILES;
    
    // Transform raw data into the expected format
    return tileIds
      .filter(id => rawTilesById[id])
      .map(id => {
        const tile = rawTilesById[id];
        
        // If no specific properties requested, return the whole tile
        if (!properties.length) return tile;
        
        // Return only requested properties (including nested ones)
        const result: Record<string, any> = {};
        properties.forEach(prop => {
          const propPath = prop as string;
          if (propPath.includes('.')) {
            // Handle nested property
            const value = getNestedProperty(tile, propPath);
            if (value !== undefined) {
              // For nested properties, only store the final property in the result
              const lastPart = propPath.split('.').pop() as string;
              result[lastPart] = value;
            }
          } else {
            // Handle top-level property
            result[prop] = tile[prop as keyof Tile];
          }
        });
        
        return result as Partial<Tile>;
      });
  }, [tileIds, properties, rawTilesById]);
}

/**
 * Hook to get log lengths for all table tiles
 */
export function useLogLengths(): Record<string, number> {
  // Step 1: Subscribe to raw tile data using useShallow
  const tiles = useStoreContext(
    useShallow(state => {
      if (!state.tilesById || Object.keys(state.tilesById).length === 0) return null;
      return state.tilesById;
    })
  );
  
  // Step 2: Memoize the transformation of raw data
  return useMemo(() => {
    if (!tiles) return EMPTY_RECORD;
    
    return Object.values(tiles).reduce((acc: Record<string, number>, tile: Tile) => {
      if (tile && tile.type === 'Table' && tile.name) {
        acc[tile.name] = tile.tableTile?.tableDataItem?.logs?.length || 0;
      }
      return acc;
    }, {});
  }, [tiles]);
}
