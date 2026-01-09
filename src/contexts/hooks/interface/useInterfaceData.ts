import { useMemo } from 'react';
import { useStoreContext } from '../../providers/StoreProvider';
import { InterfaceData } from '../../slices/selectors/interface';
import { Tab } from '../../slices/selectors/tab';
import { useShallow } from 'zustand/react/shallow';
import { useInterfaceMeta } from './useInterfaceMeta';

// Define stable fallback references
const EMPTY_TAB_NAMES: string[] = [];
const EMPTY_TAB_IDS: string[] = [];

/**
 * Interface for interface-related data actions
 */
export interface InterfaceDataActions {
  // Tab management
  addTab: (newTabName: string, initialState?: Partial<Tab>) => void;
  removeTab: (tabName: string) => void;
  renameTab: (sourceTabName: string, newTabName: string) => void;
  getTabNames: () => string[];
  setTabNames: (tabNames: string[]) => void;
  getTabIds: () => string[];
  setTabIds: (tabIds: string[]) => void;
}

/**
 * Custom hook to access interface data and related actions
 * @param interfaceIdOrName The ID or name of the interface to access
 * @param projectIdOrName Optional project ID or name
 * @returns Object containing interface data, actions, and other related state
 */
export function useInterfaceData(
  interfaceIdOrName: string | null,
  projectIdOrName?: string | null
) {
  // Use the meta hook to get common interface info
  const { interfaceId, activeProjectId, interfaceExists } = useInterfaceMeta(
    interfaceIdOrName,
    projectIdOrName
  );

  // Granular subscriptions to Data properties using useShallow for arrays and objects
  const tabNames = useStoreContext((state) => {
    if (!interfaceExists || !interfaceId) return EMPTY_TAB_NAMES;
    return state.interfacesById[interfaceId].tabNames;
  });

  const tabIds = useStoreContext(
    useShallow((state) => {
      if (!interfaceExists || !interfaceId) return EMPTY_TAB_IDS;
      return state.interfacesById[interfaceId].tabIds;
    })
  );

  // Get store actions for data management
  const storeUpdateInterface = useStoreContext((state) => state.updateInterface);
  const storeInitTab = useStoreContext((state) => state.initTab);
  const storeAddTab = useStoreContext((state) => state.addTab);
  const storeRemoveTab = useStoreContext((state) => state.removeTab);
  const storeRenameTab = useStoreContext((state) => state.renameTab);
  const storeRenameTile = useStoreContext((state) => state.renameTile);

  // Memoize the data object to prevent unnecessary rerenders
  const data = useMemo<Partial<InterfaceData> | null>(() => {
    if (!interfaceExists) return null;

    return {
      tabNames: tabNames,
      tabIds,
    };
  }, [interfaceExists, tabIds, tabNames]);

  // Memoize the data actions to prevent unnecessary re-renders
  const dataActions = useMemo<InterfaceDataActions>(
    () => ({
      addTab: (newTabName, initialState = {}) => {
        if (interfaceId) {
          // Add the new tab to the interface
          storeAddTab(interfaceId, newTabName, {
            ...initialState,
            id: initialState?.id || newTabName,
            name: newTabName,
          });
        }
      },

      removeTab: (tabName) => {
        if (activeProjectId && interfaceId) {
          // Remove the tab
          storeRemoveTab(interfaceId, tabName);
        }
      },

      renameTab: (sourceTabName, newTabName) => {
        if (activeProjectId && interfaceId) {
          // Rename the tab
          storeRenameTab(interfaceId, sourceTabName, newTabName);
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
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
    ]
  );

  return {
    data,
    dataActions,
    tabIds,
    tabNames,
  };
}
