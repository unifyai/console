"use client";

import { LogsActions, FieldsActions, DerivedEntryActions, ContextActions, CodeActions, GranularTileActions, ProjectsActions, FileActions } from "@/types/evals/grid";
import { useEffect, Suspense, lazy } from "react";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";

// Import the new hooks
import { useTileMeta, useTileUI } from '@/contexts/hooks/tile';
import { ExpandProvider } from "@/contexts/ExpandContext";
import Editor from "./Details/Editor/Editor";
import Terminal from "./Details/Terminal/Terminal";
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
    projectsActions: ProjectsActions;
    tileActions: GranularTileActions;
    logsActions: LogsActions;
    fieldsActions: FieldsActions;
    derivedEntryActions: DerivedEntryActions;
    contextActions: ContextActions;
    codeActions: CodeActions;
    fileActions: FileActions;
    tableContent?: React.ReactNode;  // Server-rendered Table content
    plotContent?: React.ReactNode;   // Server-rendered Plot content
    viewContent?: React.ReactNode;   // Server-rendered View content
    editorContent?: React.ReactNode; // Server-rendered Editor content
    terminalContent?: React.ReactNode; // Server-rendered Terminal content
}

const Tile = ({
    tileId,
    tabId,
    interfaceId,
    projectId,
    projectsActions,
    tileActions,
    logsActions,
    fieldsActions,
    derivedEntryActions,
    contextActions,
    codeActions,
    fileActions,
    tableContent,
    plotContent,
    viewContent,
    editorContent,
    terminalContent
}: TileComponentProps) => {

    // Use granular hooks for better code organization
    const { meta: tileMetaState } = useTileMeta(tileId, tabId);
    const { ui: tileUIState } = useTileUI(tileId, tabId);

    // Get refs from registry
    const tileButtonsRef = getTileButtonsRef(tileId);
    const tileCardRef = getTileCardRef(tileId);

    // Extract required data
    const { type: tileType } = tileMetaState || {};

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
                            tileActions={tileActions}
                            logsActions={logsActions}
                            fieldsActions={fieldsActions}
                            derivedEntryActions={derivedEntryActions}
                            contextActions={contextActions}
                            projectsActions={projectsActions}
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
                            tileActions={tileActions}
                            logsActions={logsActions}
                            fieldsActions={fieldsActions}
                            projectsActions={projectsActions}
                            contextActions={contextActions}
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
                                    projectId={projectId}
                                    logsActions={logsActions}   
                                    tileId={tileId}
                                    tabId={tabId}
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
                            fileActions={fileActions}
                            tileActions={tileActions}
                            projectsActions={projectsActions}
                            contextActions={contextActions}
                            fieldsActions={fieldsActions}
                            logsActions={logsActions}
                        />
                    </div>
                );
            case 'Terminal':
                return terminalContent || (
                    <div className="w-full h-full overflow-y-auto">
                        <Terminal
                            tileId={tileId}
                            tabId={tabId}
                            interfaceId={interfaceId}
                            projectId={projectId}
                            tileActions={tileActions}
                            logsActions={logsActions}
                            fieldsActions={fieldsActions}
                            contextActions={contextActions}
                            codeActions={codeActions}
                            fileActions={fileActions}
                            projectsActions={projectsActions}
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