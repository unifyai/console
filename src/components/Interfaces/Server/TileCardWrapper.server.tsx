import { Suspense } from "react";
import TileCard from "../TileCard";
import TileWrapper from "./TileWrapper.server";
import { getQueryClient } from '@/lib/react-query/getQueryClient'
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";

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
  
  return (
    <>
      <HydrationBoundary state={dehydrate(qc)}>
        <TileCard
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