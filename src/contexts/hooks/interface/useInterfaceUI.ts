import { useMemo } from 'react';
import { useStoreApiContext, useStoreContext } from '../../providers/StoreProvider';
import { InterfaceUI } from '../../slices/selectors/interface';
import { useInterfaceMeta } from './useInterfaceMeta';
import { getTabId } from '../../selectors/tab';

/**
 * Interface for interface-related UI actions
 */
export interface InterfaceUIActions {
  setActiveTab: (tabIdOrName: string | null) => void;
  setPending: (pending: boolean) => void;
}

/**
 * Custom hook to access interface UI state and actions
 * @param interfaceIdOrName The ID or name of the interface to access
 * @param projectIdOrName Optional project ID or name
 * @returns Object containing interface UI state and actions
 */
export function useInterfaceUI(interfaceIdOrName: string | null, projectIdOrName?: string | null) {
  // Use the meta hook to get common interface info
  const { interfaceId, activeProjectId, interfaceExists } = useInterfaceMeta(
    interfaceIdOrName,
    projectIdOrName
  );

  // Granular subscriptions to UI properties
  const projectIdFromState = useStoreContext((state) => {
    if (!interfaceExists || !interfaceId) return null;
    return state.interfacesById[interfaceId].projectId;
  });

  const activeTabId = useStoreContext((state) => {
    if (!interfaceExists || !interfaceId) return null;
    return state.interfacesById[interfaceId].activeTabId;
  });

  // Get store actions for UI state management
  const storeUpdateInterface = useStoreContext((state) => state.updateInterface);
  const storeSetActiveTab = useStoreContext((state) => state.setActiveTab);

  // Get the store API reference - can be used to get state outside of React's render cycle
  const storeApi = useStoreApiContext();

  // Memoize the UI state object to prevent unnecessary rerenders
  const ui = useMemo<Partial<InterfaceUI> | null>(() => {
    if (!interfaceExists) return null;

    return {
      projectId: projectIdFromState,
      activeTabId,
    };
  }, [interfaceExists, projectIdFromState, activeTabId]);

  // Memoize the UI actions to prevent unnecessary re-renders
  const uiActions = useMemo<InterfaceUIActions>(
    () => ({
      setActiveTab: (tabIdOrName) => {
        if (activeProjectId && interfaceId) {
          // Convert tabIdOrName to tabId using selector
          const state = storeApi.getState();
          const tabId = tabIdOrName ? getTabId(state, interfaceId, tabIdOrName) : null;

          // Set the active tab at the global level
          if (tabId) {
            storeSetActiveTab(interfaceId, tabId);
          }
        }
      },

      setPending: (pending) => {
        if (activeProjectId && interfaceId) {
          storeUpdateInterface(interfaceId, { pending });
        }
      },
    }),
    [activeProjectId, interfaceId, storeSetActiveTab, storeUpdateInterface, storeApi]
  );

  return {
    ui,
    uiActions,
    activeTabId,
  };
}
