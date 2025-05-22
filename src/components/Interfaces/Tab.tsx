"use client";

import React, { useEffect, useMemo, useRef, Suspense, lazy, ReactElement } from "react";
import { WidthProvider, Responsive, Layout } from "react-grid-layout";
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import { FieldsActions, LogsActions, DerivedEntryActions, TileProps, ContextActions, CodeActions, GranularTileActions, GranularTabActions, TileLayout, TilePosition, ProjectsActions } from "@/types/evals/grid";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { cleanupTileRefs } from '@/utils/refRegistry';
import { useTabSync } from "@/contexts/hooks/tab/sync/useTabSync";

const ResponsiveReactGridLayout = WidthProvider(Responsive);
const TileCard = lazy(() => import('./TileCard'));
const TileButtons = lazy(() => import('./TileButtons'));

interface TabComponentProps {
  tabId: string;
  interfaceId: string;
  projectId: string;
  projectsActions: ProjectsActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  children?: React.ReactNode;
}

const Tab = ({
  tabId,
  interfaceId,
  projectId,
  projectsActions,
  tabActions,
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

  const { data: tabDataState, dataActions: tabDataActions } = useTabData(tabId, interfaceId);
  const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabId, interfaceId);

  // SYNCHRONISED TAB-SPECIFIC ACTIONS (optimistic + router refresh)
  const { actions: syncedTabActions } = useTabSync(tabId, interfaceId, tabActions, tileActions);
  const syncedTabDataActions = syncedTabActions?.data ?? null;

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

  // Get the unregisterTileRefs function from Zustand
  const unregisterTileRefs = useStoreContext(state => state.unregisterTileRefs);

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
  const onLayoutChange = (newLayout: Layout[]) => {
    if (!tabUIState?.pending && tabDataActions) {
      newLayout.forEach((layoutItem) => {
        const originalItem = tileProps.find((tileProp) => tileProp.id === layoutItem.i);

        // Update the tile layout
        const tileLayout: TileLayout = {
          x: layoutItem.x,
          y: layoutItem.y,
          w: layoutItem.w,
          h: layoutItem.h,
          minW: layoutItem.minW,
          minH: layoutItem.minH,
          moved: layoutItem.moved,
          static: layoutItem.static,
        };
        syncedTabDataActions?.updateTileLayout(originalItem?.id ?? "", tileLayout);
      });

    } else {
      tabUIActions?.setPending(false);
    }
  };

  const dragResizeDisabled = tabUIState?.pending || tabUIState?.resetting || anyTileLoading;

  /* ------------------------------------------------------------------
     Build the list of tiles we will *actually* render.
     – If <children> were supplied, treat them as the server-rendered
       <TileCard> nodes and keep their order.
     – Otherwise fall back to the old behaviour and create <TileCard>s
       here in the client.
  ------------------------------------------------------------------ */
  const tilesToRender = useMemo(() => {
      /* helper to create a client-side <TileCard/> wrapped in <Suspense/> */
      const makeClientTile = (tileId: string): ReactElement => (
        <Suspense
          key={tileId}
          fallback={
            <div className="w-full h-full flex items-center justify-center border p-4">
              <SkeletonLoader />
            </div>
          }
        >
          <TileCard
            tileId={tileId}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            tileActions={tileActions}
            logsActions={logsActions}
            fieldsActions={fieldsActions}
            derivedEntryActions={derivedEntryActions}
            contextActions={contextActions}
            codeActions={codeActions}
            projectsActions={projectsActions}
          />
        </Suspense>
      );
  
      /* ------------------------------------------------------------
         1.  Collect any server-rendered children into a map keyed
             by the fragment key we supplied on the server.
      ------------------------------------------------------------ */
      const serverMap = new Map<string, ReactElement>();
      if (children) {
        React.Children.forEach(children, child => {
          if (!React.isValidElement(child)) return;
          const key = child.key;
          if (typeof key === "string") {
            serverMap.set(key, child as ReactElement);
          }
        });
      }
  
      /* ------------------------------------------------------------
         2.  Produce the final array in *tileProps* order, preferring
             the server element when present.
      ------------------------------------------------------------ */
      return tileProps.map(({ id }) => ({
        tileId: id,
        element: serverMap.get(id) ?? makeClientTile(id),
      }));
      /* Dependencies */
    }, [
      children,
      tileProps,
      tabId,
      interfaceId,
      projectId,
      tileActions,
      logsActions,
      fieldsActions,
      derivedEntryActions,
      contextActions,
      codeActions,
    ]);
  
  // Show loading state if tab data is not yet available
  if (!tabDataState || !tabUIState) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <div className="w-full h-full flex items-center justify-center">
          <SkeletonLoader />
        </div>
      }
    >  
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
        {tilesToRender.map(({ tileId, element }) => {
          const item = tileProps.find(prop => prop.id === tileId);
          if (!item || !item.visible) return null;

          return (
            <div
              key={item.id}
              data-grid={item}
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Server-rendered or client-rendered TileCard */}
              {element}

              {/* Extra client-side controls */}
              <TileButtons
                tileId={item.id}
                tabId={tabId}
                interfaceId={interfaceId}
                projectId={projectId}
                contexts={contexts}
                tabActions={tabActions}
                tileActions={tileActions}
                logsActions={logsActions}
                contextActions={contextActions}
                codeActions={codeActions}
                projectsActions={projectsActions}
                fieldsActions={fieldsActions}
              />
            </div>
          );
        })}
      </ResponsiveReactGridLayout>
    </Suspense>
  );
};

export default Tab; 