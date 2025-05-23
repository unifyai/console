import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { Interface } from '../../slices/selectors/interface';
import { InterfaceMetaActions, useInterfaceMeta } from './useInterfaceMeta';
import { InterfaceDataActions, useInterfaceData } from './useInterfaceData';
import { InterfaceUIActions, useInterfaceUI } from './useInterfaceUI';

// Define the default return value
const DEFAULT_USE_INTERFACE_RETURN = {
  interface: null,
  meta: null,
  data: null,
  ui: null,
  metaActions: null,
  dataActions: null,
  uiActions: null,
  operationsActions: null,
  actions: null,
  exists: false,
  interfaceId: null
};

/**
 * Interface for all interface-related actions
 */
export interface InterfaceActions {
  // Basic interface management
  initInterface: (initialState?: Partial<Interface>) => void;
  updateInterface: (updates: Partial<Interface>) => void;
  removeInterface: () => void;

  // Categorized actions
  meta: InterfaceMetaActions;
  data: InterfaceDataActions;
  ui: InterfaceUIActions;
}

/**
 * Custom hook to access all interface state and actions
 * @param interfaceIdOrName The ID or name of the interface to access
 * @param projectIdOrName Optional project ID or name
 * @returns Object containing all interface state, actions, and existence flag
 */
export function useInterface(interfaceIdOrName: string | null, projectIdOrName?: string | null) {
  // Use specialized hooks
  const {
    meta,
    metaActions,
    interfaceId,
    activeProjectId,
    interfaceExists
  } = useInterfaceMeta(interfaceIdOrName, projectIdOrName);
  
  const {
    data,
    dataActions,
    tabIds,
    tabNames
  } = useInterfaceData(interfaceIdOrName, projectIdOrName);
  
  const {
    ui,
    uiActions,
    activeTabId
  } = useInterfaceUI(interfaceIdOrName, projectIdOrName);
  
  // const {
  //   operations,
  //   operationsActions
  // } = useInterfaceOperations(interfaceName, projectName);

  // Get store actions for core interface management
  const storeInitInterface = useStoreContext(state => state.initInterface);
  const storeUpdateInterface = useStoreContext(state => state.updateInterface);
  const storeRemoveInterface = useStoreContext(state => state.removeInterface);

  // Memoize all actions to prevent unnecessary re-renders
  const actions = useMemo<InterfaceActions>(() => {
    return {
      // Basic interface management
      initInterface: (initialState) => {
        if (activeProjectId && interfaceId) {
          storeInitInterface(activeProjectId, interfaceId, initialState);
        }
      },
      
      updateInterface: (updates) => {
        if (activeProjectId && interfaceId) {
          storeUpdateInterface(interfaceId, updates);
        }
      },
      
      removeInterface: () => {
        if (activeProjectId && interfaceId) {
          storeRemoveInterface(activeProjectId, interfaceId);
        }
      },

      // Categorized actions
      meta: metaActions,
      data: dataActions,
      ui: uiActions,
    };
  }, [
    activeProjectId,
    interfaceId,
    storeInitInterface,
    storeUpdateInterface,
    storeRemoveInterface,
    metaActions,
    dataActions,
    uiActions
  ]);
  
  // Build a final 'interface' object from the separate meta, data, and UI objects
  const interfaceObj = useMemo<Partial<Interface> | null>(() => {
    if (!meta || !data || !ui) return null;
    
    return {
      ...meta,
      ...data,
      ...ui
    };
  }, [meta, data, ui]);

  // Use interfaceId to conditionally return values, but only after all hooks are called
  if (interfaceIdOrName === null) {
    return DEFAULT_USE_INTERFACE_RETURN;
  }

  return {
    interface: interfaceObj,
    meta,
    data,
    ui,
    metaActions,
    dataActions,
    uiActions,
    // operationsActions,
    actions,
    exists: interfaceExists,
    interfaceId
  };
} 