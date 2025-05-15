import { Suspense } from "react";
import { getQueryClient } from '@/lib/react-query/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import Selection from "../Details/Selection/Selection";
import { ExpandProvider } from "@/contexts/ExpandContext";

import type {
  LogsActions,
  TileData
} from "@/types/evals/grid";

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
  console.log("SelectionWrapper rendering...");
  const qc = getQueryClient();

  // For Selection views, we need to prefetch the source table's data
  // This is typically done when a selection is made in the UI
  // Here we're only setting up the initial structure

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