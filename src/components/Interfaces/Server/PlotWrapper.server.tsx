import { Suspense } from "react";
import { getQueryClient } from "@/components/Providers/QueryProvider";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import LogsPlot from "../Details/Plot/Plot";
import { buildFilterExpression } from "@/utils/evals/filters";
import { processContext } from "@/utils/evals/columnOperations";
import { convertMetricsToLogs, replaceParamsIndicesWithValues } from "@/utils/evals/common";
import { PlotDataItem } from "@/types/evals/grid";

import type {
  LogsActions,
  FieldsActions,
  TileData,
} from "@/types/evals/grid";
import { PlotArguments, LogFieldsResponseProps, LogsResponseProps, LogProps, GroupedMetrics } from "@/types/evals/logs";

type PlotWrapperActions = {
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
};

export default async function PlotWrapper({
  tile,
  tabId,
  interfaceId,
  projectId,
  actions
}: {
  tile: TileData;
  tabId: string;
  interfaceId: string;
  projectId: string;
  actions: PlotWrapperActions;
}) {
  const qc = getQueryClient();

  // Only proceed if we have a plot tile
  if (!tile.plot_tile) {
    return <div>Plot configuration missing</div>;
  }

  // Prefetch fields
  await qc.prefetchQuery({
    queryKey: ["fields", projectId, tile.context],
    queryFn: () => actions.fieldsActions.get(projectId, tile.context ?? null)
  });

  // Get fields from cache
  const fields = qc.getQueryData<LogFieldsResponseProps>(["fields", projectId, tile.context]) || {};

  // Build filter expression
  const filterExpression = buildFilterExpression(
    tile.filters,
    tile.common_filter,
    tile.column_context,
    tile.freeze,
    fields
  );

  // Get plot data
  let data: LogsResponseProps = { params: {}, logs: [], count: 0, groups: [] };
  let [xAxis, yAxis, group] = [tile.plot_tile.x_axis, tile.plot_tile.y_axis, tile.plot_tile.plot_group_by];
  let subset = null;

  if (xAxis && xAxis.split(".").length > 1) {
    // Extract required fields
    xAxis = xAxis.split(".")[1];
    xAxis = tile.column_context ? processContext("merge", tile.column_context, xAxis) : xAxis;
    subset = xAxis;
    
    if (yAxis && yAxis.split(".").length > 1) {
      yAxis = yAxis.split(".")[1];
      yAxis = tile.column_context ? processContext("merge", tile.column_context, yAxis) : yAxis;
      subset += `&${yAxis}`;
    }
    
    if (group && group.split(".").length > 1) {
      group = group.split(".")[1];
      group = tile.column_context ? processContext("merge", tile.column_context, group) : group;
      subset += `&${group}`;
    }

    // Get raw logs values or grouped metrics as logs
    if (
      tile.plot_tile?.plot_aggregate && 
      tile.plot_tile.plot_aggregate.split(".").length > 1 && 
      tile.plot_tile.plot_aggregate.split(".")[0] === tile.id && 
      tile.grouping
    ) {
      const groupFields = tile.grouping.split(",").slice(0, tile.grouping.split(",").indexOf(tile.plot_tile.plot_aggregate.split(".")[1]) + 1);
      const metrics = await actions.logsActions.getMetrics(
        projectId,
        tile.context ?? null,
        filterExpression,
        groupFields.join(","),
        tile.metric ?? "mean",
        subset.split("&")
      );
      data.logs = convertMetricsToLogs(groupFields, tile.metric ?? "mean", fields, metrics as GroupedMetrics);
    } else {
      const rawData = await actions.logsActions.get(
        projectId,
        tile.context ?? null,
        tile.column_context ?? null,
        filterExpression,
        null,
        null,
        null,
        subset,
        null,
        null,
        null,
        null,
        null,
        Date.now().toString()
      );
      data = replaceParamsIndicesWithValues(rawData);
    }
  }

  // Construct plot data item
  const plotDataItem: PlotDataItem = {
    plotLogs: data.logs as LogProps[] || [],
    plotArguments: {
      [tile.id || '']: {
        context: tile.context,
        column_context: tile.column_context,
        freeze: tile.freeze,
        common_filter: tile.common_filter,
        column_filters: tile.filters,
        metric: tile.metric,
        grouping: tile.grouping,
        subset
      }
    } as PlotArguments,
    plotFields: fields
  };

  // Prefetch the plot data item
  await qc.prefetchQuery({
    queryKey: ["plotData", tile.id],
    queryFn: () => Promise.resolve(plotDataItem)
  });

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