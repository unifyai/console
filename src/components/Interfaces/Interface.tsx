"use client";

import React, { useState, useRef, Suspense, useMemo, useEffect, useCallback, lazy } from 'react';
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent } from "../UI/tabs";
import { Dialog, DialogContent } from "../UI/dialog";
import ActionButton from "../Common/Buttons/Action";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import InterfaceButtons from "./InterfaceButtons";
import InterfaceTabs from "./InterfaceTabs";
import ProjectButtons from "./ProjectButtons";
import { Context, TabProps, TileProps } from "@/types/evals/grid";
import { useQueryState } from "nuqs";
import { ProjectsActions, TabActions, LogsActions, FieldsActions, DerivedEntryActions, ContextActions, CodeActions } from '@/types/evals/grid';
import { ResponseProps } from '@/types/common';

import { useInterfaceData } from '@/contexts/hooks/interface';
import { useTabMeta, useTabData, useTabUI } from '@/contexts/hooks/tab';
import { useProjectData, useProjectMeta } from '@/contexts/hooks/project';

// Lazy load components
const Tab = lazy(() => import('./Tab'));
const DefaultProject = lazy(() => import('./DefaultProject'));
const FocusDialog = lazy(() => import('./FocusDialog'));
const EditTileName = lazy(() => import('./EditTileName'));

interface InterfaceComponentProps {
  interfaceId: string;
  projectsActions: ProjectsActions;
  tabActions: TabActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
}

