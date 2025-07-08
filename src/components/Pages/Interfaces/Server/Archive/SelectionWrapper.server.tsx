import { Suspense } from "react";
import getQueryClient from '@/app/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import Selection from "../../Blocks/Selection/Selection";
import { ExpandProvider } from "@/contexts/ExpandContext";

import type {
  LogsActions,
  TileData
} from "@/types/interfaces/grid";

type SelectionWrapperActions = {
  logsActions: LogsActions;
};

type SelectionWrapperProps = {
  tile: TileData;
  tabId: string;
  projectId: string;
  actions: SelectionWrapperActions;
};

export default async function SelectionWrapper({
  tile,
  tabId,
  projectId,
  actions
}: SelectionWrapperProps) {
  console.log("[SelectionWrapper] Rendering...");
  const qc = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <div className="w-full overflow-auto">
        <ExpandProvider>
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <SkeletonLoader />
            </div>
          }>
            <Selection
              tileId={tile.id || ""}
              tabId={tabId}
              projectId={projectId}
              logsActions={actions.logsActions}
            />
          </Suspense>
        </ExpandProvider>
      </div>
    </HydrationBoundary>
  );
} 