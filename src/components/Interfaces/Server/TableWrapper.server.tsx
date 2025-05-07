import { Suspense } from "react";
import { getQueryClient } from "@/components/Providers/QueryProvider";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import LogsTable from "../Table/Table";

import type {
  LogsActions,
  FieldsActions,
  DerivedEntryActions,
  ContextActions,
  TileData
} from "@/types/evals/grid";

type TableWrapperProps = {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: {
    logsActions: LogsActions;
    fieldsActions: FieldsActions;
    derivedEntryActions: DerivedEntryActions;
    contextActions: ContextActions;
  };
};

export default async function TableWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions
}: TableWrapperProps) {
  const qc = getQueryClient();

  // Only proceed if we have a table tile
  if (!tile.table_tile) {
    return <div>Table configuration missing</div>;
  }

  // Prefetch table data
  await qc.prefetchQuery({
    queryKey: ["table", tile.id, 0],
    queryFn: () =>
      actions.logsActions.get(
        projectId,
        tile.context ?? null,
        tile.table_tile?.column_context ?? null,
        null, // filters
        null, // common_filter
        tile.table_tile?.sorting ?? null,
        tile.table_tile?.grouping ?? null,
        tile.table_tile?.group_sorting ?? null,
        tile.table_tile?.table_type ?? null,
        20, // rows per page
        0,  // page number
        null,
        null,
        Date.now().toString(),
      ),
  });

  // Also fetch fields data if needed
  if (tile.context) {
    await qc.prefetchQuery({
      queryKey: ["fields", projectId, tile.context],
      queryFn: () => actions.fieldsActions.get(projectId, tile.context ?? null),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Suspense fallback={<SkeletonLoader />}>
        <LogsTable
          tileId={tile.id || ""}
          tabId={tabId}
          interfaceId={interfaceId}
          projectId={projectId}
          logsActions={actions.logsActions}
          fieldsActions={actions.fieldsActions}
          derivedEntryActions={actions.derivedEntryActions}
          contextActions={actions.contextActions}
        />
      </Suspense>
    </HydrationBoundary>
  );
} 