const Interface = ({ 
  interfaceId, 
  projectsActions,
  tabActions: serverTabActions,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions,
  codeActions
}: InterfaceComponentProps) => {
  const router = useRouter();

  // Query params
  const [tabQueryParam, setTabQueryParam] = useQueryState("tab", { shallow: false });
  const [projectQueryParam, setProjectQueryParam] = useQueryState("project", { shallow: false });

  // Get interface and project data from hooks with granular access
  const { data: projectDataState } = useProjectData(projectQueryParam || null);
  const { meta: projectMetaState } = useProjectMeta(projectQueryParam || null);
  const { dataActions: interfaceDataActions } = useInterfaceData(interfaceId);

  // Use granular tab hooks for better performance
  const { meta: tabMetaState, metaActions: tabMetaActions } = useTabMeta(tabQueryParam || "", interfaceId);
  const { data: tabDataState, dataActions: tabDataActions } = useTabData(tabQueryParam || "", interfaceId);
  const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabQueryParam || "", interfaceId);

  // Local UI state - only keeping what's absolutely necessary as local state
  const [focusDialog, setFocusDialog] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [editTile, setEditTile] = useState<string | undefined>();
  const [newCounter, setNewCounter] = useState(0);
  
  // Reference for the grid container
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Additional data preparation
  const contexts: Context[] = useMemo(() => projectDataState?.contexts || [], [projectDataState]);

  // Get tile props using the getItems function from the tab data actions
  const tileProps = useMemo(() => {
    return (!tabDataActions) ? [] : tabDataActions.getItems();
  }, [tabDataActions]);

  // Get tab names for the current interface
  const tabNames = useMemo(() => interfaceDataActions?.getTabNames() || [], [interfaceDataActions]);

  // update interface – preserves context functionality
  const updateTab = useCallback((savedTab: TabProps | null = null, updatedTileProps: TileProps[] | TileProps | null = null) => {
    let currentTileProps: TileProps[] = [];
    // If updatedTileProps is an array, we need to update all the tiles in the array
    if (Array.isArray(updatedTileProps)) {
      currentTileProps = updatedTileProps;
    } else {
      // If an updated tileProps is provided, create a new version of tileProps with the update
      currentTileProps = updatedTileProps 
        ? tileProps.map((tp: TileProps) => tp.i === updatedTileProps.i ? updatedTileProps : tp) 
        : tileProps;
    }
    const context_1 = savedTab != null ? savedTab.context : tabDataState?.globalContext;
    const items_1 = savedTab?.items ?? currentTileProps;
    const newCounter_1 = savedTab?.new_counter ?? newCounter;

    if (
        tabQueryParam &&
        projectQueryParam &&
        tabQueryParam === tabMetaState?.name &&
        projectQueryParam === projectMetaState?.name &&
        !tabUIState?.pending
    ) {
        if (tabMetaState?.tempTabCreated) {
            return serverTabActions.update(
                tabQueryParam,
                projectQueryParam as string,
                context_1,
                items_1,
                newCounter_1,
                undefined,
                true
            );
        } else {
            return serverTabActions.create(
                tabQueryParam,
                projectQueryParam as string,
                context_1,
                items_1,
                newCounter_1,
                true
            );
        }
    }
    return Promise.reject(Error("updateTab conditions not met"));
  }, [
    tabQueryParam, 
    projectQueryParam, 
    tabDataState?.globalContext, 
    tabMetaState?.tempTabCreated, 
    tabUIState?.pending, 
    serverTabActions,
    tileProps,
    newCounter,
    tabMetaState?.name,
    projectMetaState?.name
  ]);

  // Function to get the latest tab from the server and sync state
  const getLatestTab = useCallback(() => {
    if (!projectQueryParam || !tabQueryParam) return;

    serverTabActions?.get(projectQueryParam, true).then((tabProps: TabProps[]) => {
      const currentTab = tabProps.find(t => t.name == tabQueryParam);

      if (currentTab && tabUIActions && tabDataActions && tabMetaActions && interfaceDataActions) {
        // Update the tab's global context
        tabDataActions.setGlobalContext(currentTab.context);

        // Update items (tiles) with correct context
        const updatedItems = currentTab.items.map(item => ({
          ...item,
          context: contexts.find(
            ctx => ctx.name == currentTab.context
          )?.name ?? item.context
        }));

        // For each item in the current tab, update the tile in the store
        tabDataActions.setItems(updatedItems);

        setNewCounter(currentTab.new_counter || 0);
        tabMetaActions.setTempTabCreated(Boolean(currentTab));
        tabUIActions.setPending(false);
        interfaceDataActions?.setTabNames(tabProps.map(tab => tab.name));
      }
    });
  }, [projectQueryParam, tabQueryParam, tabUIActions, tabDataActions, tabMetaActions, interfaceDataActions, contexts]);

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
  }, [newCounter]);

  return (
    <div className="w-full h-full overflow-auto relative bg-background" ref={gridRef}>
      <Tabs
        value={tabQueryParam || undefined}
        onValueChange={handleTabChange}
        className="w-full tutorial-details-panel"
      >
        <div className="sticky top-0 z-10 bg-background p-2 flex justify-between w-full md:overflow-none overflow-x-auto">
          {/* Project buttons and add/delete buttons */}
          <ProjectButtons
            interfaceId={interfaceId}
            tabQueryParam={tabQueryParam}
            projectQueryParam={projectQueryParam}
            defaultProject={false}
            setTabQueryParam={setTabQueryParam}
            setProjectQueryParam={setProjectQueryParam}
            projectActions={projectsActions}
            tabActions={serverTabActions}
          />

          {/* Interface tabs */}
          {projectQueryParam && (
            <InterfaceTabs
              interfaceId={interfaceId}
              tabQueryParam={tabQueryParam}
              newCounter={newCounter}
              setTabQueryParam={setTabQueryParam}
              tabActions={serverTabActions}
            />
          )}

          {/* Interface buttons */}
          <InterfaceButtons
            interfaceId={interfaceId}
            tabQueryParam={tabQueryParam}
            newCounter={newCounter}
            setNewCounter={setNewCounter}
            updateTab={updateTab}
            focusDialog={focusDialog}
            setFocusDialog={setFocusDialog}
            saveDialog={saveDialog}
            setSaveDialog={setSaveDialog}
            contextActions={contextActions}
          />
        </div>

        {tabNames.length === 0 ? (
          projectQueryParam && tabUIState?.pending ? (
            <div className="flex justify-center">
              <Loader2 className="animate-spin my-36" />
            </div>
          ) : !projectQueryParam ? (
            <Suspense fallback={<div className="flex justify-center"><Loader2 className="animate-spin my-36" /></div>}>
              <DefaultProject
                projectActions={projectsActions}
                tabActions={serverTabActions}
                logsActions={logsActions}
                codeActions={codeActions}
                derivedEntryActions={derivedEntryActions}
                setTabQueryParam={setTabQueryParam}
                setProjectQueryParam={setProjectQueryParam}
              />
            </Suspense>
          ) : null
        ) : (
          tabNames.map((tabName: string, idx: number) => (
            <TabsContent
              key={idx}
              value={tabName}
              className="tutorial-selection-pane relative"
            >
              {tabUIState?.pending ? (
                <div className="flex justify-center">
                  <Loader2 className="animate-spin my-36" />
                </div>
              ) : tabQueryParam != tabName ? (
                <div key={idx} className="flex text-center justify-center">
                  <Loader2 className="animate-spin my-36" />
                </div>
              ) : (
                <Suspense fallback={<div className="w-full h-full"><SkeletonLoader /></div>}>
                  <Tab
                    tabId={tabQueryParam || ""}
                    interfaceId={interfaceId}
                    projectId={projectQueryParam || ""}
                    setNewCounter={setNewCounter}
                    setEditTile={setEditTile}
                    updateTab={updateTab}
                    getLatestTab={getLatestTab}
                    setFocusDialog={setFocusDialog}
                    logsActions={logsActions}
                    fieldsActions={fieldsActions}
                    derivedEntryActions={derivedEntryActions}
                    contextActions={contextActions}
                  />
                </Suspense>
              )}
            </TabsContent>
          ))
        )}
      </Tabs>

      {/* Focus Dialog */}
      {focusDialog && (
        <Dialog open={true} onOpenChange={() => setFocusDialog(false)}>
          <DialogContent className="min-w-full h-full overflow-y-auto">
            <Suspense fallback={<SkeletonLoader />}>
              <FocusDialog
                tabId={tabQueryParam || ""}
                interfaceId={interfaceId}
                projectId={projectQueryParam || ""}
                updateTab={updateTab}
                setFocusDialog={setFocusDialog}
                logsActions={logsActions}
                fieldsActions={fieldsActions}
                derivedEntryActions={derivedEntryActions}
                contextActions={contextActions}
              />
            </Suspense>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Tile Name Dialog */}
      {tabUIState?.edit && editTile && (
        <Suspense fallback={<div className="w-full h-16"><SkeletonLoader /></div>}>
          <EditTileName
            tabId={tabQueryParam || ""}
            editTile={editTile}
            setEditTile={setEditTile}
          />
        </Suspense>
      )}

      {/* Save Dialog */}
      {saveDialog && (
        <Dialog open={true} onOpenChange={() => setSaveDialog(false)}>
          <DialogContent className="w-1/4">
            <div className="mt-4 flex flex-col gap-4">
              <div>
                Are you sure you want to save the changes to{" "}
                <span className="font-semibold">{tabQueryParam}</span>?
              </div>
              <div className="flex justify-end pr-2">
                <ActionButton
                  className="w-fit remove cursor-pointer mr-0 justify-self-end"
                  onClick={async () => {
                    if (tabUIState?.saveSuccess == undefined) {
                        let response: ResponseProps | undefined = undefined;
                        if (tabMetaState?.tabCreated) {
                            response = await serverTabActions.update(
                                tabQueryParam as string,
                                projectQueryParam as string,
                                tabDataState?.globalContext,
                                tileProps,
                                newCounter,
                                undefined,
                                false
                            );
                        } else {
                            response = await serverTabActions.create(
                                tabQueryParam as string,
                                projectQueryParam as string,
                                tabDataState?.globalContext,
                                tileProps,
                                newCounter,
                                false
                            );
                        }
                        if (response && "info" in response) {
                            tabUIActions?.setSaveSuccess(true);
                        } else {
                            tabUIActions?.setSaveSuccess(false);
                        }
                        setSaveDialog(false);
                        router.refresh();
                    }
                  }}
                  text="Save"
                  tooltip=""
                  variant="primary"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Interface;
