"use client";

import { LogsActions, FieldsActions, DerivedEntryActions, ContextActions, CodeActions, GranularTileActions, ProjectsActions, FileActions } from "@/types/interfaces/grid";
import { useEffect, Suspense, lazy } from "react";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";

// Import the new hooks
import { useTileMeta, useTileUI } from '@/contexts/hooks/tile';
// Removed unused tab UI import – tile component no longer needs to know tab colour directly
// (it inherits via CSS variables from the Tab wrapper).
import { ExpandProvider } from "@/contexts/ExpandContext";
import { getTileHeaderRef, getTileCardRef } from '@/utils/interfaces/refRegistry';
// import removed: resolveColorHierarchy now unused after colour hierarchy refactor

// Dynamically import components
const LogsTable = lazy(() => import("@/components/Pages/Interfaces/Blocks/Table/Table"));
const LogsPlot = lazy(() => import("@/components/Pages/Interfaces/Blocks/Plot/Plot"));
const Selection = lazy(() => import("@/components/Pages/Interfaces/Blocks/Selection/Selection"));
const Editor = lazy(() => import("@/components/Pages/Interfaces/Blocks/Editor/Editor"));
const Terminal = lazy(() => import("@/components/Pages/Interfaces/Blocks/Terminal/Terminal"));

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
  // Tab UI no longer required here – colour inheritance handled by CSS cascade.

  // Get refs from registry
  const tileHeaderRef = getTileHeaderRef(tileId);
  const tileCardRef = getTileCardRef(tileId);

  // Extract required data
  const { type: tileType } = tileMetaState || {};
    
  // Interface primary computation removed – hierarchy resolution is handled by pickers when needed.

  // Only apply an override when the tile itself has an explicit colour. If the tile has
  // no colour set we fall back to the tab → project hierarchy via CSS custom properties.
  const tileColor = tileUIState?.color ?? null;

  // Update tile primary and secondary colors
  // Node: Need to update buttons and tile content separately 
  // instead of the common parent div because ResponsiveReactGridLayout
  // interferes with ref manipulation
  useEffect(() => {
      if (tileHeaderRef && tileHeaderRef.current) {
          if (tileColor) {
              tileHeaderRef.current.style.setProperty("--primary", tileColor);
              tileHeaderRef.current.style.setProperty("--accent", tileColor);
          } else {
              tileHeaderRef.current.style.removeProperty("--primary");
              tileHeaderRef.current.style.removeProperty("--accent");
          }
      }
      if (tileCardRef && tileCardRef.current) {
          if (tileColor) {
              tileCardRef.current.style.setProperty("--primary", tileColor);
              tileCardRef.current.style.setProperty("--accent", tileColor);
          } else {
              tileCardRef.current.style.removeProperty("--primary");
              tileCardRef.current.style.removeProperty("--accent");
          }
      }
  }, [tileColor, tileHeaderRef, tileCardRef]);

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