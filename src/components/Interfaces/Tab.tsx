"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { WidthProvider, Responsive } from "react-grid-layout";
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { ResponseProps } from "@/types/common";
import { Loader2, Maximize2, EyeOff, Copy, Grip, X, Braces, Grid2x2 } from "lucide-react";
import { Badge } from "../UI/badge";
import Tooltip from "../Common/Misc/Tooltip";
import ActionButton from "../Common/Buttons/Action";
import Cookies from "js-cookie";
import { useTab } from '@/contexts/hooks/useTab';
import { FieldsActions, LogsActions, DerivedEntryActions, TileProps } from "@/types/evals/grid";
import ContextSelector from "./Table/Content/ContextSelector";
import TileCard from "./TileCard";

const ResponsiveReactGridLayout = WidthProvider(Responsive);

interface TabComponentProps {
  interfaceId: string;
  tabId: string;
  projectId: string;
  setNewCounter: (newCounter: number) => void;
  setFocusDialog: (focusDialog: boolean) => void;
  setEditTile: (editTile: string | undefined) => void;
  updateTab: (savedTab?: any) => Promise<ResponseProps>;
  getLatestTab: () => void;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
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
}: TabComponentProps) => {
  // Use hooks to get tab and interface data and actions
  const { tab: tabData, actions: tabActions } = useTab(tabId, interfaceId);

  // Get project id and contexts from store
  const projectData = useStoreContext(state => 
    projectId ? state.projectsById[projectId] : null
  );
  const contexts = projectData?.contexts || [];

  // Derive tiles from tab data
  const tiles = tabData ? Object.values(tabData.tiles || {}) : [];

  // Get tile props using the getItems function from the tabActions
  const tileProps = useMemo(() => {
    return (!tabActions || !tabData) ? [] : tabActions.getItems();
  }, [tabActions, tabData]);
  
  // Add a ref to track initial mount
  const isInitialMount = useRef(true);

  // Set up effect to fetch the latest tab when project or tab changes
  useEffect(() => {
    if (projectId && tabId) {
      // Store current selections in cookies
      const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      Cookies.set("project", projectId, { expires: expirationDate });
      Cookies.set("tab", tabId, { expires: expirationDate });
      
      // Only fetch data on initial mount or when project/tab actually changes
    if (isInitialMount.current) {
      getLatestTab();
      isInitialMount.current = false;
    }
    }
    else if (!projectId) {
      Cookies.remove("project");
    }
    else if (!tabId) {
      Cookies.remove("tab");
    }
  }, [projectId, tabId, getLatestTab]);

  // Only call updateInterface when items have truly changed.
  useEffect(() => {
    (() => {
      try {
        updateTab();
      } catch (err) {
        console.error("updateTab failed:", err);
      }
    })();
  }, [tileProps, tabData?.globalContext]);

  const tileTableDataItems = useMemo(() => 
    tiles.map(tile => tile.tableData?.tableDataItem),
    [tiles]
  );

  // Trigger update when table data changes (server reloaded)
  useEffect(() => {
    if (!tabData || !tabActions) return;

    // Use setTimeout to delay execution
    setTimeout(() => {
      // Reset loading states
      if (tabData.dataPending === true) {
        tabActions.setDataPending(false);
      }
      if (tabData.refreshing === true) {
        tabActions.setRefreshing(false);
      }

      // Reset pending state for all tiles
      tiles.forEach(tile => {
        if (typeof tile === 'object' && tile !== null && 'id' in tile) {
          tabActions.updateTile(tile.id, { pending: false });
        }
      });

      // If tab is pending or resetting, get latest data
      if ((tabData.pending || tabData.resetting) && projectId && tabId) {
        getLatestTab();
      }

      // Reset resetting state
      tabActions.setResetting(false);
    }, 1500);
  }, [tileTableDataItems]);

  // End success green after 3 seconds
  useEffect(() => { 
    const timer = setTimeout(() => tabActions?.setSaveSuccess(undefined), 3000);
    return () => clearTimeout(timer);
  }, [tabData?.saveSuccess, tabActions]);

  // Handle layout changes
  const onLayoutChange = (newLayout: any) => {
    if (!tabData?.pending && tabActions) {
      const updatedItems = newLayout.map((item: any) => {
        const originalItem = tileProps.find(i => i.i === item.i);
        return { ...originalItem, ...item };
      });
      tabActions.setItems([...updatedItems]);
    } else {
      tabActions?.setPending(false);
    }
  };

  // Show loading state if tab data is not yet available
  if (!tabData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <p>Loading tab...</p>
      </div>
    );
  }

  return (
    <ResponsiveReactGridLayout
        onLayoutChange={onLayoutChange}
        className="layout interactive-grid flex-1"
        cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
        rowHeight={110}
        margin={[0, 0]}
        containerPadding={[0, 0]}
        isDraggable={tabData?.edit}
        isResizable={tabData?.edit}
        draggableHandle=".drag"
        resizeHandles={["e", "w", "s", "n", "se", "sw", "ne", "nw"]}
    >
        {/* Render tiles */}
        {tileProps.map((item: TileProps, idx: number) => {
            return (
                <div
                    key={item.i}
                    data-grid={item}
                    className="relative"
                    hidden={!item.visible}
                    onClick={(e) => e.stopPropagation()}
                >
                    <TileCard
                        index={idx}
                        tileId={item.i}
                        tabId={tabId}
                        interfaceId={interfaceId}
                        projectId={projectId}
                        updateTab={updateTab}
                        getLatestTab={getLatestTab}
                        logsActions={logsActions}
                        fieldsActions={fieldsActions}
                        derivedEntryActions={derivedEntryActions}
                    />

                    <div className={"w-full px-2 transition-all absolute -top-2 flex justify-between " + (tabData?.edit ? "h-16" : "h-10")}>
                        <div className="mb-auto flex gap-2 ml-1">
                            <Tooltip content="Tile Type">
                                <Badge
                                    className="cursor-pointer text-sm font-normal mb-1"
                                    variant="primary"
                                    onClick={() => tabData?.edit ? setEditTile(item.i) : undefined}
                                >
                                    {item.i}
                                </Badge>
                            </Tooltip>
                            {item.context && item.tab == "Table" && <ContextSelector
                                tileId={item.i}
                                contexts={contexts}
                                context={tabData?.globalContext}
                                button={
                                    <Tooltip content="Context">
                                        <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                                            <Braces size={18} />
                                            {item.context}
                                        </Badge>
                                    </Tooltip>
                                }
                            />}
                            {(item.column_context) && item.tab == "Table" && <ContextSelector
                                tileId={item.i}
                                contexts={contexts}
                                context={tabData?.globalContext}
                                button={<Tooltip content="Column Context">
                                    <Badge variant="primary" className="flex gap-1 text-sm font-normal" role="button" aria-label="Open Menu" tabIndex={0}>
                                        <Grid2x2 size={18} />
                                        {item.column_context}
                                    </Badge>
                                </Tooltip>}
                            />}
                        </div>
                        <div className="flex-1 flex justify-end gap-2 mb-auto opacity-0 hover:opacity-100">
                            <ActionButton
                                className="cursor-pointer hover:z-10"
                                onClick={() => {
                                    if (!tabData?.focusedTileIds.includes(item.i)) {
                                        tabActions?.setFocusedTileIds([item.i, tabData?.focusedTileIds[0] || tabData?.focusedTileIds[1]]);
                                    }
                                    setFocusDialog(true);
                                }}
                                icon={<Maximize2 />}
                                tooltip="Open in Focus Pane"
                                variant={tabData?.focusedTileIds.includes(item.i) ? "primary" : "outline"}
                            />
                            {tabData?.edit && (
                                <>
                                    <ActionButton
                                        className="cursor-pointer hover:z-10"
                                        onClick={() => tabActions?.updateTile(item.i, { visible: false })}
                                        icon={<EyeOff />}
                                        tooltip={"Hide"}
                                        variant="outline"
                                    />
                                    <ActionButton
                                        className="cursor-pointer hover:z-10"
                                        onClick={() => tabActions?.setCopied(item.i)}
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
                                            tabActions?.removeTile(item.i);
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