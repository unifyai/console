"use client";

import { LogsActions, FieldsActions, DerivedEntryActions, ContextActions, CodeActions, GranularTileActions, ProjectsActions, FileActions } from "@/types/evals/grid";
import { useEffect, Suspense, lazy } from "react";
import SkeletonLoader from "../Common/Loaders/SkeletonLoader";

// Import the new hooks
import { useTileMeta, useTileUI } from '@/contexts/hooks/tile';
import { useTabUI } from '@/contexts/hooks/tab';
import { ExpandProvider } from "@/contexts/ExpandContext";
import { getTileButtonsRef, getTileCardRef } from '@/utils/refRegistry';
import { resolveColorHierarchy } from "@/utils/evals/plots/common";
import { ScrollArea } from '../UI/scroll-area';

// Dynamically import components
const LogsTable = lazy(() => import("@/components/Interfaces/Table/Table"));
const LogsPlot = lazy(() => import("@/components/Interfaces/Details/Plot/Plot"));
const Selection = lazy(() => import("@/components/Interfaces/Details/Selection/Selection"));
const Editor = lazy(() => import("@/components/Interfaces/Details/Editor/Editor"));
const Terminal = lazy(() => import("@/components/Interfaces/Details/Terminal/Terminal"));

// Define main Tile component props
interface TileProps {
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: {
    tileActions: GranularTileActions;
    projectsActions: ProjectsActions;
    logsActions: LogsActions;
    fieldsActions: FieldsActions;
    derivedEntryActions: DerivedEntryActions;
    contextActions: ContextActions;
    codeActions: CodeActions;
    fileActions: FileActions;
  };
}

// Define individual tile component props
interface TableTileProps extends TileProps {}
interface PlotTileProps extends TileProps {}
interface ViewTileProps extends TileProps {}
interface EditorTileProps extends TileProps {}
interface TerminalTileProps extends TileProps {}

/**
 * Inner component that renders the actual tile content
 * Separated to keep suspense boundaries clean
 */
const Tile: React.FC<TileProps> = ({ tileId, tabId, interfaceId, projectId, actions }) => {
  // Use granular hooks for better code organization
  const { meta: tileMetaState } = useTileMeta(tileId, tabId);
  const { ui: tileUIState } = useTileUI(tileId, tabId);
  const { ui: tabUIState } = useTabUI(tabId);

  // Get refs from registry
  const tileButtonsRef = getTileButtonsRef(tileId);
  const tileCardRef = getTileCardRef(tileId);

  // Extract required data
  const { type: tileType } = tileMetaState || {};
    
  // Resolve color using hierarchical precedence
  const resolvedColor = resolveColorHierarchy(tileUIState?.color, tabUIState?.color);

  // Update tile primary and secondary colors
  // Node: Need to update buttons and tile content separately 
  // instead of the common parent div because ResponsiveReactGridLayout
  // interferes with ref manipulation
  useEffect(() => {
      if (tileButtonsRef && tileButtonsRef.current) {
          if (resolvedColor) {
              tileButtonsRef.current.style.setProperty("--primary", resolvedColor);
              tileButtonsRef.current.style.setProperty("--accent", resolvedColor);
          } else {
              tileButtonsRef.current.style.removeProperty("--primary");
              tileButtonsRef.current.style.removeProperty("--accent");
          }
      }
      if (tileCardRef && tileCardRef.current) {
          if (resolvedColor) {
              tileCardRef.current.style.setProperty("--primary", resolvedColor);
              tileCardRef.current.style.setProperty("--accent", resolvedColor);
          } else {
              tileCardRef.current.style.removeProperty("--primary");
              tileCardRef.current.style.removeProperty("--accent");
          }
      }
  }, [resolvedColor, tileButtonsRef, tileCardRef]);

  switch (tileType) {
    case "Table":
      return <TableTile 
        tileId={tileId}
        tabId={tabId} 
        interfaceId={interfaceId} 
        projectId={projectId} 
        actions={actions} 
      />;
      
    case "Plot":
      return <PlotTile 
        tileId={tileId}
        tabId={tabId} 
        interfaceId={interfaceId} 
        projectId={projectId} 
        actions={actions} 
      />;
      
    case "View":
      return <ViewTile 
        tileId={tileId}
        tabId={tabId} 
        interfaceId={interfaceId} 
        projectId={projectId} 
        actions={actions} 
      />;
      
    case "Editor":
      return <EditorTile 
        tileId={tileId}
        tabId={tabId} 
        interfaceId={interfaceId} 
        projectId={projectId} 
        actions={actions} 
      />;
      
    case "Terminal":
      return <TerminalTile 
        tileId={tileId}
        tabId={tabId} 
        interfaceId={interfaceId} 
        projectId={projectId} 
        actions={actions} 
      />;
      
    default:
      return null;
  }
};

