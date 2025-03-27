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
 * @param interfaceName The name of the interface to access
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing interface metadata, actions, and related IDs
 */
export function useInterfaceMeta(interfaceName: string | null, projectName?: string | null) {
  // Get active project ID if not provided
  const activeProjectId = useStoreContext(state => 
    projectName ? projectName : state.activeProjectId
  );

  // Construct hierarchical ID if needed
  const interfaceId = useMemo(() => {
    if (!interfaceName) return null;
    
    // Check if the interfaceId already has the hierarchical format
    if (interfaceName.includes('>')) {
      return interfaceName;
    }
    
    // Otherwise, construct it
    return activeProjectId ? `${activeProjectId}>${interfaceName}` : interfaceName;
  }, [interfaceName, activeProjectId]);

  // Check if the interface exists
  const interfaceExists = useStoreContext(state => {
    if (!interfaceId || !activeProjectId) return false;
    return !!state.interfacesById[interfaceId];
  });

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