"use client";

import React, { useState, useRef, Suspense, useMemo, useEffect, lazy, useCallback } from 'react';
import { Loader2, Search } from "lucide-react";
import { showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications';
import { useRouter } from "next/navigation";
import { Tabs, TabsContent } from "../../../UI/tabs";
import { Dialog, DialogContent } from "../../../UI/dialog";
import ActionButton from "../../../Common/Buttons/Action";
import SkeletonLoader from "../../../Common/Loaders/SkeletonLoader";
import InterfaceButtons from "./Buttons/InterfaceButtons";
import InterfaceTabs from "./InterfaceTabs";
import ProjectButtons from "./Buttons/ProjectButtons";
import { useQueryState } from "nuqs";
import { ProjectsActions, LogsActions, FieldsActions, DerivedEntryActions, ContextActions, CodeActions, GranularInterfaceActions, GranularTabActions, GranularTileActions, FileActions, Favourite, FavouritesActions } from '@/types/interfaces/grid';
import { debounce } from 'lodash';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import AutoComplete from '../../../Common/Misc/AutoComplete';
import { useStoreApiContext, useStoreContext } from '@/contexts/providers/StoreProvider';
import { Command } from '@/contexts/slices/selectors/commands';
import { iconMap } from '@/constants/logs';
import { Toaster } from 'sonner';
import { useCreateTabQuery, useUpdateTabQuery } from '@/hooks/Interfaces/Query/useTabsQuery';
import { useSaveTabWithTilesQuery } from '@/hooks/Interfaces/Query/useSaveTabWithTilesQuery';
import { useCommand } from '@/contexts/hooks/commands/useCommand';
import { useTabStreamingQuery } from '@/hooks/Interfaces/Query/useTabStreamingQuery';
import { useInterfaceSync } from '@/contexts/hooks/interface/sync/useInterfaceSync';
import { selectActiveTab, selectTotalInactiveTabsForInterface } from '@/contexts/selectors/tab';
import { useInterfaceData } from '@/contexts/hooks/interface/useInterfaceData';
import SaveResetOverlay from './SaveResetOverlay';
import { useSidebar } from '@/components/UI/sidebar';
import { ScrollArea } from '../../../UI/scroll-area';
import InterfaceNav from './InterfaceNav';
import { withLoadingToast } from '@/components/Common/Toasts/notifications'
import { useQueryClient } from '@tanstack/react-query';
import { TileProps } from '@/types/interfaces/grid';
import { cn } from '@/lib/utils';

export const PageScrollContext = React.createContext<React.RefObject<HTMLDivElement> | null>(null);

// Lazy load components
const DefaultProject = lazy(() => import('./Buttons/DefaultProject'));
const FocusDialog = lazy(() => import('./Buttons/FocusDialog'));
const EditTileName = lazy(() => import('./Buttons/EditTileName'));
const Tab = lazy(() => import('../Tab/Tab'));

/**
 * Debug flag for tab prefetching indicators
 * Set NEXT_PUBLIC_DEBUG_TAB_PREFETCHING=true to enable streaming indicators
 */
const DEBUG_TAB_PREFETCHING = process.env.NEXT_PUBLIC_DEBUG_TAB_PREFETCHING === 'true';

interface InterfaceComponentProps {
  interfaceId: string;
  projectsActions: ProjectsActions;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  fileActions: FileActions;
  favouritesActions: FavouritesActions;
  initialFavourites: Favourite[];
}

const Interface = ({ 
  interfaceId, 
  projectsActions,
  interfaceActions,
  tabActions,
  tileActions,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions,
  codeActions,
  fileActions,
  favouritesActions,
  initialFavourites,
}: InterfaceComponentProps) => {

  const router = useRouter();
  // Query params - no more tab param needed
  const [projectQueryParam, setProjectQueryParam] = useQueryState("project", { shallow: false });
  const [interfaceQueryParam, setInterfaceQueryParam] = useQueryState("interface", { shallow: false });
  const [isSwitchingInterface, setIsSwitchingInterface] = useState(false);
  const [isRefreshingInterface, setIsRefreshingInterface] = useState(false);
  const [tabBarReady, setTabBarReady] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  useEffect(() => {
    // When the interface param changes (navigation completes), hide the loader.
    setIsSwitchingInterface(false);
  }, [interfaceQueryParam]);

  useEffect(() => {
    // Trigger tab bar entrance animation after mount
    const t = setTimeout(() => setTabBarReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  const pageScrollContainerRef = useRef<HTMLDivElement>(null);

  // SYNCHRONISED INTERFACE-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedInterfaceActions } = useInterfaceSync(interfaceId, projectQueryParam, interfaceActions, tabActions);
  const syncedInterfaceDataActions = syncedInterfaceActions?.data ?? null;
  const syncedInterfaceUIActions = syncedInterfaceActions?.ui ?? null;
  
  // Get current active tab name using selector - this is our source of truth
  const state = useStoreApiContext().getState();
  const activeTab = selectActiveTab(state, interfaceId);
  const activeTabId = activeTab?.id || null;
  const activeTabName = activeTab?.name || null;
  const setTabQueryParamFromSync = syncedInterfaceUIActions?.setActiveTab || (() => {});

  // Store state and actions for UI control
  const focusPaneOpen = useStoreContext((state) => state.focusPaneOpen);
  const saveInterfaceOpen = useStoreContext((state) => state.saveInterfaceOpen);
  const setFocusPaneOpen = useStoreContext((state) => state.setFocusPaneOpen);
  const setSaveInterfaceOpen = useStoreContext((state) => state.setSaveInterfaceOpen);
  const deleteProjectOpen = useStoreContext((state) => state.deleteProjectOpen);
  const createProjectOpen = useStoreContext((state) => state.createProjectOpen);
  const selectProjectsOpen = useStoreContext((state) => state.selectProjectsOpen);
  const fileUploadOpen = useStoreContext((state) => state.fileUploadOpen);
  const globalContextOpen = useStoreContext((state) => state.globalContextOpen);
  
  const setDeleteProjectOpen = useStoreContext((state) => state.setDeleteProjectOpen);
  const setCreateProjectOpen = useStoreContext((state) => state.setCreateProjectOpen);
  const setSelectProjectsOpen = useStoreContext((state) => state.setSelectProjectsOpen);
  const setFileUploadOpen = useStoreContext((state) => state.setFileUploadOpen);
  const setGlobalContextOpen = useStoreContext((state) => state.setGlobalContextOpen);
  
  // Command-related state from store
  const storeCommands = useStoreContext((state) => state.commands);

  // Initialize React Query mutations for tab operations
  const createTabMutation = useCreateTabQuery();
  const updateTabMutation = useUpdateTabQuery();
  const saveTabWithTilesMutation = useSaveTabWithTilesQuery(tabActions, tileActions, "Manual save");

  // Use granular interface and tab hooks for better performance
  const { dataActions: interfaceDataActions } = useInterfaceData(interfaceId);
  const { data: tabDataState, dataActions: tabDataActions } = useTabData(activeTabId, interfaceId);
  const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(activeTabId, interfaceId);

  // NEW: Use tab streaming for all tab data management
  const tabStreamingQuery = useTabStreamingQuery(
    interfaceId,
    activeTabName,
    projectQueryParam,
    {
      tabActions,
      tileActions,
      fieldsActions,
      logsActions,
      projectsActions,
      contextActions,
    }
  );

  // Sidebar state for proper positioning
  const isMobile = useIsMobile();
  const { state: sidebarState } = useSidebar();
  const sidebarWidth = isMobile ? '0rem' : sidebarState === 'collapsed' ? '3rem' : '14rem';

  // Overlay state for save/reset operations
  const [overlayState, setOverlayState] = useState<{
    isVisible: boolean;
    operation: 'saving' | 'resetting' | 'refreshing' | null;
    status: 'loading' | 'success' | 'error' | null;
  }>({
    isVisible: false,
    operation: null,
    status: null,
  });

  // Track refresh status for navbar icon
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  // Initialize command hooks
  const commandHooks = useCommand({
    projectId: projectQueryParam,
    interfaceId,
    tabId: activeTabId,
    setProjectQueryParam,
    setTabQueryParam: setTabQueryParamFromSync,
    setInterfaceQueryParam,
    projectActions: projectsActions,
    interfaceActions,
    tabActions,
    tileActions,
    fileActions,
    logsActions,
    contextActions,
    codeActions,
    setOverlayState,
  });
  const resetInterfaceCommand = storeCommands.find(cmd => cmd.id === "reset-interface");

  // Reference for the grid container
  const gridRef = useRef<HTMLDivElement>(null);

  // Get tab names from streaming query
  const tabNames = useMemo(() => interfaceDataActions?.getTabNames() || [], [interfaceDataActions]);

  // Auto-select first tab if no active tab is set and tabs are available
  useEffect(() => {
    if (tabNames.length > 0 && syncedInterfaceUIActions && (!activeTabName || (activeTabName && !tabNames.includes(activeTabName)))) {
      console.log(`[Interface] No active tab set or active tab doesn't exist in available tabs: ${tabNames}, selecting last tab: ${tabNames[tabNames.length - 1]}`);
      syncedInterfaceUIActions.setActiveTab(tabNames[tabNames.length - 1]);
    }
  }, [activeTabName, tabNames, syncedInterfaceUIActions]);

  // Track pending tab change
  const [pendingTabChange, setPendingTabChange] = useState<string | undefined>(undefined);

  // Actual tab switch handler - will be debounced
  const performTabSwitch = useCallback((value: string | undefined) => {
    if (!value || !syncedInterfaceUIActions) return;
    
    // Clear the pending state
    setPendingTabChange(undefined);
    
    // Check if tab data is already cached
    const isCached = tabStreamingQuery?.switchTab(value) || false;
    
    if (isCached) {
      // Instant switch - data is already available
      syncedInterfaceUIActions.setActiveTab(value);
    } else {
      // Show loading state while fetching
      if (tabUIActions) {
        tabUIActions.setPending(true);
      }
      syncedInterfaceUIActions.setActiveTab(value);
    }
  }, [syncedInterfaceUIActions, tabStreamingQuery, tabUIActions]);

  // Create debounced version of tab switch handler
  const debouncedTabSwitch = useMemo(
    () => debounce(performTabSwitch, 100),
    [performTabSwitch]
  );

  // Enhanced tab change handler with debounced switching
  const handleTabChange = useCallback((value: string | undefined) => {
    if (!value) return;
    
    // Set pending tab change immediately for UI feedback
    setPendingTabChange(value);
    
    // Debounce the actual tab switch
    debouncedTabSwitch(value);
  }, [debouncedTabSwitch]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedTabSwitch.cancel();
    };
  }, [debouncedTabSwitch]);

  const queryClient = useQueryClient();

  // Safety timeout: hide switching overlay and cancel queries if navigation stalls
  useEffect(() => {
    if (!isSwitchingInterface) return;

    const timer = setTimeout(() => {
      // Abort any long-running queries
      queryClient.cancelQueries({ predicate: (q: any) => {
        const key0 = q.queryKey?.[0] as string;
        return [
          'interfaces', 'interface', 'interface-by-id', 'interface-with-tabs',
          'tabs', 'tiles', 'tab', 'tile'
        ].includes(key0);
      }});
      
      // Hide the overlay and show an error
      setIsSwitchingInterface(false);
      showErrorToast('Navigation timed out. Please try again.', 'Failed to load the selected interface.');
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, [isSwitchingInterface, queryClient]);

  // Function to hide overlay
  const hideOverlay = () => {
    setOverlayState({
      isVisible: false,
      operation: null,
      status: null,
    });
  };

  // Scroll to the bottom whenever new tiles are added
  useEffect(() => {
    gridRef.current?.scrollTo({
      top: gridRef.current?.scrollHeight,
      behavior: "smooth",
    });
  }, [tabDataState?.tileIds]);

  // Removed: tab-specific colours are now applied within the Tab component scope so
  // that they do not override the project/global theme for other tabs.

  // Reset pending state when tab data loads successfully
  useEffect(() => {
    if (tabStreamingQuery?.activeTab.data && tabUIState?.pending) {
      tabUIActions?.setPending(false);
    }
  }, [tabStreamingQuery?.activeTab.data, tabUIState?.pending, tabUIActions]);

  // Full refresh handler used by sidebar refresh button
  const handleInterfaceRefresh = async () => {
    if (refreshStatus === 'loading') return;

    setRefreshStatus('loading');
    setIsRefreshingInterface(true);
    
    // Invalidate relevant React Query caches so subsequent queries hit backend
    try {
      await queryClient.invalidateQueries({ predicate: (q: any) => {
        const key0 = q.queryKey?.[0] as string;
        // Common keys used in hooks
        return [
          'interfaces', 'interface', 'interface-by-id', 'interface-with-tabs',
          'tabs', 'tiles', 'tab', 'tile'
        ].includes(key0);
      }});
    } catch (err) {
      console.warn('Cache invalidation failed:', err);
    }

    try {
        await withLoadingToast(
            async () => {
                await router.refresh();
            },
            {
                loading: 'Refreshing interface...',
                success: 'Interface refreshed!',
                error: 'Failed to refresh interface.'
            },
            2000 // Only show loading toast if refresh takes > 2 seconds
        );
        setRefreshStatus('success');
        setIsRefreshingInterface(false);
    } catch (err) {
      setRefreshStatus('idle');
      setIsRefreshingInterface(false);
      // Error is already handled by withLoadingToast
    } finally {
        setTimeout(() => setRefreshStatus('idle'), 2000);
    }
  };

  // Add a useEffect to reset the error state and refresh data
  useEffect(() => {
    // Reset any error states when tab changes
    if (createTabMutation.isError) {
      createTabMutation.reset();
    }
    if (updateTabMutation.isError) {
      updateTabMutation.reset();
    }
  }, [activeTabName, createTabMutation, updateTabMutation]);

  // Render the active tab based on streaming query
  const renderActiveTab = () => {
    if (!activeTabId || !projectQueryParam) {
      return (
        <div className="flex items-center justify-center h-full">
          Please select a tab
        </div>
      );
    }

    return (
      <div className="w-full h-full">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <SkeletonLoader />
          </div>
        }>
          <Tab
            tabId={activeTabId}
            interfaceId={interfaceId}
            projectId={projectQueryParam}
            projectsActions={projectsActions}
            tabActions={tabActions}
            tileActions={tileActions}
            logsActions={logsActions}
            fieldsActions={fieldsActions}
            derivedEntryActions={derivedEntryActions}
            contextActions={contextActions}
            codeActions={codeActions}
            fileActions={fileActions}
          />
        </Suspense>
      </div>
    );
  };

  // Handle save dialog submission
  const handleSaveDialog = async () => {
    if (!activeTabName || !projectQueryParam || !interfaceQueryParam) {
      console.error("Missing tab or project or interface");
      return;
    }
    
    // Hide the dialog and show overlay
    setSaveInterfaceOpen(false);
    setOverlayState({
      isVisible: true,
      operation: 'saving',
      status: 'loading',
    });
    
    // Show loading state
    if (tabUIActions) {
      tabUIActions.setPending(true);
    }
    
    try {
      // Get the tile IDs for this tab
      const tileIds = tabDataActions?.getItems().map(item => item.id) || [];
      
      // Perform the save operation
      await saveTabWithTilesMutation.mutateAsync({
        interface_id: interfaceId,
        tab_name: activeTabName,
        tile_ids: tileIds
      });
      
      // Show success in overlay
      setOverlayState({
        isVisible: true,
        operation: 'saving',
        status: 'success',
      });
      
      // Show success message in UI state
      if (tabUIActions) {
        tabUIActions.setSaveSuccess(true);
      }
      
    } catch (error) {
      console.error("Failed to save tab:", error);
      
      // Show error in overlay
      setOverlayState({
        isVisible: true,
        operation: 'saving',
        status: 'error',
      });
      
      if (tabUIActions) {
        tabUIActions.setSaveSuccess(false);
      }
    } finally {
      // Hide loading state
      if (tabUIActions) {
        tabUIActions.setPending(false);
      }
    }
  };

  // Function to handle commands
  const handleCommand = (id: string) => {
    // First try using direct UI toggles for dialogs
    switch (id) {
      case "select-projects":
        setSelectProjectsOpen(!selectProjectsOpen);
        break;
      case "create-project":
        setCreateProjectOpen(!createProjectOpen);
        break;
      case "delete-project":
        setDeleteProjectOpen(!deleteProjectOpen);
        break;
      case "file-upload":
        setFileUploadOpen(!fileUploadOpen);
        break;
      case "focus-pane":
        setFocusPaneOpen(!focusPaneOpen);
        break;
      case "global-context":
        setGlobalContextOpen(!globalContextOpen);
        break;
      case "save-interface":
        setSaveInterfaceOpen(!saveInterfaceOpen);
        break;
      case "reset-interface":
        commandHooks.resetTab();
        break;
      case "close-project":
        commandHooks.closeProject();
        break;
      default:
        console.log(`Unknown command: ${id}`);
    }
  };

  // No early return – we render a local overlay in the workspace area instead

  const handleSidebarAddTile = () => {
    if (!activeTabId || !tabDataActions) return;
    const items = tabDataActions.getItems() as TileProps[] || [];
    let idx = items.length;
    while (items.some(it => it.name === `Tile_${idx}`)) idx++;
    const newTileName = `Tile_${idx}`;
    const position = { x: 0, y: 0, width: 4, height: 4 } as any;
    tabDataActions.initTile(newTileName, { position, minW: null, minH: null, type: null, visible: true });
  };

  return (
  <PageScrollContext.Provider value={pageScrollContainerRef}>

    <div className="w-full h-full relative">
      {/* New Interface Navigation Sidebar */}
      <InterfaceNav
        interfaceId={interfaceId}
        projectId={projectQueryParam || ''}
        isEditMode={tabUIState?.edit || false}
        isCommandMode={!tabUIState?.interactive}
        onEditModeToggle={() => {
          tabUIActions?.setEdit(!tabUIState?.edit);
        }}
        onCommandModeToggle={() => {
          tabUIActions?.setInteractive(!tabUIState?.interactive);
        }}
        onNavCollapseChange={setIsNavCollapsed}
        onRefresh={handleInterfaceRefresh}
        refreshStatus={refreshStatus}
        projectActions={projectsActions}
        interfaceActions={interfaceActions}
        tabActions={tabActions}
        tileActions={tileActions}
        fileActions={fileActions}
        logsActions={logsActions}
        contextActions={contextActions}
        codeActions={codeActions}
        favouritesActions={favouritesActions}
        initialFavourites={initialFavourites}
        setIsSwitchingInterface={setIsSwitchingInterface}
        onAddTile={handleSidebarAddTile}
      />
      
      {/* Main Content Area */}
      <div 
        className="h-full transition-all duration-300"
        style={{
          marginLeft: isNavCollapsed ? '48px' : '256px'
        }}
      >
        <div className="relative flex-1 min-w-0 h-full">
        {(isSwitchingInterface || isRefreshingInterface) && (
          <div
            className="fixed bottom-0 right-0 z-[60] flex items-center justify-center backdrop-blur-sm bg-background/70"
            style={{ left: isNavCollapsed ? '48px' : '256px', top: '3rem' }}
          >
            <div className="flex flex-col items-center gap-4 bg-background border border-border shadow-lg rounded-xl px-6 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground text-center whitespace-nowrap">
                {isSwitchingInterface ? 'Switching project...' : 'Refreshing interface...'}
              </p>
            </div>
          </div>
        )}
          <ScrollArea ref={pageScrollContainerRef} className="flex-1 min-w-0 h-full">
          <div className="relative bg-background" ref={gridRef}>
          <Toaster richColors position="bottom-right" closeButton />
          {/* ---------------------------------------------------------
              Top-level Suspense: covers the whole Tabs area so that
              the user sees a Skeleton while the tabs are being loaded
              --------------------------------------------------------- */}
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <SkeletonLoader />
              </div>
            }
            >
            <Tabs
              value={activeTabName || undefined}
              onValueChange={handleTabChange}
              className="w-full h-full flex flex-col tutorial-details-panel"
              >
              {/* Floating Top Menu Elements (KEEPING FOR NOW) */}
            <div 
              className="fixed top-14 z-40 transition-all duration-300 ease-linear pointer-events-none"
              style={{ 
                left: isNavCollapsed ? '48px' : '256px', // Adjust based on sidebar state
                right: 0,
              }}
              >
              <div className="flex justify-between gap-5 w-full p-4 pointer-events-auto overflow-x-auto command-scrollbar">
                {/* ProjectButtons removed as per UI simplification */}

                <div className="flex flex-row gap-2 items-center">
                  {tabUIState?.resetting && (
                    <div className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md rounded-lg p-2">
                      <Loader2 className="animate-spin" />
                    </div>
                  )}
                </div>

                <InterfaceButtons
                  tabIdOrName={activeTabId}
                  interfaceId={interfaceId}
                  interfaceActions={interfaceActions}
                  tabActions={tabActions}
                  tileActions={tileActions}
                  favouritesActions={favouritesActions}
                  initialFavourites={initialFavourites}
                  disabled={saveTabWithTilesMutation.isPending}
                  setOverlayState={setOverlayState}
                  setIsSwitchingInterface={setIsSwitchingInterface}
                  hideAddTileButton={true}
                />
              </div>
            </div>

            {/* Content area with deadspace for floating menus */}
            <div 
              className="transition-all duration-200 ease-linear"
              style={{ 
                paddingTop: '1rem', // Removed conditional edit-mode deadspace
                paddingLeft: '1rem',    // Content padding
                paddingRight: '1rem',   // Content padding
                minHeight: 'calc(100vh - 6rem)', // Ensure full height minus top padding
              }}
              >
              {tabNames.length === 0 ? (
                (projectQueryParam && (!interfaceQueryParam || tabUIState?.pending)) ? (
                  <div className="flex justify-center">
                    <Loader2 className="animate-spin my-36" />
                  </div>
                ) : !projectQueryParam && !interfaceQueryParam ? (
                  <Suspense fallback={<div className="flex justify-center"><Loader2 className="animate-spin my-36" /></div>}>
                    <DefaultProject
                      projectActions={projectsActions}
                      interfaceActions={interfaceActions}
                      tabActions={tabActions}
                      tileActions={tileActions}
                      logsActions={logsActions}
                      codeActions={codeActions}
                      fileActions={fileActions}
                      derivedEntryActions={derivedEntryActions}
                      setTabQueryParam={setTabQueryParamFromSync}
                      setInterfaceQueryParam={setInterfaceQueryParam}
                      setProjectQueryParam={setProjectQueryParam}
                    />
                  </Suspense>
                ) : null
              ) : (
                tabNames.map((tabName: string, idx: number) => (
                  <TabsContent
                  key={idx}
                    value={tabName}
                    className="mb-auto tutorial-selection-pane relative w-full h-full"
                  >
                    {/* Check if we're in loading states */}
                    {(tabUIState?.pending || createTabMutation.isPending || updateTabMutation.isPending) ? (
                      <div className="flex justify-center">
                        <Loader2 className="animate-spin my-36" />
                      </div>
                    ) : activeTabName !== tabName ? (
                      <div className="flex justify-center">
                        {/* Show different indicator for pending tab switch */}
                        {pendingTabChange === tabName ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Loader2 className="animate-spin my-36" />
                            <div className="text-sm text-muted-foreground">Switching tab...</div>
                          </div>
                        ) : (
                          <Loader2 className="animate-spin my-36" />
                        )}
                      </div>
                    ) : (
                      <Suspense fallback={<div className="w-full h-full"><SkeletonLoader /></div>}>
                        <div className="w-full h-full relative">
                          {/* Use renderActiveTab instead of direct Tab component render */}
                          {renderActiveTab()}
                          
                          {/* Show streaming indicators */}
                          {DEBUG_TAB_PREFETCHING && tabStreamingQuery.prefetchProgress.total > 0 && (
                            <div className="fixed bottom-16 right-4 text-xs text-muted-foreground bg-background/80 p-2 rounded border">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  // Get actual tabs from the store using selector
                                  const inactiveTabsCount = selectTotalInactiveTabsForInterface(state, interfaceId);
                                  
                                  // Calculate total prefetchable tabs (excluding active tab)
                                  const prefetchableTabsCount = inactiveTabsCount;
                                  
                                  // Get current prefetch progress with safe fallbacks
                                  const { completed } = tabStreamingQuery.prefetchProgress;
                                  const totalPrefetched = Math.min(completed, prefetchableTabsCount);
                                  
                                  // Only show if there are tabs to prefetch
                                  const shouldShow = prefetchableTabsCount > 0;
                                  const isComplete = totalPrefetched === prefetchableTabsCount;
                                  
                                  if (!shouldShow) return null;
                                  
                                  return (
                                    <>
                                      <div className={`w-2 h-2 bg-green-500 rounded-full ${isComplete ? '' : 'animate-pulse'}`}></div>
                                      <span>
                                        Prefetched: {totalPrefetched}/{prefetchableTabsCount} tabs
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </Suspense>
                    )}
                  </TabsContent>
                ))
              )}
              
              {/* Bottom deadspace - ensures scrollable space for floating bottom menu */}
              <div style={{ height: '10rem' }} className="w-full" />
            </div>

            {/* Floating Bottom Tab Bar */}
            {projectQueryParam && interfaceQueryParam && (
              <div 
                className={cn(
                  "fixed bottom-0 z-40 pointer-events-none transform transition-all duration-500 ease-out",
                  tabBarReady && !isSwitchingInterface && !isRefreshingInterface
                    ? "translate-y-0 opacity-100"
                    : "translate-y-12 opacity-0"
                )}
                style={{ 
                  left: isNavCollapsed ? '48px' : '256px',
                  right: 0,
                }}
              >
                <div className="p-4 w-full flex justify-start pointer-events-auto">
                  <InterfaceTabs
                    tabIdOrName={activeTabId}
                    interfaceId={interfaceId}
                    projectsActions={projectsActions}
                    contextActions={contextActions}
                    interfaceActions={interfaceActions}
                    tabActions={tabActions}
                    tileActions={tileActions}
                    fieldsActions={fieldsActions}
                    logsActions={logsActions}
                    setTabQueryParam={setTabQueryParamFromSync}
                    pendingTabChange={pendingTabChange}
                    setSaveInterfaceOpen={setSaveInterfaceOpen}
                    resetInterfaceCommand={resetInterfaceCommand}
                  />
                </div>
              </div>
            )}
          </Tabs>
          
          {/* Save/Reset Overlay */}
          <SaveResetOverlay
            isVisible={overlayState.isVisible}
            operation={overlayState.operation}
            status={overlayState.status}
            onComplete={hideOverlay}
          />
        </Suspense>

        {/* Focus Dialog */}
        {focusPaneOpen && (
          <Dialog open={true} onOpenChange={() => setFocusPaneOpen(false)}>
                            <DialogContent className="!w-[98vw] !max-w-[98vw] !h-[98vh] !flex !flex-col !p-0 !overflow-hidden">
              <Suspense fallback={<SkeletonLoader />}>
                <FocusDialog
                  tabIdOrName={activeTabId || ""}
                  interfaceId={interfaceId}
                  projectId={projectQueryParam || ""}
                  tileActions={tileActions}
                  tabActions={tabActions}
                  logsActions={logsActions}
                  fieldsActions={fieldsActions}
                  derivedEntryActions={derivedEntryActions}
                  contextActions={contextActions}
                  codeActions={codeActions}
                  fileActions={fileActions}
                  projectsActions={projectsActions}
                  />
              </Suspense>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Tile Name Dialog */}
        {tabUIState?.edit && tabUIState?.editTile && (
          <Suspense fallback={<div className="w-full h-16"><SkeletonLoader /></div>}>
            <EditTileName
              tabIdOrName={activeTabId || ""}
              interfaceId={interfaceId}
              tabActions={tabActions}
              tileActions={tileActions}
              />
          </Suspense>
        )}

        {/* Save Dialog */}
        {saveInterfaceOpen && (
          <Dialog open={true} onOpenChange={() => setSaveInterfaceOpen(false)}>
            <DialogContent className="w-1/4">
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  Are you sure you want to save the changes to{" "}
                  <span className="font-semibold">{activeTabName}</span>?
                </div>
                <div className="flex flex-col gap-2">
                  {saveTabWithTilesMutation.isPending && (
                    <div className="text-sm text-center">
                      <Loader2 className="h-4 w-4 inline-block mr-2 animate-spin" />
                      Saving changes...
                    </div>
                  )}
                  {saveTabWithTilesMutation.isError && (
                    <div className="text-sm text-destructive text-center">
                      Error saving changes: {saveTabWithTilesMutation.error?.message || "Unknown error"}
                      <br />
                      Please try again.
                    </div>
                  )}
                  <div className="flex justify-end pr-2">
                    <ActionButton
                      className="w-fit remove cursor-pointer mr-0 justify-self-end"
                      onClick={handleSaveDialog}
                      text="Save"
                      tooltip="Save changes to tab and all tiles"
                      variant="primary"
                      disabled={saveTabWithTilesMutation.isPending}
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Floating Action Search Button */}
        {/* 
        <div className="fixed bottom-5 right-5 z-50">
            <AutoComplete
                type={"Actions"}
                displayMode="icon"
                triggerIcon={<Search />}
                items={storeCommands.map((cmd: Command) => ({
                    label: cmd.label,
                    value: cmd.id,
                    icon: cmd.icon ? iconMap[cmd.icon] : undefined,
                    disabled: cmd.disabled
                    }))}
                    onSelect={(commandId: string) => {
                      handleCommand(commandId);
                      }}
                      loading={false}
                      />
                      </div> 
                      */}
         </div>
            </ScrollArea>
         </div>
    </div>
    </div>
  </PageScrollContext.Provider>
  );
};

export default Interface;