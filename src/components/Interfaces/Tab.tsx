"use client";

import React, { useEffect, useMemo, useRef, Suspense, lazy, createRef } from "react";
import { WidthProvider, Responsive } from "react-grid-layout";
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { ResponseProps } from "@/types/common";
// import Cookies from "js-cookie";
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import { FieldsActions, LogsActions, DerivedEntryActions, TileProps, ContextActions, CodeActions } from "@/types/evals/grid";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import { useTiles } from "@/contexts/hooks/useStore";
import { useInterfaceUI } from "@/contexts/hooks/interface";

const ResponsiveReactGridLayout = WidthProvider(Responsive);
const TileCard = lazy(() => import('./TileCard'));
const TileButtons = lazy(() => import('./TileButtons'));

interface TabComponentProps {
  interfaceId: string;
  tabId: string;
  projectId: string;
  setNewCounter: (newCounter: number) => void;
  setFocusDialog: (focusDialog: boolean) => void;
  setEditTile: (editTile: string | undefined) => void;
  updateTab: (savedTab?: any, updatedItem?: any) => Promise<ResponseProps>;
  getLatestTab: () => void;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
}

const Tab = ({
  interfaceId,
  tabId,
  projectId,
  setNewCounter,
  setFocusDialog,
  setEditTile,
  updateTab,
  getLatestTab,
  logsActions,
  fieldsActions,
  derivedEntryActions,
  contextActions,
  codeActions,
}: TabComponentProps) => {
  // Use granular hooks instead of a general hook
  const { ui: interfaceUIState, uiActions: interfaceUIActions } = useInterfaceUI(interfaceId);

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
  
  // Only subscribe to a subset of the tiles objects to incl. name, type and tableTile only
  const tiles = useTiles(tileIds, ["name", "type", "tableTile.tableDataItem"]);

  // Get tile props using the getItems function from the tab data actions
  const tileProps = useMemo(() => {
    return (!tabDataActions) ? [] : tabDataActions.getItems();
  }, [tabDataActions]);

  // Extract tableDataItems from tiles for efficient dependency tracking
  const tileTableDataItems = useMemo(() => 
    tiles.map(tile => tile?.tableTile?.tableDataItem),
    [tiles]
  );

  // Add a ref to track initial mount
  const isInitialMount = useRef(true);

  // Set up effect to fetch the latest tab when project or tab changes
  useEffect(() => {
    if (projectId && tabId) {
      // Store current selections in cookies
      // const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      // Cookies.set("project", projectId, { expires: expirationDate });
      // Cookies.set("tab", tabId, { expires: expirationDate });
      
      // Only fetch data on initial mount or when project/tab actually changes
      if (isInitialMount.current) {
        getLatestTab();
        isInitialMount.current = false;
      }
    }
    // else if (!projectId) {
    //   Cookies.remove("project");
    // }
    // else if (!tabId) {
    //   Cookies.remove("tab");
    // }
  }, [projectId, tabId, getLatestTab]);

  // Only call updateInterface when items have truly changed.
  useEffect(() => {
    (() => {
      try {
        if (!tabUIState?.resetting) {
          updateTab(null, tileProps);
        }
      } catch (err) {
        console.error("updateTab failed:", err);
      }
    })();
  }, [tileProps, tabDataState?.globalContext]);

  // Trigger update when table data changes (server reloaded)
  useEffect(() => {
    if (!tabDataState || !tabUIActions || !tabDataActions) return;

    // Use setTimeout to delay execution
    setTimeout(() => {
      // Reset loading states
      if (interfaceUIState?.dataPending === true) {
        interfaceUIActions.setDataPending(false);
      }
      if (tabUIState?.refreshing === true) {
        tabUIActions.setRefreshing(false);
      }

      // // Reset pending state for all tiles
      // tiles.forEach(tile => {
      //   if (typeof tile === 'object' && tile !== null && 'name' in tile) {
      //     tabDataActions.updateTile(tile.name || "", { pending: false });
      //   }
      // });

      // If tab is pending or resetting, get latest data
      if ((interfaceUIState?.pending || tabUIState?.resetting) && projectId && tabId) {
        getLatestTab();
      }

      // Reset resetting state
      tabUIActions.setResetting(false);
    }, 1500);
  }, [tileTableDataItems]);

  // End success green after 3 seconds
  useEffect(() => { 
    const timer = setTimeout(() => tabUIActions?.setSaveSuccess(undefined), 3000);
    return () => clearTimeout(timer);
  }, [tabUIState?.saveSuccess, tabUIActions]);

  // Item layout change handler
  const onLayoutChange = (newLayout: any[]) => {
    if (!interfaceUIState?.pending && tabDataActions) {
      const layoutItems = newLayout.map((item) => {
        const originalItem = tileProps.find((t) => t.i === item.i);
        return { ...originalItem, ...item };
      });
      tabDataActions.setItems(layoutItems);
    } else {
      interfaceUIActions?.setPending(false);
    }
  };

  // Set-up refs for tile buttons
  const tileButtonsRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});

  // Show loading state if tab data is not yet available
  if (!tabDataState || !tabUIState) {
    return null;
  }

  return (
    <ResponsiveReactGridLayout
        onLayoutChange={onLayoutChange}
        className="layout interactive-grid flex-1"
        cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
        rowHeight={110}
        margin={[0, 0]}
        containerPadding={[0, 0]}
        isDraggable={tabUIState?.edit}
        isResizable={tabUIState?.edit}
        draggableHandle=".drag"
        resizeHandles={["e", "w", "s", "n", "se", "sw", "ne", "nw"]}
    >
        {/* Render tiles */}
        {tileProps.map((item: TileProps, idx: number) => {
            if (!tileButtonsRefs.current[item.i]) {
              tileButtonsRefs.current[item.i] = createRef<HTMLDivElement>();
            }
            const tileButtonsRef = tileButtonsRefs.current[item.i];
            return (
                !item.visible ? <></> : <div
                    key={item.i}
                    data-grid={item}
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                >

                    <Suspense fallback={
                        <div className="w-full h-full flex items-center justify-center border p-4">
                          <SkeletonLoader />
                        </div>
                    }>
                      <TileCard
                            index={idx}
                            tileId={item.i}
                            tabId={tabId}
                            interfaceId={interfaceId}
                            projectId={projectId}
                            updateTab={updateTab}
                            logsActions={logsActions}
                            fieldsActions={fieldsActions}
                            derivedEntryActions={derivedEntryActions}
                            contextActions={contextActions}
                            codeActions={codeActions}
                            tileButtonsRef={tileButtonsRef}
                        />
                    </Suspense>

                    <TileButtons
                      item={item}
                      tileId={item.i}
                      tabId={tabId}
                      interfaceId={interfaceId}
                      projectId={projectId}
                      contexts={contexts}
                      setNewCounter={setNewCounter}
                      setFocusDialog={setFocusDialog}
                      setEditTile={setEditTile}
                      updateTab={updateTab}
                      logsActions={logsActions}
                      contextActions={contextActions}
                      codeActions={codeActions}
                      tileCount={tileProps.length}
                      buttonsRef={tileButtonsRef}
                    />

                </div>
            );
        })}
    </ResponsiveReactGridLayout>
  );
};

export default Tab; 