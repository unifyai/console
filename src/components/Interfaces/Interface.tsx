"use client";

import React, { useState, useRef, Suspense, useMemo, useEffect, lazy } from 'react';
import { useRouter } from "next/navigation";
import { Loader2, Plus, X, Trash } from "lucide-react";
import { Tabs, TabsContent } from "../UI/tabs";
import { Dialog, DialogContent } from "../UI/dialog";
import ActionButton from "../Common/Buttons/Action";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import InterfaceButtons from "./InterfaceButtons";
import InterfaceTabs from "./InterfaceTabs";
import ProjectButtons from "./ProjectButtons";
import { useQueryState } from "nuqs";
import { ProjectsActions, LogsActions, FieldsActions, DerivedEntryActions, ContextActions, CodeActions, GranularInterfaceActions, GranularTabActions, GranularTileActions } from '@/types/evals/grid';

import { useInterfaceData } from '@/contexts/hooks/interface';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import AutoComplete from '../Common/Misc/AutoComplete';
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { Command } from '@/contexts/slices/selectors/commands';
import { iconMap } from '@/constants/logs';
import { Toaster } from 'sonner';
import { useCreateTabQuery, useUpdateTabQuery } from '@/hooks/Query/useTabsQuery';
import { useSaveTabWithTilesQuery } from '@/hooks/Query/useSaveTabWithTilesQuery';
import { useCommand } from '@/contexts/hooks/commands/useCommand';
import { useRestoreLastSavedTabWithTilesQuery } from '@/hooks/Query/useRestoreLastSavedTabWithTilesQuery';

