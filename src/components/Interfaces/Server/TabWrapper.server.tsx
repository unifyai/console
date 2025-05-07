import { Suspense } from "react";
import Tab from "../Tab";
import TileCardWrapper from "./TileCardWrapper.server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/components/Providers/QueryProvider";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { StoreSliceUpdater } from "@/contexts/providers/StoreSliceUpdater";
import { buildTabStateForStore } from "@/contexts/utils/stateBuilderUtils";
import { IStoreState } from "@/contexts/store";

import type {
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  ContextActions,
  CodeActions,
  GranularTabActions,
  GranularTileActions,
  TabData,
  TileData
} from "@/types/evals/grid";

type TabWrapperActions = {
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
};

export default async function TabWrapper({
  project,
  interfaceName,
  tab,
  actions,
}: {
  project: string | null;
  interfaceName: string;
  tab?: string;
  actions: TabWrapperActions;
}) {
  const qc = getQueryClient();

  // Handle case where no project is selected yet
  if (!project) {
    return <div className="flex items-center justify-center h-full">Please select a project</div>;
  }

  // Prefetch tabs using the query client
  await qc.prefetchQuery({
    queryKey: ["tabs", interfaceName],
    queryFn: () => actions.tabActions.list(interfaceName, false)
  });

  // Get the tabs from the query cache
  const tabs = qc.getQueryData<TabData[]>(["tabs", interfaceName]) || [];
  
  const activeTab = tab 
    ? tabs.find(t => t.name === tab) 
    : tabs.find(t => t.active) || tabs[0];
  
  if (!activeTab) {
    return <div className="flex items-center justify-center h-full">No tabs found</div>;
  }

  // Prefetch tiles for the active tab
  if (activeTab.id) {
    await qc.prefetchQuery({
      queryKey: ["tiles", activeTab.id],
      queryFn: () => actions.tileActions.list(activeTab.id || "", undefined, false)
    });
  }

  // Get the tiles from the query cache
  const tiles = qc.getQueryData<TileData[]>(["tiles", activeTab.id]) || [];

  // Build tab state explicitly - we only need to build the tab state here
  let tabState = {};
  if (activeTab) {
    tabState = buildTabStateForStore(
      activeTab,
      {},  // tableArguments
      true, // isActive
      interfaceName // interfaceId
    );
  }
  
  // Create tab slice - only include tab-specific state
  const slice: Partial<IStoreState> = {
    // Only include tab state, activeTabId is fine since it's part of tab's domain
    activeTabId: activeTab.id || null,
    ...tabState
  };

  // Only need getLatestTab as a dummy function since the others are handled by Zustand
  const getLatestTab = () => {};
  const setNewCounter = () => {};
  const setFocusDialog = () => {};
  const setEditTile = () => {};
  
  // Define a dummy updateTab function that returns a promise
  const updateTab = async () => {
    return { success: "true", message: "Updated" };
  };

  return (
    <>
      {/* Update the store with only tab state */}
      <StoreSliceUpdater slice={slice} />
      
      <HydrationBoundary state={dehydrate(qc)}>
        <Tab
          tabId={activeTab.id || ""}
          interfaceId={interfaceName}
          projectId={project}
          getLatestTab={getLatestTab}
          setNewCounter={setNewCounter}
          setFocusDialog={setFocusDialog}
          setEditTile={setEditTile}
          updateTab={updateTab}
          logsActions={actions.logsActions}
          fieldsActions={actions.fieldsActions}
          derivedEntryActions={actions.derivedEntryActions}
          contextActions={actions.contextActions}
          codeActions={actions.codeActions}
        >
          {tiles.map(tile => (
            <div
              key={tile.id}
              data-grid={{
                i: tile.id,
                x: tile.position?.x || 0,
                y: tile.position?.y || 0,
                w: tile.position?.width || 4,
                h: tile.position?.height || 4,
                visible: true
              }}
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              <Suspense fallback={<SkeletonLoader />}>
                <TileCardWrapper
                  tile={tile}
                  tabId={activeTab.id || ""}
                  interfaceId={interfaceName}
                  projectId={project}
                  actions={actions}
                />
              </Suspense>
            </div>
          ))}
        </Tab>
      </HydrationBoundary>
    </>
  );
}
