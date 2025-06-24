import { Suspense } from "react";
import Tile from "../../Tile";
import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";

// Import specialized server components for each tile type
import TableWrapper from "./TableWrapper.server";
import PlotWrapper from "./PlotWrapper.server";
import SelectionWrapper from "./SelectionWrapper.server";
import EditorWrapper from "./EditorWrapper.server";
import TerminalWrapper from "./TerminalWrapper.server";

import type {
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  ContextActions,
  CodeActions,
  TileData,
  GranularTileActions,
  ProjectsActions,
  FileActions
} from "@/types/evals/grid";

type TileWrapperActions = {
  tileActions: GranularTileActions;
  projectsActions: ProjectsActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  fileActions: FileActions;
};

export default async function TileWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions
}: {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: TileWrapperActions;
}) {
  console.log("[TileWrapper] Rendering...");
  const qc = getQueryClient();

  // Render the appropriate server component based on tile type
  const renderTileContent = () => {
    switch (tile.type) {
      case "Table":
        return (
          <TableWrapper
            tile={tile}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            actions={{
              tileActions: actions.tileActions,
              logsActions: actions.logsActions,
              fieldsActions: actions.fieldsActions,
              derivedEntryActions: actions.derivedEntryActions,
              contextActions: actions.contextActions,
              projectsActions: actions.projectsActions
            }}
          />
        );
      case "Plot":
        return (
          <PlotWrapper
            tile={tile}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            actions={{
              tileActions: actions.tileActions,
              logsActions: actions.logsActions,
              fieldsActions: actions.fieldsActions,
              projectsActions: actions.projectsActions,
              contextActions: actions.contextActions
            }}
          />
        );
      case "View":
        return (
          <SelectionWrapper
            tile={tile}
            tabId={tabId}
            projectId={projectId}
            actions={{
              logsActions: actions.logsActions
            }}
          />
        );
      case "Editor":
        return (
          <EditorWrapper
            tile={tile}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            actions={{
              codeActions: actions.codeActions,
              fileActions: actions.fileActions,
              tileActions: actions.tileActions,
              projectsActions: actions.projectsActions,
              contextActions: actions.contextActions,
              logsActions: actions.logsActions,
              fieldsActions: actions.fieldsActions
            }}
          />
        );
      case "Terminal":
        return (
          <TerminalWrapper
            tile={tile}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            actions={{
              codeActions: actions.codeActions,
              tileActions: actions.tileActions,
              projectsActions: actions.projectsActions,
              contextActions: actions.contextActions,
              logsActions: actions.logsActions,
              fieldsActions: actions.fieldsActions,
              fileActions: actions.fileActions
            }}
          />
        );
      default:
        return <div>Unknown tile type: {tile.type}</div>;
    }
  };

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center">
            <SkeletonLoader />
        </div>
      }>
        <Tile
          tileId={tile.id || ""}
          tabId={tabId}
          interfaceId={interfaceId}
          projectId={projectId}
          actions={actions}
        />
      </Suspense>
    </HydrationBoundary>
  );
} 