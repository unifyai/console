import { useMemo, useRef } from 'react';
import { useStoreContext } from '../providers/StoreProvider';
import { useShallow } from 'zustand/react/shallow';
import { shallow } from 'zustand/vanilla/shallow';
import { Project } from '../slices/selectors/project';
import { Interface } from '../slices/selectors/interface';
import { Tab } from '../slices/selectors/tab';
import { Tile } from '../slices/selectors/tile';

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
 * Helper function to set a nested property in an object using dot notation
 * e.g., setNestedProperty({}, "a.b.c", "value") will return { a: { b: { c: "value" } } }
 */
function setNestedProperty(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    } else if (typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
}

/**
 * Helper function to filter object properties based on a list of property names
 * Supports nested properties using dot notation (e.g., "a.b.c")
 */
function filterObjectProps<T extends object>(obj: T, props: string[] = []): Partial<T> {
  if (!props.length) return obj;
  
  const result = {} as any;
  
  props.forEach(prop => {
    if (prop.includes('.')) {
      // Handle nested properties
      const value = getNestedProperty(obj, prop);
      if (value !== undefined) {
        setNestedProperty(result, prop, value);
      }
    } else if (prop in obj) {
      // Handle top-level properties
      result[prop] = obj[prop as keyof T];
    }
  });
  
  return result;
}

/**
 * Custom hook to provide simplified access to store data with optimized selectors.
 * This hook eliminates the need to directly use useStoreContext in components
 * and provides memoized access to common data patterns.
 */
