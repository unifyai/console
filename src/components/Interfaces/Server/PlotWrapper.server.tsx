import { Suspense } from "react";
import { getQueryClient } from "@/components/Providers/QueryProvider";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import LogsPlot from "../Details/Plot/Plot";

import type {
  LogsActions,
  FieldsActions,
  TileData
} from "@/types/evals/grid";

type PlotWrapperProps = {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: {
    logsActions: LogsActions;
    fieldsActions: FieldsActions;
  };
};

export default async function PlotWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions
}: PlotWrapperProps) {
  const qc = getQueryClient();

  // Only proceed if we have a plot tile
  if (!tile.plot_tile) {
    return <div>Plot configuration missing</div>;
  }

  // Prefetch plot data for tables
  await qc.prefetchQuery({
    queryKey: ["plot_data", tile.id],
    queryFn: () =>
      actions.logsActions.get(
        projectId,
        tile.context ?? null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        100, // rows per page for plots
        0,
        null,
        null,
        Date.now().toString(),
      ),
  });

  // Prefetch plot metrics data if grouping is enabled
  if (tile.plot_tile.plot_group_by) {
    await qc.prefetchQuery({
      queryKey: ["plot_metrics", tile.id],
      queryFn: () =>
        actions.logsActions.getMetrics(
          projectId,
          tile.context ?? null,
          null,
          tile.plot_tile?.plot_group_by || null,
          tile.metric || "mean",
          [], // fields
        ),
    });
  }

  // Also fetch fields data if needed
  if (tile.context) {
    await qc.prefetchQuery({
      queryKey: ["fields", projectId, tile.context],
      queryFn: () => actions.fieldsActions.get(projectId, tile.context || ""),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Suspense fallback={<SkeletonLoader />}>
        <LogsPlot
          tileId={tile.id || ""}
          tabId={tabId}
          interfaceId={interfaceId}
          projectId={projectId}
          logsActions={actions.logsActions}
          fieldsActions={actions.fieldsActions}
        />
      </Suspense>
    </HydrationBoundary>
  );
} 