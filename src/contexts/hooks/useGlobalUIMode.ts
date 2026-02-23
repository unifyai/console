import { useStoreContext } from '../providers/StoreProvider';

/**
 * Custom hook to access global UI mode settings
 * @returns Object containing global UI mode states and actions
 */
export function useGlobalUIMode() {
  const globalEditMode = useStoreContext((state) => state.globalEditMode);
  const globalDashboardMode = useStoreContext((state) => state.globalDashboardMode);
  const setGlobalEditMode = useStoreContext((state) => state.setGlobalEditMode);
  const setGlobalDashboardMode = useStoreContext((state) => state.setGlobalDashboardMode);

  return {
    isEditMode: globalEditMode,
    isDashboardMode: globalDashboardMode,
    isInteractive: !globalDashboardMode, // Interactive is the opposite of dashboard mode
    setEditMode: setGlobalEditMode,
    setDashboardMode: setGlobalDashboardMode,
    toggleEditMode: () => setGlobalEditMode(!globalEditMode),
    toggleDashboardMode: () => setGlobalDashboardMode(!globalDashboardMode),
  };
}