export function useStore() {
  // Access the store selectors directly for values
  const projects = useStoreContext(useShallow(state => state.projectsById));
  const interfaces = useStoreContext(useShallow(state => state.interfacesById));
  const tabs = useStoreContext(useShallow(state => state.tabsById));
  const tiles = useStoreContext(useShallow(state => state.tilesById));
  const projectNames = useStoreContext(useShallow(state => state.projects));
  
  // Active IDs
  const activeProjectId = useStoreContext(state => state.activeProjectId);
  const activeInterfaceId = useStoreContext(state => state.activeInterfaceId);
  const activeTabId = useStoreContext(state => state.activeTabId);
  
  // Actions
  const setProjects = useStoreContext(state => state.setProjects);

  // Refs for memoization with shallow equality checks
  const projectsRef = useRef(projects);
  const interfacesRef = useRef(interfaces);
  const tabsRef = useRef(tabs);
  const tilesRef = useRef(tiles);
  const projectNamesRef = useRef(projectNames);
  const activeProjectIdRef = useRef(activeProjectId);
  const activeInterfaceIdRef = useRef(activeInterfaceId);
  const activeTabIdRef = useRef(activeTabId);
  
  // Cache refs for all getter functions
  const projectByIdCacheRef = useRef(new Map<string, Partial<Project>>());
  const projectsListCacheRef = useRef(new Map<string, Partial<Project>[]>());
  const interfaceByIdCacheRef = useRef(new Map<string, Partial<Interface>>());
  const interfacesListCacheRef = useRef(new Map<string, Partial<Interface>[]>());
  const tabByIdCacheRef = useRef(new Map<string, Partial<Tab>>());
  const tabsListCacheRef = useRef(new Map<string, Partial<Tab>[]>());
  const tileByIdCacheRef = useRef(new Map<string, Partial<Tile>>());
  const tilesListCacheRef = useRef(new Map<string, Partial<Tile>[]>());
  const logLengthsRef = useRef<Record<string, number>>({});

  // Update refs if values changed (using shallow comparison)
  if (!shallow(projectsRef.current, projects)) {
    projectsRef.current = projects;
    // Clear caches when projects data changes
    projectByIdCacheRef.current.clear();
    projectsListCacheRef.current.clear();
  }
  if (!shallow(interfacesRef.current, interfaces)) {
    interfacesRef.current = interfaces;
    // Clear caches when interfaces data changes
    interfaceByIdCacheRef.current.clear();
    interfacesListCacheRef.current.clear();
  }
  if (!shallow(tabsRef.current, tabs)) {
    tabsRef.current = tabs;
    // Clear caches when tabs data changes
    tabByIdCacheRef.current.clear();
    tabsListCacheRef.current.clear();
  }
  if (!shallow(tilesRef.current, tiles)) {
    tilesRef.current = tiles;
    // Clear caches when tiles data changes
    tileByIdCacheRef.current.clear();
    tilesListCacheRef.current.clear();
    // Reset log lengths cache too
    logLengthsRef.current = {};
  }
  if (!shallow(projectNamesRef.current, projectNames)) projectNamesRef.current = projectNames;
  if (activeProjectIdRef.current !== activeProjectId) activeProjectIdRef.current = activeProjectId;
  if (activeInterfaceIdRef.current !== activeInterfaceId) activeInterfaceIdRef.current = activeInterfaceId;
  if (activeTabIdRef.current !== activeTabId) activeTabIdRef.current = activeTabId;

  // Project getters
  const getProjectById = useMemo(() => {
    return (projectId: string | null, props: string[] = []): Partial<Project> | null => {
      if (!projectId) return null;
      
      const project = projectsRef.current[projectId] || null;
      if (!project) return null;
      
      // Generate a cache key from the projectId and props
      // Create a copy of props before sorting to avoid modifying read-only arrays
      const cacheKey = `${projectId}-${[...props].sort().join(',')}`;
      
      // Check if we have a cached result
      if (projectByIdCacheRef.current.has(cacheKey)) {
        return projectByIdCacheRef.current.get(cacheKey) || null;
      }
      
      // Filter the properties
      const result = filterObjectProps(project, props);
      
      // Cache the result
      projectByIdCacheRef.current.set(cacheKey, result);
      
      return result;
    };
  }, []);

  const getProjects = useMemo(() => {
    return (projectIds: string[] = [], props: string[] = []): Partial<Project>[] => {
      // If no specific project IDs provided, use all projects
      const targetIds = projectIds.length ? projectIds : Object.keys(projectsRef.current);
      
      // Generate a cache key
      // Create copies of arrays before sorting to avoid modifying read-only arrays
      const cacheKey = `${[...targetIds].sort().join(',')}-${[...props].sort().join(',')}`;
      
      // Check if we have a cached result
      if (projectsListCacheRef.current.has(cacheKey)) {
        return projectsListCacheRef.current.get(cacheKey) || [];
      }
      
      // Filter projects by IDs and then by properties
      const result = targetIds
        .filter(id => projectsRef.current[id])
        .map(id => filterObjectProps(projectsRef.current[id], props));
      
      // Cache the result
      projectsListCacheRef.current.set(cacheKey, result);
      
      return result;
    };
  }, []);

  const getProjectsNames = useMemo(() => {
    return (): string[] => projectNamesRef.current;
  }, []);

  const setProjectsNames = useMemo(() => {
    return (projectNames: string[]): void => {
      setProjects(projectNames);
    };
  }, [setProjects]);

  // Interface getters
  const getInterfaceById = useMemo(() => {
    return (interfaceId: string | null, props: string[] = []): Partial<Interface> | null => {
      if (!interfaceId) return null;
      
      const interfaceObj = interfacesRef.current[interfaceId] || null;
      if (!interfaceObj) return null;
      
      // Generate a cache key
      // Create a copy of props before sorting to avoid modifying read-only arrays
      const cacheKey = `${interfaceId}-${[...props].sort().join(',')}`;
      
      // Check if we have a cached result
      if (interfaceByIdCacheRef.current.has(cacheKey)) {
        return interfaceByIdCacheRef.current.get(cacheKey) || null;
      }
      
      // Filter the properties
      const result = filterObjectProps(interfaceObj, props);
      
      // Cache the result
      interfaceByIdCacheRef.current.set(cacheKey, result);
      
      return result;
    };
  }, []);

  const getInterfaces = useMemo(() => {
    return (interfaceIds: string[] = [], props: string[] = []): Partial<Interface>[] => {
      // If no specific interface IDs provided, use all interfaces
      const targetIds = interfaceIds.length ? interfaceIds : Object.keys(interfacesRef.current);
      
      // Generate a cache key
      // Create copies of arrays before sorting to avoid modifying read-only arrays
      const cacheKey = `${[...targetIds].sort().join(',')}-${[...props].sort().join(',')}`;
      
      // Check if we have a cached result
      if (interfacesListCacheRef.current.has(cacheKey)) {
        return interfacesListCacheRef.current.get(cacheKey) || [];
      }
      
      // Filter interfaces by IDs and then by properties
      const result = targetIds
        .filter(id => interfacesRef.current[id])
        .map(id => filterObjectProps(interfacesRef.current[id], props));
      
      // Cache the result
      interfacesListCacheRef.current.set(cacheKey, result);
      
      return result;
    };
  }, []);

  // Tab getters
  const getTabById = useMemo(() => {
    return (tabId: string | null, props: string[] = []): Partial<Tab> | null => {
      if (!tabId) return null;
      
      const tab = tabsRef.current[tabId] || null;
      if (!tab) return null;
      
      // Generate a cache key
      // Create a copy of props before sorting to avoid modifying read-only arrays
      const cacheKey = `${tabId}-${[...props].sort().join(',')}`;
      
      // Check if we have a cached result
      if (tabByIdCacheRef.current.has(cacheKey)) {
        return tabByIdCacheRef.current.get(cacheKey) || null;
      }
      
      // Filter the properties
      const result = filterObjectProps(tab, props);
      
      // Cache the result
      tabByIdCacheRef.current.set(cacheKey, result);
      
      return result;
    };
  }, []);

  const getTabs = useMemo(() => {
    return (tabIds: string[] = [], props: string[] = []): Partial<Tab>[] => {
      // If no specific tab IDs provided, use all tabs
      const targetIds = tabIds.length ? tabIds : Object.keys(tabsRef.current);
      
      // Generate a cache key
      // Create copies of arrays before sorting to avoid modifying read-only arrays
      const cacheKey = `${[...targetIds].sort().join(',')}-${[...props].sort().join(',')}`;
      
      // Check if we have a cached result
      if (tabsListCacheRef.current.has(cacheKey)) {
        return tabsListCacheRef.current.get(cacheKey) || [];
      }
      
      // Filter tabs by IDs and then by properties
      const result = targetIds
        .filter(id => tabsRef.current[id])
        .map(id => filterObjectProps(tabsRef.current[id], props));
      
      // Cache the result
      tabsListCacheRef.current.set(cacheKey, result);
      
      return result;
    };
  }, []);

  // Tile getters
  const getTileById = useMemo(() => {
    return (tileId: string | null, props: string[] = []): Partial<Tile> | null => {
      if (!tileId) return null;
      
      const tile = tilesRef.current[tileId] || null;
      if (!tile) return null;
      
      // Generate a cache key
      // Create a copy of props before sorting to avoid modifying read-only arrays
      const cacheKey = `${tileId}-${[...props].sort().join(',')}`;
      
      // Check if we have a cached result
      if (tileByIdCacheRef.current.has(cacheKey)) {
        return tileByIdCacheRef.current.get(cacheKey) || null;
      }
      
      // Filter the properties
      const result = filterObjectProps(tile, props);
      
      // Cache the result
      tileByIdCacheRef.current.set(cacheKey, result);
      
      return result;
    };
  }, []);

  // Function to get multiple tiles by their IDs
  const getTiles = useMemo(() => {
    return (tileIds: string[] = [], props: string[] = []): Partial<Tile>[] => {
      // If no specific tile IDs provided, use all tiles
      const targetIds = tileIds.length ? tileIds : Object.keys(tilesRef.current);
      
      // Generate a cache key
      // Create copies of arrays before sorting to avoid modifying read-only arrays
      const cacheKey = `${[...targetIds].sort().join(',')}-${[...props].sort().join(',')}`;
      
      // Check if we have a cached result
      if (tilesListCacheRef.current.has(cacheKey)) {
        return tilesListCacheRef.current.get(cacheKey) || [];
      }
      
      // Filter tiles by IDs and then by properties
      const result = targetIds
        .filter(id => tilesRef.current[id])
        .map(id => filterObjectProps(tilesRef.current[id], props));
      
      // Cache the result
      tilesListCacheRef.current.set(cacheKey, result);
      
      return result;
    };
  }, []);

  // Function to get log lengths for all table tiles
  const getLogLengths = useMemo(() => {
    return (): Record<string, number> => {
      // If we have cached log lengths and the tiles haven't changed, return cached value
      if (Object.keys(logLengthsRef.current).length > 0) {
        return logLengthsRef.current;
      }
      
      // Calculate the new result
      const newResult = Object.values(tilesRef.current).reduce((acc: Record<string, number>, tile: Tile) => {
        if (tile && tile.type === 'Table' && tile.name) {
          acc[tile.name] = tile.tableTile?.tableDataItem?.logs?.length || 0;
        }
        return acc;
      }, {});
      
      // Store the result
      logLengthsRef.current = newResult;
      
      return newResult;
    };
  }, []);

  // Active ID getters
  const getActiveProjectId = useMemo(() => {
    return (): string | null => activeProjectIdRef.current;
  }, []);

  const getActiveInterfaceId = useMemo(() => {
    return (): string | null => activeInterfaceIdRef.current;
  }, []);

  const getActiveTabId = useMemo(() => {
    return (): string | null => activeTabIdRef.current;
  }, []);

  return {
    // Project getters
    getProjectById,
    getProjects,
    getProjectsNames,
    setProjectsNames,
    
    // Interface getters
    getInterfaceById,
    getInterfaces,
    
    // Tab getters
    getTabById,
    getTabs,
    
    // Tile getters
    getTileById,
    getTiles,
    
    // Active ID getters
    getActiveProjectId,
    getActiveInterfaceId,
    getActiveTabId,

    // Log length getters
    getLogLengths,
  };
} 