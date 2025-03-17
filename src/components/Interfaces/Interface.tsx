"use client";

import React, { useState, useRef, Suspense, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent } from "../UI/tabs";
import { Dialog, DialogContent } from "../UI/dialog";
import ActionButton from "../Common/Buttons/Action";
import FocusDialog from "./FocusDialog";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import Tab from './Tab';
import DefaultProject from "./DefaultProject";
import InterfaceButtons from "./InterfaceButtons";
import InterfaceTabs from "./InterfaceTabs";
import ProjectButtons from "./ProjectButtons";
import EditTileName from "./EditTileName";
import { useInterface } from '@/contexts/hooks/useInterface';
import { useTab } from '@/contexts/hooks/useTab';
import { Context, TabProps } from "@/types/evals/grid";
import { useQueryState } from "nuqs";
import { ProjectsActions, TabActions, LogsActions, FieldsActions, DerivedEntryActions, ContextActions } from '@/types/evals/grid';
import { ResponseProps } from '@/types/common';

interface InterfaceComponentProps {
  interfaceId: string;
  projectsActions: ProjectsActions;
  tabActions: TabActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
}

const Interface = ({ 
  interfaceId, 
  projectsActions,
  tabActions: serverTabActions,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions
}: InterfaceComponentProps) => {
  const router = useRouter();

  // Query params
  const [tabQueryParam, setTabQueryParam] = useQueryState("tab", { shallow: false });
  const [projectQueryParam, setProjectQueryParam] = useQueryState("project", { shallow: false });

  // Get interface and project data from hooks
  const { actions: interfaceActions } = useInterface(interfaceId);
  const { tab: tabData, actions: tabActions } = useTab(tabQueryParam || "", interfaceId);

  // Local UI state - only keeping what's absolutely necessary as local state
  const [focusDialog, setFocusDialog] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [editTile, setEditTile] = useState<string | undefined>();
  const [newCounter, setNewCounter] = useState(0);
  
  // Reference for the grid container
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Additional data preparation
  const contexts: Context[] = [];

  // Get tile props using the getItems function from the tabActions
  const tileProps = useMemo(() => {
    return (!tabActions || !tabData) ? [] : tabActions.getItems();
  }, [tabActions, tabData]);

  // Get tab Ids for the current interface
  const tabIds = useMemo(() => interfaceActions?.getTabIds() || [], [interfaceActions]);

  // update interface – preserves context functionality
  const updateTab = (savedTab: TabProps | null = null) => {
    const context_1 = savedTab != null ? savedTab.context : tabData?.globalContext;
    const items_1 = savedTab?.items ?? tileProps;
    const newCounter_1 = savedTab?.new_counter ?? newCounter;

    if (
        tabQueryParam &&
        projectQueryParam &&
        tabQueryParam === tabData?.id &&
        projectQueryParam === "Plots" &&
        !tabData?.pending
    ) {
        if (tabData?.tempTabCreated) {
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
  };

  // Function to get the latest tab from the server and sync state
  const getLatestTab = useCallback(() => {
    if (!projectQueryParam || !tabQueryParam) return;

    serverTabActions?.get(projectQueryParam, true).then((tabProps: TabProps[]) => {
      const currentTab = tabProps.find(t => t.name == tabQueryParam);

      if (currentTab && tabActions) {
        // Update the tab's global context
        tabActions.setGlobalContext(currentTab.context);

        // Update items (tiles) with correct context
        const updatedItems = currentTab.items.map(item => ({
          ...item,
          context: contexts.find(
            ctx => ctx.name == currentTab.context
          )?.name ?? item.context
        }));

        // For each item in the current tab, update the tile in the store
        tabActions.setItems(updatedItems);

        setNewCounter(currentTab.new_counter || 0);
        tabActions.setTempTabCreated(Boolean(currentTab));
        tabActions.setPending(false);
        interfaceActions?.setTabIds(tabProps.map(tab => tab.name).sort());
      }
    });
  }, [projectQueryParam, tabQueryParam, tabActions, interfaceActions, contexts]);

  // Set active tab handler
  const handleTabChange = (value: string | undefined) => {
    if (tabData && !tabData.deleting) {
      if (tabActions) {
        tabActions.setPending(true);
        tabActions.setDataPending(true);
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
    <div className="w-full h-full overflow-auto relative" ref={gridRef}>
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

        {tabIds.length === 0 ? (
          projectQueryParam && tabData?.pending ? (
            <div className="flex justify-center">
              <Loader2 className="animate-spin my-36" />
            </div>
          ) : !projectQueryParam ? (
            <DefaultProject
              projectActions={projectsActions}
              tabActions={serverTabActions}
              logsActions={logsActions}
              derivedEntryActions={derivedEntryActions}
              setTabQueryParam={setTabQueryParam}
              setProjectQueryParam={setProjectQueryParam}
            />
          ) : null
        ) : (
          tabIds.map((tabId: string, idx: number) => (
            <TabsContent
              key={idx}
              value={tabId}
              className="tutorial-selection-pane relative"
            >
              {tabData?.pending ? (
                <div className="flex justify-center">
                  <Loader2 className="animate-spin my-36" />
                </div>
              ) : tabQueryParam != tabId ? (
                <div key={idx} className="flex text-center justify-center">
                  <Loader2 className="animate-spin my-36" />
                </div>
              ) : (
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
                getLatestTab={getLatestTab}
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

      {/*  */}

      {/* Edit Tile Name Dialog */}
      {tabData?.edit && editTile && (
        <EditTileName
          tabId={tabQueryParam || ""}
          editTile={editTile}
          setEditTile={setEditTile}
        />
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
                    if (tabData?.saveSuccess == undefined) {
                        let response: ResponseProps | undefined = undefined;
                        if (tabData?.tabCreated) {
                            response = await serverTabActions.update(
                                tabQueryParam as string,
                                projectQueryParam as string,
                                tabData?.globalContext,
                                tileProps,
                                newCounter,
                                undefined,
                                false
                            );
                        } else {
                            response = await serverTabActions.create(
                                tabQueryParam as string,
                                projectQueryParam as string,
                                tabData?.globalContext,
                                tileProps,
                                newCounter,
                                false
                            );
                        }
                        if (response && "info" in response) {
                            tabActions?.setSaveSuccess(true);
                        } else {
                            tabActions?.setSaveSuccess(false);
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
