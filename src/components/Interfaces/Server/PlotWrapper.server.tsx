import { Suspense } from "react";
import { getQueryClient } from '@/lib/react-query/getQueryClient'
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import SkeletonLoader from "@/components/Common/Loaders/SkeletonLoader";
import LogsPlot from "../Details/Plot/Plot";
import { buildFilterExpression } from "@/utils/evals/filters";
import { processContext } from "@/utils/evals/columnOperations";
import { convertMetricsToLogs, replaceParamsIndicesWithValues } from "@/utils/evals/common";
import { PlotDataItem } from "@/types/evals/grid";
import { buildTableArguments } from "@/utils/arguments/buildTableArguments";
import { buildPlotArguments, updatePlotArgumentsForUsedTables } from "@/utils/arguments/buildPlotArguments";

import type {
  LogsActions,
  FieldsActions,
  TileData,
  GranularTileActions,
} from "@/types/evals/grid";
import { PlotsArguments, TablesArguments, LogFieldsResponseProps, LogsResponseProps, LogProps, GroupedMetrics } from "@/types/evals/logs";

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

  // Fetch all tiles for this tab - we need this to build arguments properly
  if (tabId) {
    await qc.prefetchQuery({
      queryKey: ["tiles", tabId],
      queryFn: () => actions.tileActions.list(tabId, undefined, false)
    });
  }

  const allTiles = qc.getQueryData<TileData[]>(["tiles", tabId]) || [];
  
  // Filter to get just the table tiles
  const tableTiles = allTiles.filter(t => t.type === "Table");

  // Fetch all necessary fields for table tiles
  const fieldsPromises = tableTiles.map(tableTile => 
    actions.fieldsActions.get(projectId, tableTile.context ?? null)
  );
  const fieldsResults = await Promise.all(fieldsPromises);
  
  // Create a map of context to fields
  const fieldsMap: Record<string, LogFieldsResponseProps> = {};
  tableTiles.forEach((tableTile, index) => {
    fieldsMap[tableTile.context || ""] = fieldsResults[index];
  });

  // Get or build tableArguments 
  let tableArguments = qc.getQueryData<TablesArguments>(["tableArguments", tabId]) || {};
  
  // If tableArguments is empty (not yet created by TableWrapper), build it
  if (Object.keys(tableArguments).length === 0) {
    tableArguments = await buildTableArguments(tableTiles, fieldsMap);
    qc.setQueryData(["tableArguments", tabId], tableArguments);
  }

  // Build plotArguments from tableArguments
  let plotArguments = qc.getQueryData<PlotsArguments>(["plotArguments", tabId]) || {};
  plotArguments = buildPlotArguments(tableArguments, plotArguments);
  
  // Update plotArguments for tables used by this plot
  plotArguments = updatePlotArgumentsForUsedTables(tile, tableTiles, plotArguments);
  
  // Update the cache with plotArguments
  qc.setQueryData(["plotArguments", tabId], plotArguments);

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

  // Create plotFields object
  const plotFields: LogFieldsResponseProps = {};
  
  // fetch plot data for each table
  const plotData_ = await Promise.all(usedTableNames.map(async (tableName) => {
    // Find the table tile for this name
    const tableTile = tableTiles.find(t => t.name === tableName);
    
    // Skip if table not found
    if (!tableTile) {
      return { [tableName]: { plotLogs: [], plotFields: {} } };
    }
    
    // Get table context and parameters
    const context = tableTile.context;
    const columnContext = tableTile.column_context;
    const freeze = tableTile.freeze;
    const commonFilter = tableTile.common_filter;
    const filters = tableTile.filters;
    const metric = tableTile.metric;
    const grouping = tableTile.grouping;
    
    // Get filter expression for this table
    const tableFields = fieldsMap[context || ""] || {};
    const filterExpression = buildFilterExpression(
      filters,
      commonFilter,
      columnContext,
      freeze,
      tableFields
    );
    
    // Get table fields for plotFields
    Object.entries(tableFields).forEach(([fieldName, fieldProps]) => {
      const newFieldName = columnContext 
        ? processContext("split", columnContext, fieldName) 
        : fieldName;
      plotFields[`${tableName}.${newFieldName}`] = fieldProps;
    });
    
    // Get plot data
    let data: LogsResponseProps = { params: {}, logs: [], count: 0, groups: [] };
    let [xAxis, yAxis, group] = [
      tile.plot_tile?.x_axis,
      tile.plot_tile?.y_axis, 
      tile.plot_tile?.plot_group_by
    ];
    let subset = null;
    
    if (xAxis && xAxis.split(".").length > 1) {
      // Extract required fields
      xAxis = xAxis.split(".")[1];
      xAxis = columnContext ? processContext("merge", columnContext, xAxis) : xAxis;
      subset = xAxis;
      
      if (yAxis && yAxis.split(".").length > 1) {
        yAxis = yAxis.split(".")[1];
        yAxis = columnContext ? processContext("merge", columnContext, yAxis) : yAxis;
        subset += `&${yAxis}`;
      }
      
      if (group && group.split(".").length > 1) {
        group = group.split(".")[1];
        group = columnContext ? processContext("merge", columnContext, group) : group;
        subset += `&${group}`;
      }
      
      if (subset) plotArguments[tableName].subset = subset;
      
      // Update cache with updated subset
      qc.setQueryData(["plotArguments", tabId], plotArguments);
      
      // Get raw logs values or grouped metrics as logs
      if (
        (tile.plot_tile?.plot_aggregate && tile.plot_tile?.plot_aggregate.split(".").length > 1) // `plot_aggregate` has the format `table.column`
        && tile.plot_tile?.plot_aggregate.split(".")[0] === tableName                          // `table` in `plot_aggregate` is the current table name
        && grouping                                                                          // the current table has grouping applied
      ) {
        const groupFields = grouping.split(",").slice(0, grouping.split(",").indexOf(tile.plot_tile?.plot_aggregate.split(".")[1]) + 1);
        const metrics = await actions.logsActions.getMetrics(
          projectId, 
          context ?? null, 
          filterExpression, 
          groupFields.join(","), 
          metric ? metric : "mean",
          subset.split("&")
        );
        data.logs = convertMetricsToLogs(groupFields, metric ? metric : "mean", tableFields, metrics as GroupedMetrics);
      }
      else {
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