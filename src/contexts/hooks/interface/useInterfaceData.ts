import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { InterfaceData } from '../../slices/selectors/interface';
import { Tab } from '../../slices/selectors/tab';
import { useShallow } from 'zustand/react/shallow';
import { TableArguments } from '@/types/evals/logs';
import { useInterfaceMeta } from './useInterfaceMeta';

// Define stable fallback references
const EMPTY_TAB_NAMES: string[] = [];
const EMPTY_TAB_IDS: string[] = [];
const EMPTY_TABLE_ARGUMENTS = {};

/**
 * Interface for interface-related data actions
 */
export interface InterfaceDataActions {
  // Tab management
  addTab: (tabName: string, newName: string, initialState?: Partial<Tab>) => void;
  removeTab: (tabName: string) => void;
  renameTab: (tabName: string, newName: string) => void;
  getTabNames: () => string[];
  setTabNames: (tabNames: string[]) => void;
  getTabIds: () => string[];
  setTabIds: (tabIds: string[]) => void;

  // Table arguments
  setTableArguments: (tableArguments: TableArguments) => void;
}

/**
 * Custom hook to access interface data and related actions
 * @param interfaceName The name of the interface to access
 * @param projectName Optional project name (if not provided, active project will be used)
 * @returns Object containing interface data, actions, and other related state
 */
export function useInterfaceData(interfaceName: string | null, projectName?: string | null) {
  // Use the meta hook to get common interface info
  const { 
    interfaceId, 
    activeProjectId, 
    interfaceExists 
  } = useInterfaceMeta(interfaceName, projectName);

  // Granular subscriptions to Data properties using useShallow for arrays and objects
  const tabNames = useStoreContext(state => {
    if (!interfaceExists || !interfaceId) return EMPTY_TAB_NAMES;
    return state.interfacesById[interfaceId].tabNames;
  });

  const tabIds = useStoreContext(
    useShallow(state => {
      if (!interfaceExists || !interfaceId) return EMPTY_TAB_IDS;
      return state.interfacesById[interfaceId].tabIds;
    })
  );
  
  const tableArguments = useStoreContext(
    useShallow(state => {
      if (!interfaceExists || !interfaceId) return EMPTY_TABLE_ARGUMENTS;
      return state.interfacesById[interfaceId].tableArguments || EMPTY_TABLE_ARGUMENTS;
    })
  );

  // Get store actions for data management
  const storeUpdateInterface = useStoreContext(state => state.updateInterface);
  const storeInitTab = useStoreContext(state => state.initTab);
  const storeAddTab = useStoreContext(state => state.addTab);
  const storeRemoveTab = useStoreContext(state => state.removeTab);
  const storeRenameTab = useStoreContext(state => state.renameTab);
  const storeRenameTile = useStoreContext(state => state.renameTile);

  // Memoize the data object to prevent unnecessary rerenders
  const data = useMemo<Partial<InterfaceData> | null>(() => {
    if (!interfaceExists) return null;
    
    return {
      tabNames: tabNames,
      tabIds,
      tableArguments
    };
  }, [interfaceExists, tabIds, tableArguments, tabNames]);

  // Memoize the data actions to prevent unnecessary re-renders
  const dataActions = useMemo<InterfaceDataActions>(() => ({
    addTab: (tabName, newName, initialState = {}) => {
      if (activeProjectId && interfaceId) {
        // Check if the tabIds are already hierarchical
        const sourceTabId = tabName.includes('>')
          ? tabName
          : `${interfaceId}>${tabName}`;
        
        const newTabId = newName.includes('>')
          ? newName
          : `${interfaceId}>${newName}`;

        // Add the new tab to the interface
        storeAddTab(
          interfaceId,
          sourceTabId,
          newTabId,
          {
            id: newTabId,
            name: newName,
            projectId: activeProjectId,
            interfaceId: interfaceId,
            ...initialState
          }
        );
      }
    },

    removeTab: (tabName) => {
      if (activeProjectId && interfaceId) {
        // Check if the tab ID is already hierarchical
        const hierarchicalTabId = tabName.includes('>')
          ? tabName
          : `${interfaceId}>${tabName}`;
        
        // Remove the tab
        storeRemoveTab(interfaceId, hierarchicalTabId);
      }
    },

    renameTab: (tabName, newName) => {
      if (activeProjectId && interfaceId) {
        // Check if the tabIds are already hierarchical
        const sourceTabId = tabName.includes('>')
          ? tabName
          : `${interfaceId}>${tabName}`;
        
        const newTabId = newName.includes('>')
          ? newName
          : `${interfaceId}>${newName}`;

        // Rename the tab to the interface
        storeRenameTab(
          interfaceId,
          sourceTabId,
          newTabId,
          {
            id: newTabId,
            name: newName,
            projectId: activeProjectId,
            interfaceId: interfaceId,
          }
        );
      }
    },

    getTabNames: () => tabNames,

    setTabNames: (tabNames) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(interfaceId, { tabNames: tabNames });
      }
    },

    getTabIds: () => tabIds,

    setTabIds: (tabIds) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(interfaceId, { tabIds: tabIds });
      }
    },
    
    setTableArguments: (tableArguments) => {
      if (activeProjectId && interfaceId) {
        storeUpdateInterface(interfaceId, { tableArguments });
      }
    }
  }), [
    activeProjectId, 
    interfaceId, 
    tabIds,
    tabNames,
    storeInitTab,
    storeAddTab,
    storeRemoveTab, 
    storeRenameTab,
    storeRenameTile,
    storeUpdateInterface,
  ]);

  return {
    data,
    dataActions,
    tabIds,
    tabNames
  };
} 