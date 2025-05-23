import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { InterfaceMeta } from '../../slices/selectors/interface';

// Define stable fallback references
const EMPTY_TAB_NAMES: string[] = [];

/**
 * Interface for interface-related meta actions
 */
export interface InterfaceMetaActions {
  setName: (name: string) => void;
}

/**
 * Custom hook to access interface metadata and related actions
 * @param interfaceIdOrName The ID or name of the interface to access
 * @param projectIdOrName Optional project ID or name
 * @returns Object containing interface metadata, actions, and related IDs
 */
export function useInterfaceMeta(interfaceIdOrName: string | null, projectIdOrName?: string | null) {
  // Get active project ID if not provided
  const activeProjectId = useStoreContext(state => 
    projectIdOrName ? projectIdOrName : state.activeProjectId
  );

  // First attempt: Look for the interface directly by ID
  const interfaceInStoreById = useStoreContext(state => {
    if (!interfaceIdOrName) return null;
    return state.interfacesById[interfaceIdOrName] || null;
  });

  // Second attempt: Find the interface by project + name combination
  const interfaceInStoreByName = useStoreContext(state => {
    if (!interfaceIdOrName || !activeProjectId || interfaceInStoreById) return null;
    
    // Find interface with matching name and project ID
    return Object.values(state.interfacesById).find(
      iface => iface.name === interfaceIdOrName && iface.projectId === activeProjectId
    ) || null;
  });

  // Determine the interface ID based on lookup results
  const interfaceId = useMemo(() => {
    if (!interfaceIdOrName) return null;
    if (interfaceInStoreById) return interfaceIdOrName;
    return interfaceInStoreByName?.id || null;
  }, [interfaceIdOrName, interfaceInStoreById, interfaceInStoreByName]);

  // Check if the interface exists
  const interfaceExists = !!interfaceId && !!(interfaceInStoreById || interfaceInStoreByName);

  // Granular subscriptions to Meta properties
  const id = interfaceId;
  
  const name = useStoreContext(state => {
    if (!interfaceExists || !interfaceId) return null;
    return state.interfacesById[interfaceId].name;
  });

  const tabNames = useStoreContext(state => {
    if (!interfaceExists || !interfaceId) return EMPTY_TAB_NAMES;
    return state.interfacesById[interfaceId].tabNames;
  });

  // Get store actions for meta updates
  const storeUpdateInterface = useStoreContext(state => state.updateInterface);

  // Memoize the metadata object to prevent unnecessary rerenders
  const meta = useMemo<Partial<InterfaceMeta> | null>(() => {
    if (!interfaceExists) return null;
    
    return {
      id: id!,
      name: name!,
      tabNames: tabNames
    };
  }, [interfaceExists, id, name, tabNames]);

  // Memoize the meta actions to prevent unnecessary re-renders
  const metaActions = useMemo<InterfaceMetaActions>(() => ({
    setName: (name) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(interfaceId, { name });
      }
    }
  }), [activeProjectId, interfaceId, storeUpdateInterface]);

  return {
    meta,
    metaActions,
    interfaceId,
    activeProjectId,
    interfaceExists
  };
} 