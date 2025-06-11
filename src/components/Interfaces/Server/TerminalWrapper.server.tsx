import { Suspense } from "react";
import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import Terminal from "../Details/Terminal/Terminal";

import type {
  TileData,
  ProjectsActions,
  ContextActions,
  LogsActions,
  FieldsActions,
  GranularTileActions,
  CodeActions,
  FileActions
} from "@/types/evals/grid";

interface TerminalWrapperProps {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: {
    codeActions: CodeActions;
    tileActions: GranularTileActions;
    projectsActions: ProjectsActions;
    contextActions: ContextActions;
    logsActions: LogsActions;
    fieldsActions: FieldsActions;
    fileActions: FileActions;
  };
}

export default async function TerminalWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions
}: TerminalWrapperProps) {
  console.log("[TerminalWrapper] Rendering...");
  const qc = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <SkeletonLoader />
          </div>
        }
      >
        <Terminal
          tileId={tile.id || ""}
          tabId={tabId}
          interfaceId={interfaceId}
          projectId={projectId}
          tileActions={actions.tileActions}
          projectsActions={actions.projectsActions}
          logsActions={actions.logsActions}
          fieldsActions={actions.fieldsActions}
          contextActions={actions.contextActions}
          codeActions={actions.codeActions}
          fileActions={actions.fileActions}
        />
      </Suspense>
    </HydrationBoundary>
  );
} 