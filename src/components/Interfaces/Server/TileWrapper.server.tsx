import { Suspense } from "react";
import Tile from "../Tile";
import { getQueryClient } from "@/components/Providers/QueryProvider";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";

// Import specialized server components for each tile type
import TableWrapper from "./TableWrapper.server";
import PlotWrapper from "./PlotWrapper.server";
import SelectionWrapper from "./SelectionWrapper.server";
import EditorWrapper from "./EditorWrapper.server";

import type {
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  ContextActions,
  CodeActions,
  TileData
} from "@/types/evals/grid";

type TileWrapperActions = {
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
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
              logsActions: actions.logsActions,
              fieldsActions: actions.fieldsActions,
              derivedEntryActions: actions.derivedEntryActions,
              contextActions: actions.contextActions
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
              logsActions: actions.logsActions,
              fieldsActions: actions.fieldsActions
            }}
          />
        );
      case "View":
        return (
          <SelectionWrapper
            tile={tile}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
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
              codeActions: actions.codeActions
            }}
          />
        );
      default:
        return <div>Unknown tile type: {tile.type}</div>;
    }
  };

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Tile
        tileId={tile.id || ""}
        tabId={tabId}
        interfaceId={interfaceId}
        projectId={projectId}
        logsActions={actions.logsActions}
        fieldsActions={actions.fieldsActions}
        derivedEntryActions={actions.derivedEntryActions}
        contextActions={actions.contextActions}
        codeActions={actions.codeActions}
        tableContent={tile.type === "Table" ? renderTileContent() : undefined}
        plotContent={tile.type === "Plot" ? renderTileContent() : undefined}
        viewContent={tile.type === "View" ? renderTileContent() : undefined}
        editorContent={tile.type === "Editor" ? renderTileContent() : undefined}
      />
    </HydrationBoundary>
  );
} 