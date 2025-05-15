import { Suspense } from "react";
import { getQueryClient } from '@/lib/react-query/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import Editor from "../Details/Editor/Editor";

import type {
  CodeActions,
  TileData
} from "@/types/evals/grid";
import { GranularTileActions } from "@/types/evals/grid";

type EditorWrapperProps = {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: {
    codeActions: CodeActions;
    tileActions: GranularTileActions;
  };
};

export default async function EditorWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions
}: EditorWrapperProps) {
  console.log("EditorWrapper rendering...");
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
          />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
} 