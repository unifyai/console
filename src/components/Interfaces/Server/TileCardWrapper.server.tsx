import { Suspense } from "react";
import TileCard from "../TileCard";
import TileWrapper from "./TileWrapper.server";
import { getQueryClient } from '@/lib/react-query/getQueryClient'
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import { StoreSliceUpdater } from "@/contexts/providers/StoreSliceUpdater";
import { buildTileStateForStore } from "@/contexts/utils/stateBuilderUtils";
import { IStoreState } from "@/contexts/store";

import type {
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  ContextActions,
  CodeActions,
  GranularTileActions,
  TileData
} from "@/types/evals/grid";

type TileCardWrapperActions = {
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  derivedEntryActions: DerivedEntryActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  tileActions: GranularTileActions;
};

export default async function TileCardWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions,
}: {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: TileCardWrapperActions;
}) {
  const qc = getQueryClient();
  
  // Build the tile state explicitly for this specific tile
  const tileState = buildTileStateForStore(
    tile,
    undefined, // tableData
    undefined, // plotData
    tabId,
    interfaceId,
    projectId
  );
  
  // Create tile-specific slice - only include tile state
  const slice: Partial<IStoreState> = {
    // Only include tile state, no need for global navigation properties
    ...tileState
  };
  
  return (
    <>
      {/* Update the store with only tile state */}
      <StoreSliceUpdater slice={slice} />
      
      <HydrationBoundary state={dehydrate(qc)}>
        <TileCard
          index={0} // This would need to be provided correctly
          tileId={tile.id || ""}
          tabId={tabId}
          interfaceId={interfaceId}
          projectId={projectId}
          tileActions={actions.tileActions}
          logsActions={actions.logsActions}
          fieldsActions={actions.fieldsActions}
          derivedEntryActions={actions.derivedEntryActions}
          contextActions={actions.contextActions}
          codeActions={actions.codeActions}
        >
          <Suspense fallback={<SkeletonLoader />}>
            <TileWrapper
              tile={tile}
              tabId={tabId}
              interfaceId={interfaceId}
              projectId={projectId}
              actions={actions}
            />
          </Suspense>
        </TileCard>
      </HydrationBoundary>
    </>
  );
} 