/**
 * Table tile renderer with data ensuring
 */
const TableTile: React.FC<TableTileProps> = ({ tileId, tabId, interfaceId, projectId, actions }) => {
  // Data ensuring is now handled at TileRenderer level
  
  return (
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
            tileActions={actions.tileActions}
            logsActions={actions.logsActions}
            fieldsActions={actions.fieldsActions}
            derivedEntryActions={actions.derivedEntryActions}
            contextActions={actions.contextActions}
            projectsActions={actions.projectsActions}
        />
    </Suspense>
  );
};

/**
 * Plot tile renderer with dependency checking and data ensuring
 */
const PlotTile: React.FC<PlotTileProps> = ({ tileId, tabId, interfaceId, projectId, actions }) => {
  // Data ensuring is now handled at TileRenderer level
  
  return (
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
            tileActions={actions.tileActions}
            logsActions={actions.logsActions}
            fieldsActions={actions.fieldsActions}
            projectsActions={actions.projectsActions}
            contextActions={actions.contextActions}
        />
    </Suspense>
  );
};

/**
 * View tile renderer with table dependency ensuring
 */
const ViewTile: React.FC<ViewTileProps> = ({ tileId, tabId, interfaceId, projectId, actions }) => {
  // Note: We don"t need to call useEnsureTableTileData here for the referenced table
  // because the dependency system already ensures it"s ready before this component renders

  return (
    <div className="w-full overflow-auto">
      <ExpandProvider>
        <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
                <SkeletonLoader />
            </div>
        }>
            <Selection
                projectId={projectId}
                logsActions={actions.logsActions}
                tileId={tileId}
                tabId={tabId}
            />
        </Suspense>
      </ExpandProvider>
    </div>
  );
};

/**
 * Editor tile renderer (independent)
 */
const EditorTile: React.FC<EditorTileProps> = ({ tileId, tabId, interfaceId, projectId, actions }) => {
  return (
    <div className="w-full h-full overflow-y-auto">
      <Editor
        tileId={tileId}
        tabId={tabId}
        interfaceId={interfaceId}
        projectId={projectId}
        codeActions={actions.codeActions}
        fileActions={actions.fileActions}
        tileActions={actions.tileActions}
        projectsActions={actions.projectsActions}
        contextActions={actions.contextActions}
        fieldsActions={actions.fieldsActions}
        logsActions={actions.logsActions}
      />
    </div>
  );
};

/**
 * Terminal tile renderer (independent)
 */
const TerminalTile: React.FC<TerminalTileProps> = ({ tileId, tabId, interfaceId, projectId, actions }) => {
  return (
    <div className="w-full h-full overflow-y-auto">
      <Terminal
        tileId={tileId}
        tabId={tabId}
        interfaceId={interfaceId}
        projectId={projectId}
        tileActions={actions.tileActions}
        logsActions={actions.logsActions}
        fieldsActions={actions.fieldsActions}
        contextActions={actions.contextActions}
        codeActions={actions.codeActions}
        fileActions={actions.fileActions}
        projectsActions={actions.projectsActions}
      />
    </div>
  );
};

// Default export for lazy loading
export default Tile;