import { Suspense } from "react";
import { getQueryClient } from '@/lib/react-query/getQueryClient';
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import Selection from "../Details/Selection/Selection";
import { ExpandProvider } from "@/contexts/ExpandContext";

import type {
  TileData
} from "@/types/evals/grid";

type SelectionWrapperProps = {
  tile: TileData;
  tabId: string;
};

export default async function SelectionWrapper({
  tile,
  tabId,
}: SelectionWrapperProps) {
  const qc = getQueryClient();

  // For Selection views, we need to prefetch the source table's data
  // This is typically done when a selection is made in the UI
  // Here we're only setting up the initial structure

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Suspense fallback={<SkeletonLoader />}>
        <ExpandProvider>
          <Selection
            tileId={tile.id || ""}
            tabId={tabId}
          />
        </ExpandProvider>
      </Suspense>
    </HydrationBoundary>
  );
} 