"use client";

import React, { useState, useRef, Suspense, useMemo, useEffect, lazy, useCallback } from 'react';
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent } from "../UI/tabs";
import { Dialog, DialogContent } from "../UI/dialog";
import ActionButton from "../Common/Buttons/Action";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import InterfaceButtons from "./InterfaceButtons";
import InterfaceTabs from "./InterfaceTabs";
import ProjectButtons from "./ProjectButtons";
import { useQueryState } from "nuqs";
import { ProjectsActions, LogsActions, FieldsActions, DerivedEntryActions, ContextActions, CodeActions, GranularInterfaceActions, GranularTabActions, GranularTileActions, FileActions } from '@/types/evals/grid';
import { debounce } from 'lodash';

import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import AutoComplete from '../Common/Misc/AutoComplete';
import { useStoreApiContext, useStoreContext } from '@/contexts/providers/StoreProvider';
import { Command } from '@/contexts/slices/selectors/commands';
import { iconMap } from '@/constants/logs';
import { Toaster } from 'sonner';
import { useCreateTabQuery, useUpdateTabQuery } from '@/hooks/Query/useTabsQuery';
import { useSaveTabWithTilesQuery } from '@/hooks/Query/useSaveTabWithTilesQuery';
import { useCommand } from '@/contexts/hooks/commands/useCommand';
import { useTabStreamingQuery } from '@/hooks/Query/useTabStreamingQuery';
import { useInterfaceSync } from '@/contexts/hooks/interface/sync/useInterfaceSync';
import { selectActiveTab, selectTotalInactiveTabsForInterface } from '@/contexts/selectors/tab';
import { useInterfaceData } from '@/contexts/hooks/interface/useInterfaceData';
import SaveResetOverlay from './SaveResetOverlay';
import { useSidebar } from '@/components/UI/sidebar';
import { ScrollArea } from '../UI/scroll-area';

// Lazy load components
const DefaultProject = lazy(() => import('./DefaultProject'));
const FocusDialog = lazy(() => import('./FocusDialog'));
const EditTileName = lazy(() => import('./EditTileName'));
const Tab = lazy(() => import('./Tab'));

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
}: InterfaceComponentProps) => {

  // Query params - no more tab param needed
  const [projectQueryParam, setProjectQueryParam] = useQueryState("project", { shallow: false });
  const [interfaceQueryParam, setInterfaceQueryParam] = useQueryState("interface", { shallow: false });

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
  const { state: sidebarState } = useSidebar();
  const sidebarWidth = sidebarState === 'collapsed' ? '3rem' : '14rem';

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
    codeActions,
    setOverlayState,
  });

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

  // Update tab primary and accent colors
  useEffect(() => {
    const root = document.documentElement;
    const color = tabUIState?.color;
    if (color) {
        root.style.setProperty("--primary", color);
        root.style.setProperty("--accent", color);
    } else {
        root.style.removeProperty("--primary");
        root.style.removeProperty("--accent");
    }
  }, [tabUIState?.color]);

  // Reset pending state when tab data loads successfully
  useEffect(() => {
    if (tabStreamingQuery?.activeTab.data && tabUIState?.pending) {
      tabUIActions?.setPending(false);
    }
  }, [tabStreamingQuery?.activeTab.data, tabUIState?.pending, tabUIActions]);

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

  return (
    <div className="w-full h-full">
      <ScrollArea className="w-full h-full">
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
            {/* Floating Top Menu Elements */}
            <div 
              className="fixed top-0 z-50 transition-all duration-200 ease-linear pointer-events-none"
              style={{ 
                left: sidebarWidth,
                right: 0,
              }}
            >
              <div className="flex justify-between w-full p-4 pointer-events-auto">
                <ProjectButtons
                  tabIdOrName={activeTabId}
                  interfaceId={interfaceId}
                  projectQueryParam={projectQueryParam}
                  defaultProject={false}
                  setTabQueryParam={setTabQueryParamFromSync}
                  setInterfaceQueryParam={setInterfaceQueryParam}
                  setProjectQueryParam={setProjectQueryParam}
                  projectActions={projectsActions}
                  interfaceActions={interfaceActions}
                  tabActions={tabActions}
                  tileActions={tileActions}
                  fileActions={fileActions}
                  codeActions={codeActions}
                  setOverlayState={setOverlayState}
                />

                <div className="flex flex-row gap-2 items-center">
                  <AutoComplete
                    type={"Actions"}
                    items={storeCommands.map((cmd: Command) => ({
                      label: cmd.label,
                      value: cmd.id,
                      icon: cmd.icon ? iconMap[cmd.icon] : undefined,
                      disabled: cmd.disabled
                    }))}
                    defaultValue={undefined}
                    isOpen={undefined}
                    onSelect={(commandId: string) => handleCommand(commandId)}
                    onOpen={() => {}}
                    loading={false}
                  />
                  {tabUIState?.resetting && (
                    <div className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md rounded-lg p-2">
                      <Loader2 className="animate-spin" />
                    </div>
                  )}
                </div>

                <InterfaceButtons
                  tabIdOrName={activeTabId}
                  interfaceId={interfaceId}
                  logsActions={logsActions}
                  contextActions={contextActions}
                  interfaceActions={interfaceActions}
                  tabActions={tabActions}
                  tileActions={tileActions}
                  projectsActions={projectsActions}
                  fieldsActions={fieldsActions}
                  disabled={saveTabWithTilesMutation.isPending}
                />
              </div>
            </div>

            {/* Content area with deadspace for floating menus */}
            <div 
              className="transition-all duration-200 ease-linear"
              style={{ 
                paddingTop: '6rem',     // Space for top floating menu
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
                    className="mb-auto tutorial-selection-pane relative"
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
                className="fixed bottom-0 z-50 transition-all duration-200 ease-linear pointer-events-none"
                style={{ 
                  left: sidebarWidth,
                  right: 0,
                }}
              >
                <div className="p-4 w-full flex justify-center pointer-events-auto">
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
            <DialogContent className="min-w-full h-full overflow-y-auto">
              <Suspense fallback={<SkeletonLoader />}>
                <FocusDialog
                  tabIdOrName={activeTabId || ""}
                  interfaceId={interfaceId}
                  projectId={projectQueryParam || ""}
                  tileActions={tileActions}
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
        </div>
      </ScrollArea>
    </div>
  );
};

export default Interface;
