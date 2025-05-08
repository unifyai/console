import { Suspense } from "react";
import Tab from "../Tab";
import TileCardWrapper from "./TileCardWrapper.server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from '@/lib/react-query/getQueryClient';
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { StoreSliceUpdater } from "@/contexts/providers/StoreSliceUpdater";
import { buildTabStateForStore } from "@/contexts/utils/stateBuilderUtils";
import { IStoreState } from "@/contexts/store";
import { redirect } from "next/navigation";

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
  interfaceId,
  interfaceName,
  tab,
  actions,
}: {
  project: string | null;
  interfaceId: string;    // UUID for API calls
  interfaceName: string;  // Name for query params
  tab?: string;           // Tab name from query params
  actions: TabWrapperActions;
}) {
  const qc = getQueryClient();

  // Handle case where no project is selected yet
  if (!project) {
    return <div className="flex items-center justify-center h-full">Please select a project</div>;
  }

  // Handle case where no interface is provided
  if (!interfaceId) {
    return <div className="flex items-center justify-center h-full">Please select an interface</div>;
  }

  // Prefetch tabs using the query client - use interfaceId for API calls
  await qc.prefetchQuery({
    queryKey: ["tabs", interfaceId],
    queryFn: () => actions.tabActions.list(interfaceId, false)
  });

  // Get the tabs from the query cache
  const tabs = qc.getQueryData<TabData[]>(["tabs", interfaceId]) || [];
  
  // Find the current tab based on various scenarios
  let activeTab: TabData | null = null;
  
  // First check if a specific tab was requested in the URL
  if (tab) {
    activeTab = tabs.find(t => t.name === tab) || null;
  } 
  
  // If no tab was found or specified, try to find an active tab
  if (!activeTab) {
    activeTab = tabs.find(t => t.active) || null;
  }
  
  // If still no tab found, use the first tab if available
  if (!activeTab && tabs.length > 0) {
    activeTab = tabs[0];
  }
  
  // Redirect if we have a valid interface but no tab in the URL
  if (!tab && project && interfaceName && activeTab && activeTab.name) {
    // Use interfaceName (not interfaceId) in query params 
    redirect(`/interfaces?project=${encodeURIComponent(project)}&interface=${encodeURIComponent(interfaceName)}&tab=${encodeURIComponent(activeTab.name)}`);
  }
  
  // If no active tab could be found, show a message
  if (!activeTab) {
    return <div className="flex items-center justify-center h-full">No tabs found</div>;
  }

  // Prefetch tiles for the active tab - use tabId for API calls
  const tabId = activeTab.id || "";
  const tabName = activeTab.name || "";
  
  if (tabId) {
    await qc.prefetchQuery({
      queryKey: ["tiles", tabId],
      queryFn: () => actions.tileActions.list(tabId, undefined, false)
    });
  }

  // Get the tiles from the query cache
  const tiles = qc.getQueryData<TileData[]>(["tiles", tabId]) || [];

  // Build tab state explicitly - we only need to build the tab state here
  let tabState = {};
  if (activeTab) {
    tabState = buildTabStateForStore(
      activeTab,
      {},  // tableArguments
      true, // isActive
      interfaceId // Use interfaceId for the store
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
          tabId={tabId}
          interfaceId={interfaceId} /* Use interfaceId for component props */
          projectId={project}
          getLatestTab={getLatestTab}
          setNewCounter={setNewCounter}
          setFocusDialog={setFocusDialog}
          setEditTile={setEditTile}
          updateTab={updateTab}
          tileActions={actions.tileActions}
          logsActions={actions.logsActions}
          fieldsActions={actions.fieldsActions}
          derivedEntryActions={actions.derivedEntryActions}
          contextActions={actions.contextActions}
          codeActions={actions.codeActions}
        >
          {tiles.map(tile => (
            <Suspense fallback={<SkeletonLoader />}>
              <TileCardWrapper
                tile={tile}
                tabId={tabId}
                interfaceId={interfaceId} /* Use interfaceId for API calls */
                projectId={project}
                actions={actions}
              />
            </Suspense>
          ))}
        </Tab>
      </HydrationBoundary>
    </>
  );
}
