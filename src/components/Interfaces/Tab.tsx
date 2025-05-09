"use client";

import React, { useEffect, useMemo, useRef, Suspense, lazy, Children } from "react";
import { WidthProvider, Responsive } from "react-grid-layout";
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import { FieldsActions, LogsActions, DerivedEntryActions, TileProps, ContextActions, CodeActions, GranularTileActions } from "@/types/evals/grid";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { cleanupTileRefs } from '@/utils/refRegistry';

const ResponsiveReactGridLayout = WidthProvider(Responsive);
const TileCard = lazy(() => import('./TileCard'));
const TileButtons = lazy(() => import('./TileButtons'));

interface TabComponentProps {
  interfaceId: string;
  tabId: string;
  projectId: string;
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  children?: React.ReactNode;
}

const Tab = ({
  interfaceId,
  tabId,
  projectId,
  tileActions,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions,
  codeActions,
  children,
}: TabComponentProps) => {
  // Use granular hooks instead of a general hook
  const anyTileLoading = useStoreContext(state => getAnyTileLoading(state));

  const { 
    data: tabDataState,
    dataActions: tabDataActions
  } = useTabData(tabId, interfaceId);
  
  const {
    ui: tabUIState,
    uiActions: tabUIActions
  } = useTabUI(tabId, interfaceId);

  // Get project id and contexts from store
  const projectData = useStoreContext(state => 
    projectId ? state.projectsById[projectId] : null
  );
  const contexts = projectData?.contexts || [];

  // Get tileIds from tab data properly
  const tileIds = useMemo(() => tabDataState?.tileIds || [], [tabDataState?.tileIds]);

  // Get tile props using the getItems function from the tab data actions
  const tileProps = useMemo(() => {
    return (!tabDataActions) ? [] : tabDataActions.getItems();
  }, [tabDataActions]);

  // Create a refresh key that changes when tileIds change
  const tileRefreshKey = useMemo(() => 
    Date.now(),
    [tileIds.join(',')]
  );

  // Add a ref to track initial mount
  const isInitialMount = useRef(true);

  // Get the unregisterTileRefs function from Zustand
  const unregisterTileRefs = useStoreContext(state => state.unregisterTileRefs);

  // // Set up effect to fetch the latest tab when project or tab changes
  // useEffect(() => {
  //   if (projectId && tabId) {
  //     // Store current selections in cookies
  //     // const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  //     // Cookies.set("project", projectId, { expires: expirationDate });
  //     // Cookies.set("tab", tabId, { expires: expirationDate });
      
  //     // Only fetch data on initial mount or when project/tab actually changes
  //     if (isInitialMount.current) {
  //       getLatestTab();
  //       isInitialMount.current = false;
  //     }
  //   }
  //   // else if (!projectId) {
  //   //   Cookies.remove("project");
  //   // }
  //   // else if (!tabId) {
  //   //   Cookies.remove("tab");
  //   // }
  // }, [projectId, tabId, getLatestTab]);

  // // Only call updateInterface when items have truly changed.
  // useEffect(() => {
  //   (() => {
  //     try {
  //       if (!tabUIState?.resetting) {
  //         updateTab(null, tileProps);
  //       }
  //     } catch (err) {
  //       console.error("updateTab failed:", err);
  //     }
  //   })();
  // }, [tileProps, tabDataState?.globalContext]);

  // // Trigger update when data changes in React Query (instead of table data)
  // useEffect(() => {
  //   if (!tabDataState || !tabUIActions || !tabDataActions) return;

  //   // Use setTimeout to delay execution
  //   setTimeout(() => {
  //     // Reset loading states
  //     if (interfaceUIState?.dataPending === true) {
  //       interfaceUIActions.setDataPending(false);
  //     }
  //     if (tabUIState?.refreshing === true) {
  //       tabUIActions.setRefreshing(false);
  //     }

  //     // If tab is pending or resetting, get latest data
  //     if ((interfaceUIState?.pending || tabUIState?.resetting) && projectId && tabId) {
  //       getLatestTab();
  //     }

  //     // Reset resetting state
  //     tabUIActions.setResetting(false);
  //   }, 1500);
  // }, [tileRefreshKey]);

  // End success green after 3 seconds
  useEffect(() => { 
    const timer = setTimeout(() => tabUIActions?.setSaveSuccess(undefined), 3000);
    return () => clearTimeout(timer);
  }, [tabUIState?.saveSuccess, tabUIActions]);

  // Cleanup refs when Tab unmounts or when tiles change
  useEffect(() => {
    // Return cleanup function
    return () => {
      // Clean up refs for all current tiles
      tileIds.forEach(tileId => {
        unregisterTileRefs(tileId);
        cleanupTileRefs(tileId);
      });
    };
  }, [tileIds, unregisterTileRefs]);

  // Item layout change handler
  const onLayoutChange = (newLayout: any[]) => {
    if (!tabUIState?.pending && tabDataActions) {
      const layoutItems = newLayout.map((item) => {
        const originalItem = tileProps.find((t) => t.name === item.name);
        return { ...originalItem, ...item };
      });
      tabDataActions.setItems(layoutItems);
    } else {
      tabUIActions?.setPending(false);
    }
  };

  // Show loading state if tab data is not yet available
  if (!tabDataState || !tabUIState) {
    return null;
  }

  const dragResizeDisabled = tabUIState?.pending || tabUIState?.resetting || anyTileLoading;

  /* ------------------------------------------------------------------
     Build the list of tiles we will *actually* render.
     – If <children> were supplied, treat them as the server-rendered
       <TileCard> nodes and keep their order.
     – Otherwise fall back to the old behaviour and create <TileCard>s
       here in the client.
  ------------------------------------------------------------------ */
  const tilesToRender = (children) ? Children.toArray(children) : tileProps.map((item: TileProps, idx: number) => (
    <Suspense
      key={item.name}
      fallback={
        <div className="w-full h-full flex items-center justify-center border p-4">
          <SkeletonLoader />
        </div>
      }
    >
      <TileCard
        tileId={item.id}
        tabId={tabId}
        interfaceId={interfaceId}
        projectId={projectId}
        tileActions={tileActions}
        logsActions={logsActions}
        fieldsActions={fieldsActions}
        derivedEntryActions={derivedEntryActions}
        contextActions={contextActions}
        codeActions={codeActions}
      />
    </Suspense>
  ));

  return (
    <ResponsiveReactGridLayout
        onLayoutChange={onLayoutChange}
        className="layout interactive-grid flex-1 mx-1"
        cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
        rowHeight={105}
        margin={[0, 0]}
        containerPadding={[0, 0]}
        isDraggable={tabUIState?.edit && !dragResizeDisabled}
        isResizable={tabUIState?.edit && !dragResizeDisabled}
        draggableHandle=".drag"
        resizeHandles={["e", "w", "s", "n", "se", "sw", "ne", "nw"]}
    >
      {tilesToRender.map((child, idx) => {
        const item = tileProps[idx];
        if (!item || !item.visible) return null;

        return (
          <div
            key={item.id}
            data-grid={item}
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Server-rendered or client-rendered TileCard */}
            {child}

            {/* Extra client-side controls */}
            <TileButtons
              tileId={item.id}
              tabId={tabId}
              interfaceId={interfaceId}
              projectId={projectId}
              contexts={contexts}
              logsActions={logsActions}
              contextActions={contextActions}
              codeActions={codeActions}
            />
          </div>
        );
      })}
    </ResponsiveReactGridLayout>
  );
};

export default Tab; 