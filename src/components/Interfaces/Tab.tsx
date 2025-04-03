"use client";

import React, { useEffect, useMemo, useRef, Suspense, lazy } from "react";
import { WidthProvider, Responsive } from "react-grid-layout";
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { ResponseProps } from "@/types/common";
import { Loader2, Maximize2, EyeOff, Copy, Grip, X, Braces, Grid2x2 } from "lucide-react";
import { Badge } from "../UI/badge";
import Tooltip from "../Common/Misc/Tooltip";
import ActionButton from "../Common/Buttons/Action";
// import Cookies from "js-cookie";
import { useTabData, useTabUI } from '@/contexts/hooks/tab';
import { FieldsActions, LogsActions, DerivedEntryActions, TileProps, ContextActions } from "@/types/evals/grid";
import ContextSelector from "./Table/Content/ContextSelector";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";
import TutorialButton from "./TutorialButton";
import { useTiles } from "@/contexts/hooks/useStore";

const ResponsiveReactGridLayout = WidthProvider(Responsive);
const TileCard = lazy(() => import('./TileCard'));

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
}: TabComponentProps) => {
  // Use granular hooks instead of a general hook
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
      if (tabUIState?.dataPending === true) {
        tabUIActions.setDataPending(false);
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
      if ((tabUIState?.pending || tabUIState?.resetting) && projectId && tabId) {
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
    if (!tabUIState?.pending && tabDataActions) {
      const layoutItems = newLayout.map((item) => {
        const originalItem = tileProps.find((t) => t.i === item.i);
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
                        />
                    </Suspense>

                    <div className={"w-full px-2 transition-all absolute -top-2 flex justify-between " + (tabUIState?.edit ? "h-16" : "h-10")}>
                      <div className="mb-auto flex gap-2 ml-1 items-center">
                        {tabUIState?.help && <TutorialButton 
                            url={
                                item.tab === "Plot" ? "https://docs.unify.ai/interfaces/plots" :
                                item.tab === "View" ? "https://docs.unify.ai/interfaces/views" :
                                item.tab === "Editor" ? "https://docs.unify.ai/interfaces/views" :
                                "https://docs.unify.ai/interfaces/tables"
                            }
                        />}
                              <Tooltip content="Rename Tile">
                                <Badge
                                    className="cursor-pointer text-sm font-normal mb-1"
                                    variant="primary"
                                    onClick={() => tabUIState?.edit ? setEditTile(item.i) : undefined}
                                >
                                    {item.i}
                                </Badge>
                            </Tooltip>
                            {item.context && item.tab == "Table" && <ContextSelector
                                tileId={item.i}
                                tabId={tabId}
                                interfaceId={interfaceId}
                                projectId={projectId}
                                contexts={contexts}
                                context={tabDataState?.globalContext}
                                contextActions={contextActions}
                                button={
                                    <Tooltip content="Context">
                                        <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                                            <Braces size={18} />
                                            {item.context}
                                        </Badge>
                                    </Tooltip>
                                }
                                refresh={() => updateTab()}
                                setPending={tabUIActions.setPending}
                            />}
                            {(item.column_context) && item.tab == "Table" && <ContextSelector
                                tileId={item.i}
                                tabId={tabId}
                                interfaceId={interfaceId}
                                projectId={projectId}
                                contexts={contexts}
                                context={tabDataState?.globalContext}
                                contextActions={contextActions}
                                button={<Tooltip content="Column Context">
                                    <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                                        <Grid2x2 size={18} />
                                        {item.column_context}
                                    </Badge>
                                </Tooltip>}
                                refresh={() => updateTab()}
                                setPending={tabUIActions.setPending}
                            />}
                        </div>
                        <div className="flex-1 flex justify-end gap-2 mb-auto opacity-0 hover:opacity-100">
                            <ActionButton
                                className="cursor-pointer hover:z-10"
                                onClick={() => {
                                    const focusedTileNames = tabUIState?.focusedTileNames || [undefined, undefined];
                                    if (!focusedTileNames.includes(item.i)) {
                                        tabUIActions?.setFocusedTileNames([item.i, focusedTileNames[0] || focusedTileNames[1]] as [string | undefined, string | undefined]);
                                    }
                                    setFocusDialog(true);
                                }}
                                icon={<Maximize2 />}
                                tooltip="Open in Focus Pane"
                                variant={(tabUIState?.focusedTileNames || [undefined, undefined]).includes(item.i) ? "primary" : "outline"}
                            />
                            {tabUIState?.edit && (
                                <>
                                    <ActionButton
                                        className="cursor-pointer hover:z-10"
                                        onClick={() => tabDataActions?.updateTile(item.i, { visible: false })}
                                        icon={<EyeOff />}
                                        tooltip={"Hide"}
                                        variant="outline"
                                    />
                                    <ActionButton
                                        className="cursor-pointer hover:z-10"
                                        onClick={() => tabUIActions?.setCopied(item.i)}
                                        icon={<Copy />}
                                        tooltip={"Copy"}
                                        variant="outline"
                                    />
                                    <ActionButton
                                        className="drag cursor-grab hover:z-10"
                                        icon={<Grip />}
                                        tooltip="Drag"
                                        variant="outline"
                                    />
                                    <ActionButton
                                        className="remove cursor-pointer hover:z-10"
                                        onClick={() => {
                                            tabDataActions?.removeTile(item.i);
                                            if (tileProps.length <= 1) {
                                                setNewCounter(0);
                                            }
                                        }}
                                        icon={<X />}
                                        tooltip="Remove"
                                        variant="outline"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            );
        })}
    </ResponsiveReactGridLayout>
  );
};

export default Tab; 