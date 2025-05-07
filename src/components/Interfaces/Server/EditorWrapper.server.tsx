import { Suspense } from "react";
import { getQueryClient } from "@/components/Providers/QueryProvider";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import Editor from "../Details/Editor/Editor";

import type {
  CodeActions,
  TileData
} from "@/types/evals/grid";

type EditorWrapperProps = {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: {
    codeActions: CodeActions;
  };
};

export default async function EditorWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions
}: EditorWrapperProps) {
  const qc = getQueryClient();

  // Only proceed if we have an editor tile
  if (!tile.editor_tile) {
    return <div>Editor configuration missing</div>;
  }

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
      <Suspense fallback={<SkeletonLoader />}>
        <Editor
          tileId={tile.id || ""}
          tabId={tabId}
          interfaceId={interfaceId}
          projectId={projectId}
          codeActions={actions.codeActions}
        />
      </Suspense>
    </HydrationBoundary>
  );
} 