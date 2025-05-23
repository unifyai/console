import { Suspense } from "react";
import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import Editor from "../Details/Editor/Editor";

import type {
  CodeActions,
  TileData,
  ProjectsActions,
  ContextActions,
  LogsActions,
  FieldsActions,
  GranularTileActions
} from "@/types/evals/grid";

type EditorWrapperProps = {
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
  };
};

export default async function EditorWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions
}: EditorWrapperProps) {
  console.log("[EditorWrapper] Rendering...");
  const qc = getQueryClient();

  // Prefetch editor content if available
  await qc.prefetchQuery({
    queryKey: ["editor", tile.id],
    queryFn: () => ({
      filePath: tile.editor_tile?.file_path || "main.txt",
      fileType: tile.editor_tile?.file_type || "txt",
      content: tile.editor_tile?.content || "",
    }),
  });

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <div className="w-full h-full overflow-y-auto">
        <Suspense fallback={
          <div className="w-full h-full flex items-center justify-center">
            <SkeletonLoader />
          </div>
        }>
          <Editor
            tileId={tile.id || ""}
            tabId={tabId}
            interfaceId={interfaceId}
            projectId={projectId}
            codeActions={actions.codeActions}
            tileActions={actions.tileActions}
            projectsActions={actions.projectsActions}
            contextActions={actions.contextActions}
            logsActions={actions.logsActions}
            fieldsActions={actions.fieldsActions}
          />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
} 