"use client";

import { ResponseProps } from "@/types/common";
import { LogsActions, FieldsActions, DerivedEntryActions, TileProps, ContextActions, TabProps, CodeActions } from "@/types/evals/grid";
import { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";

// Import the new hooks
import { useTileMeta, useTileUI, useTileItem } from '@/contexts/hooks/tile';
import { ExpandProvider } from "@/contexts/ExpandContext";
import Editor from "./Details/Editor/Editor";
import { getTileButtonsRef, getTileCardRef } from '@/utils/refRegistry';

// Dynamically import components
const LogsTable = lazy(() => import("@/components/Interfaces/Table/Table"));
const LogsPlot = lazy(() => import("@/components/Interfaces/Details/Plot/Plot"));
const Selection = lazy(() => import("@/components/Interfaces/Details/Selection/Selection"));

// Define component props 
interface TileComponentProps {
    tileId: string;
    tabId: string;
    interfaceId: string;
    projectId: string;
    logsActions: LogsActions;
    fieldsActions: FieldsActions;
    derivedEntryActions: DerivedEntryActions;
    contextActions: ContextActions;
    codeActions: CodeActions;
    tableContent?: React.ReactNode;  // Server-rendered Table content
    plotContent?: React.ReactNode;   // Server-rendered Plot content
    viewContent?: React.ReactNode;   // Server-rendered View content
    editorContent?: React.ReactNode; // Server-rendered Editor content
}

const Tile = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    contextActions,
    codeActions,
    tableContent,
    plotContent,
    viewContent,
    editorContent
}: TileComponentProps) => {
    const router = useRouter();
    const [initial, setInitial] = useState(true);

    // Use granular hooks for better code organization
    const { meta: tileMetaState } = useTileMeta(tileId, tabId, interfaceId);
    const { ui: tileUIState, uiActions: tileUIActions } = useTileUI(tileId, tabId, interfaceId);
    const { itemActions } = useTileItem(tileId, tabId, interfaceId);

    // Get refs from registry
    const tileButtonsRef = getTileButtonsRef(tileId);
    const tileCardRef = getTileCardRef(tileId);

    // Extract required data
    const { type: tileType } = tileMetaState || {};

    // Get the item props for grid layout (position, etc)
    const tileItem: TileProps = useMemo(() => itemActions?.asTileItem() || {
        i: tileId,
        x: tileMetaState?.position?.x || 0,
        y: tileMetaState?.position?.y || 0,
        w: tileMetaState?.position?.width || 4,
        h: tileMetaState?.position?.height || 4,
    }, [itemActions, tileMetaState]);

    // Use a ref to compare the needed properties so we only update if something truly changed.
    useEffect(() => {
        if (!["View", "Editor"].includes(tileItem.tab || "") && !initial) {
            updateTab(null, tileItem).then(() => {
                tileUIActions?.setLoading(true);
                router.refresh();
            }).catch(error => {
                console.error('Error updating interface:', error);
            });
        }
    }, [
        tileItem.tab,
        tileItem.table_type,
        tileItem.filters,
        tileItem.context,
        tileItem.column_context,
        tileItem.common_filter,
        tileItem.sorting,
        tileItem.grouping,
        tileItem.group_sorting,
        tileItem.page_number,
        tileItem.metric,
        tileItem.plot_type,
        tileItem.x_axis,
        tileItem.y_axis,
        tileItem.plot_group_by,
        tileItem.plot_aggregate,
        tileItem.freeze,
        tileItem.color
    ]);

    useEffect(() => {
        if (!["View", "Editor"].includes(tileItem.tab || "") && !initial) {
            updateTab(null, tileItem).then(() => {
                router.refresh();
            }).catch(error => {
                console.error('Error updating interface:', error);
            });
        }
    }, [tileItem.auto_update]);

    useEffect(() => {
        if (!["View", "Editor"].includes(tileItem.tab || "") && !initial)
            tileUIActions?.setPending(true);
    }, [tileItem.tab, tileItem.table_type, tileItem.context, tileItem.column_context]);

    useEffect(() => {
        setInitial(false);
    }, []);

    // Update tile primary and secondary colors
    // Node: Need to update buttons and tile content separately 
    // instead of the common parent div because ResponsiveReactGridLayout
    // interferes with ref manipulation
    useEffect(() => {
        if (tileButtonsRef && tileButtonsRef.current) {
            const color = tileUIState?.color;
            if (color) {
                tileButtonsRef.current.style.setProperty("--primary", color);
                tileButtonsRef.current.style.setProperty("--accent", color);
            } else {
                tileButtonsRef.current.style.removeProperty("--primary");
                tileButtonsRef.current.style.removeProperty("--accent");
            }
        }
        if (tileCardRef && tileCardRef.current) {
            const color = tileUIState?.color;
            if (color) {
                tileCardRef.current.style.setProperty("--primary", color);
                tileCardRef.current.style.setProperty("--accent", color);
            } else {
                tileCardRef.current.style.removeProperty("--primary");
                tileCardRef.current.style.removeProperty("--accent");
            }
        }
    }, [tileUIState?.color]);

    // Render based on tile type
    const renderContent = () => {
        switch (tileType) {
            case 'Table':
                return tableContent || (
                    <Suspense fallback={
                        <div className="w-full h-full flex items-center justify-center">
                            <SkeletonLoader />
                        </div>
                    }>
                        <LogsTable 
                            tileId={tileId}
                            tabId={tabId}
                            interfaceId={interfaceId}
                            projectId={projectId}
                            logsActions={logsActions}
                            fieldsActions={fieldsActions}
                            derivedEntryActions={derivedEntryActions}
                            contextActions={contextActions}
                        />
                    </Suspense>
                );
            case 'Plot':
                return plotContent || (
                    <Suspense fallback={
                        <div className="w-full h-full flex items-center justify-center">
                            <SkeletonLoader />
                        </div>
                    }>
                        <LogsPlot 
                            tileId={tileId}
                            tabId={tabId}
                            interfaceId={interfaceId}
                            projectId={projectId}
                            logsActions={logsActions}
                            fieldsActions={fieldsActions}
                        />
                    </Suspense>
                );
            case 'View':
                return viewContent || (
                    <div className="w-full overflow-auto">
                        <ExpandProvider>
                            <Suspense fallback={
                                <div className="w-full h-full flex items-center justify-center">
                                    <SkeletonLoader />
                                </div>
                            }>
                                <Selection
                                    tileId={tileId}
                                    tabId={tabId}
                                    interfaceId={interfaceId}
                                    projectId={projectId}
                                />
                            </Suspense>
                        </ExpandProvider>
                    </div>
                );
            case 'Editor':
                return editorContent || (
                    <div className="w-full h-full overflow-y-auto">
                        <Editor
                            tileId={tileId}
                            tabId={tabId}
                            interfaceId={interfaceId}
                            projectId={projectId}
                            codeActions={codeActions}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        renderContent()
    ); 
};

export default Tile; 