// Lazy load components
const Tab = lazy(() => import('./Tab'));
const DefaultProject = lazy(() => import('./DefaultProject'));
const FocusDialog = lazy(() => import('./FocusDialog'));
const EditTileName = lazy(() => import('./EditTileName'));

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
  children: React.ReactNode;
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
  children
}: InterfaceComponentProps) => {
  const router = useRouter();

  // Query params
  const [tabQueryParam, setTabQueryParam] = useQueryState("tab", { shallow: false });
  const [interfaceQueryParam, setInterfaceQueryParam] = useQueryState("interface", { shallow: false });
  const [projectQueryParam, setProjectQueryParam] = useQueryState("project", { shallow: false });

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

  // Get interface and project data from hooks with granular access
  const { dataActions: interfaceDataActions } = useInterfaceData(interfaceId);

  // Use granular tab hooks for better performance
  const { data: tabDataState, dataActions: tabDataActions } = useTabData(tabQueryParam || "", interfaceId);
  const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabQueryParam || "", interfaceId);

  // Initialize command hooks
  const commandHooks = useCommand({
    projectId: projectQueryParam,
    interfaceId,
    tabId: tabQueryParam,
    setProject: setProjectQueryParam,
    setTabQueryParam,
    setInterfaceQueryParam,
    projectActions: projectsActions,
    interfaceActions,
    tabActions,
    tileActions,
  });

  // Reference for the grid container
  const gridRef = useRef<HTMLDivElement>(null);

  // Get tab names for the current interface
  const tabNames = useMemo(() => interfaceDataActions?.getTabNames() || [], [interfaceDataActions]);

  // Set active tab handler
  const handleTabChange = (value: string | undefined) => {
    if (tabUIState && !tabUIState?.deleting) {
      if (tabUIActions) {
        tabUIActions.setPending(true);
        tabUIActions.setDataPending(true);
      }
      // Update URL query param
      setTabQueryParam(value || null);
    }
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

  // Add a useEffect to reset the error state and refresh data
  useEffect(() => {
    // Reset any error states when tab changes
    if (createTabMutation.isError) {
      createTabMutation.reset();
    }
    if (updateTabMutation.isError) {
      updateTabMutation.reset();
    }
  }, [tabQueryParam, createTabMutation, updateTabMutation]);

  // Handle save dialog submission
  const handleSaveDialog = async () => {
    if (!tabQueryParam || !projectQueryParam || !interfaceQueryParam) {
      console.error("Missing tab or project or interface");
      return;
    }
    
    // Hide the dialog
    setSaveInterfaceOpen(false);
    
    // Show loading state
    if (tabUIActions) {
      tabUIActions.setPending(true);
    }
    
    try {
      // Get the tile IDs for this tab
      const tileIds = tabDataActions?.getItems().map(item => item.id) || [];
      
      // Create a checkpoint of the tab and all its tiles
      await saveTabWithTilesMutation.mutateAsync({
        interface_id: interfaceId,
        tab_name: tabQueryParam,
        tile_ids: tileIds
      });
      
      // Show success message
      if (tabUIActions) {
        tabUIActions.setSaveSuccess(true);
      }
      
    } catch (error) {
      console.error("Failed to save tab:", error);
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
      case "reset-tab":
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
    <div className="w-full h-full overflow-auto relative bg-background" ref={gridRef}>
      <Toaster richColors position="bottom-right" closeButton />
      {/* ---------------------------------------------------------
          Top-level Suspense: covers the whole Tabs area so that
          the user sees a Skeleton while the server-rendered Tabs
          (and their children) are still being streamed / hydrated.
        --------------------------------------------------------- */}
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <SkeletonLoader />
          </div>
        }
      >
        <Tabs
          value={tabQueryParam || undefined}
          onValueChange={handleTabChange}
          className="w-full h-full flex flex-col tutorial-details-panel"
        >
          <div className="sticky top-0 z-10 bg-background p-2 flex justify-between w-full">
            {/* Project buttons and add/delete buttons */}
            <ProjectButtons
              tabIdOrName={tabQueryParam || ""}
              interfaceId={interfaceId}
              projectQueryParam={projectQueryParam}
              defaultProject={false}
              setTabQueryParam={setTabQueryParam}
              setInterfaceQueryParam={setInterfaceQueryParam}
              setProjectQueryParam={setProjectQueryParam}
              projectActions={projectsActions}
              interfaceActions={interfaceActions}
              tabActions={tabActions}
              tileActions={tileActions}
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
              {tabUIState?.resetting && <Loader2 className="animate-spin" />}
            </div>

            {/* Interface buttons */}
            <InterfaceButtons
              tabIdOrName={tabQueryParam || ""}
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
                  derivedEntryActions={derivedEntryActions}
                  setTabQueryParam={setTabQueryParam}
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
                {tabUIState?.pending || createTabMutation.isPending || updateTabMutation.isPending ? (
                  <div className="flex justify-center">
                    <Loader2 className="animate-spin my-36" />
                  </div>
                ) : tabQueryParam != tabName ? (
                  <div key={idx} className="flex text-center justify-center">
                    <Loader2 className="animate-spin my-36" />
                  </div>
                ) : (
                  // Replace Tab component with the server-rendered children
                  <Suspense fallback={<div className="w-full h-full"><SkeletonLoader /></div>}>
                    {/* <Tab
                      tabId={tabQueryParam || ""}
                      interfaceId={interfaceId}
                      projectId={projectQueryParam || ""}
                      logsActions={logsActions}
                      fieldsActions={fieldsActions}
                      derivedEntryActions={derivedEntryActions}
                      contextActions={contextActions}
                      codeActions={codeActions}
                    /> */}
                    {children}
                  </Suspense>
                )}
              </TabsContent>
            ))
          )}

          {/* Interface tabs */}
          {projectQueryParam && interfaceQueryParam && <div className="sticky bottom-0 z-10 p-2 bg-background flex w-full">
            <InterfaceTabs
              tabIdOrName={tabQueryParam || ""}
              interfaceId={interfaceId}
              interfaceActions={interfaceActions}
              tabActions={tabActions}
              setTabQueryParam={setTabQueryParam}
            />
          </div>}
        </Tabs>
      </Suspense>

      {/* Focus Dialog */}
      {focusPaneOpen && (
        <Dialog open={true} onOpenChange={() => setFocusPaneOpen(false)}>
          <DialogContent className="min-w-full h-full overflow-y-auto">
            <Suspense fallback={<SkeletonLoader />}>
              <FocusDialog
                tabIdOrName={tabQueryParam || ""}
                interfaceId={interfaceId}
                projectId={projectQueryParam || ""}
                tileActions={tileActions}
                logsActions={logsActions}
                fieldsActions={fieldsActions}
                derivedEntryActions={derivedEntryActions}
                contextActions={contextActions}
                codeActions={codeActions}
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
            tabIdOrName={tabQueryParam || ""}
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
                <span className="font-semibold">{tabQueryParam}</span>?
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
  );
};

export default Interface;
