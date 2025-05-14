import { Suspense } from "react";
import { getQueryClient } from '@/lib/react-query/getQueryClient'
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
  GranularTileActions,
} from "@/types/evals/grid";
import { PlotArguments, LogFieldsResponseProps, LogsResponseProps, LogProps, GroupedMetrics } from "@/types/evals/logs";

type PlotWrapperActions = {
  tileActions: GranularTileActions;
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
  const tileId = tile.id || "";

  // Fetch all tiles for this tab
  if (tabId) {
    await qc.prefetchQuery({
      queryKey: ["tiles", tabId],
      queryFn: () => actions.tileActions.list(tabId, undefined, false)
    });
  }

  const allTiles = qc.getQueryData<TileData[]>(["tiles", tabId]) || [];
  
  // Filter to get just the table tiles
  const tableTiles = allTiles.filter(t => t.type === "Table");

  // Get pre-built plotArguments from cache - all processing is done in TabWrapper
  const plotArguments = qc.getQueryData<PlotArguments>(["plotArguments", tabId]) || {};
    
  // Identify which tables are used in this plot by name
  const usedTableNames: string[] = [];
  
  // Check x-axis
  if (tile.plot_tile?.x_axis && tile.plot_tile?.x_axis?.includes(".")) {
    const tableName = tile.plot_tile?.x_axis?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }
  
  // Check y-axis
  if (tile.plot_tile?.y_axis && tile.plot_tile?.y_axis?.includes(".")) {
    const tableName = tile.plot_tile?.y_axis?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }
  
  // Check plot-group-by
  if (tile.plot_tile?.plot_group_by && tile.plot_tile?.plot_group_by?.includes(".")) {
    const tableName = tile.plot_tile?.plot_group_by?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }

  // Create plotFields object
  const plotFields: {[name: string]: {data_type: string, field_type: "entry" | "param" | "derived_entry", artifacts: string}} = {};
  
  // fetch plot data for each table using the already built plotArguments
  const plotData_ = await Promise.all(usedTableNames.map(async (tableName) => {
    // Find the table tile for this name
    const tableTile = tableTiles.find(t => t.name === tableName);
    
    // Skip if table not found or no plot arguments
    if (!tableTile || !plotArguments[tableName]) {
      return { [tableName]: { plotLogs: [], plotFields: {} } };
    }
    
    // Get params from pre-built plotArguments - all processing is already done in TabWrapper
    const context = plotArguments[tableName].context;
    const columnContext = plotArguments[tableName].column_context;
    const filterExpression = plotArguments[tableName].filter_expr;
    const subset = plotArguments[tableName].subset;
    const metric = plotArguments[tableName].metric;
    const grouping = plotArguments[tableName].grouping;
    
    // Get fields for this table context
    const tableFieldsData = await actions.fieldsActions.get(projectId, context ?? null);
    const tableFields = tableFieldsData.docs || {};
    
    // Get table fields for plotFields
    Object.entries(tableFields).forEach(([fieldName, fieldProps]) => {
      const newFieldName = columnContext 
        ? processContext("split", columnContext, fieldName) 
        : fieldName;
      plotFields[`${tableName}.${newFieldName}`] = fieldProps as any;
    });
    
    // Get plot data
    let data: LogsResponseProps = { params: {}, logs: [], count: 0, groups: [] };
    
    // Get raw logs values or grouped metrics as logs
    if (
      (tile.plot_tile?.plot_aggregate && tile.plot_tile?.plot_aggregate.split(".").length > 1)
      && tile.plot_tile?.plot_aggregate.split(".")[0] === tableName
      && grouping
    ) {
      const groupFields = grouping.split(",").slice(0, grouping.split(",").indexOf(tile.plot_tile?.plot_aggregate.split(".")[1]) + 1);
      const metrics = await actions.logsActions.getMetrics(
        projectId, 
        context ?? null, 
        filterExpression, 
        groupFields.join(","), 
        metric ? metric : "mean",
        subset ? subset.split("&") : []
      );
      data.logs = convertMetricsToLogs(
        groupFields, 
        metric ? metric : "mean", 
        tableFields as any, 
        metrics as GroupedMetrics
      );
    }
    else if (subset) {
      const rawData = await actions.logsActions.get(
        projectId, 
        context ?? null, 
        columnContext ?? null, 
        filterExpression, 
        null, null, null, 
        subset, 
        null, null, null, null, null, 
        Date.now().toString()
      );
      data = replaceParamsIndicesWithValues(rawData);
    }
    
    // Return data for this table
    return { 
      [tableName]: {
        plotLogs: data.logs as LogProps[] || [],
        plotFields: plotFields
      }
    };
  }));
  
  // Reduce to a single object
  const plotDataByTable = plotData_.reduce((acc, curr) => ({ ...acc, ...curr }), {});
  
  // Process plot data
  let plotDataItem: PlotDataItem;
  
  if (Object.keys(plotDataByTable).length > 0) {
    // If non-zero tables are used in the plot, merge the plot data
    const minLogLength = Math.min(...Object.values(plotDataByTable).map(data => data.plotLogs.length));
    plotDataItem = {
      plotLogs: minLogLength > 0 ? Object.values(plotDataByTable)[0].plotLogs.slice(0, minLogLength).map((_, i) => {
        return Object.entries(plotDataByTable).reduce((acc, [tableId, data]) => {
          const prefixedLog = Object.fromEntries(
            Object.entries(data.plotLogs[i] || {}).map(([key, value]) => [
              `${tableId}.${key}`,
              (["params", "entries", "derived_entries"].includes(key) && value) 
                ? Object.fromEntries(Object.entries(value).map(([k,v]) => [`${tableId}.${k}`, v])) 
                : value
            ])
          );
          return { ...acc, ...prefixedLog };
        }, {}) as LogProps;
      }) : [],
      plotFields: plotFields
    };
  }
  else {
    // If no tables are used in the plot, return empty plot data
    plotDataItem = {
      plotLogs: [],
      plotFields: plotFields
    };
  }

  // Prefetch the plot data item
  await qc.prefetchQuery({
    queryKey: ["plotDataItem", tileId],
    queryFn: () => Promise.resolve(plotDataItem)
  });

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center">
          <SkeletonLoader />
        </div>
      }>
        <LogsPlot 
          tileId={tileId}
          tabId={tabId}
          interfaceId={interfaceId}
          projectId={projectId}
          tileActions={actions.tileActions}
          logsActions={actions.logsActions}
          fieldsActions={actions.fieldsActions}
        />
      </Suspense>
    </HydrationBoundary>
  );
} 