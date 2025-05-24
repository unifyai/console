import { PlotDataItem, TileData } from "@/types/evals/grid";
import { PlotArguments, LogFieldsResponseProps, LogsResponseProps, LogProps, GroupedMetrics } from "@/types/evals/logs";
import { LogsActions } from "@/types/evals/grid";
import { processContext } from "@/utils/evals/columnOperations";
import { convertMetricsToLogs, replaceParamsIndicesWithValues } from "@/utils/evals/common";

/**
 * Builds a PlotDataItem from plot data and other inputs
 * Can be used directly in client components instead of passing through a server component
 */
export async function buildPlotDataItem(
  plotTile: TileData,
  tableTiles: TileData[],
  plotArguments: PlotArguments, 
  fields: LogFieldsResponseProps[],
  projectId: string,
  logsActions: LogsActions
): Promise<PlotDataItem> {
  // Identify which tables are used in this plot by name
  const usedTableNames = getUsedTableNames(plotTile);
  
  // Create plotFields object
  const plotFields = createPlotFields(tableTiles, fields);
  
  // Fetch plot data for each table using the already built plotArguments
  const tFetchPlotDataByTable = performance.now();
  const plotDataByTable = await fetchPlotDataByTable(
    plotTile,
    usedTableNames,
    tableTiles,
    plotArguments,
    fields,
    plotFields,
    projectId,
    logsActions
  );
  const tFetchPlotDataByTableEnd = performance.now();
  console.log(`[perf] fetchPlotDataByTable: ${(tFetchPlotDataByTableEnd - tFetchPlotDataByTable).toFixed(2)} ms`);

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
  
  return plotDataItem;
}

/**
 * Gets the names of tables used in a plot
 */
export function getUsedTableNames(plotTile: TileData): string[] {
  const usedTableNames: string[] = [];
  
  // Check x-axis
  if (plotTile.plot_tile?.x_axis && plotTile.plot_tile?.x_axis?.includes(".")) {
    const tableName = plotTile.plot_tile?.x_axis?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }
  
  // Check y-axis
  if (plotTile.plot_tile?.y_axis && plotTile.plot_tile?.y_axis?.includes(".")) {
    const tableName = plotTile.plot_tile?.y_axis?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }
  
  // Check plot-group-by
  if (plotTile.plot_tile?.plot_group_by && plotTile.plot_tile?.plot_group_by?.includes(".")) {
    const tableName = plotTile.plot_tile?.plot_group_by?.split(".")[0];
    if (!usedTableNames.includes(tableName)) {
      usedTableNames.push(tableName);
    }
  }
  
  return usedTableNames;
}

/**
 * Creates plotFields by combining fields from all table tiles
 */
function createPlotFields(tableTiles: TileData[], fields: LogFieldsResponseProps[]): LogFieldsResponseProps {
  return tableTiles.map((tile, idx) => {
    const columnContext = tile.column_context;
    return Object.fromEntries(
      Object
        .entries(fields[idx] || {})
        .filter(([name, { data_type, field_type, artifacts }]) => columnContext ? name.startsWith(columnContext) : name)
        .map(([name, { data_type, field_type, artifacts, mutable, created_at }]) => {
          const newName = columnContext ? processContext("split", columnContext, name) : name;
          return [`${tile.name}.${newName}`, { data_type, field_type, artifacts, mutable, created_at }];
        })
    );
  }).reduce((acc, curr) => ({ ...acc, ...curr }), {});
}

/**
 * Fetches plot data for each table using plotArguments
 */
async function fetchPlotDataByTable(
  plotTile: TileData,
  usedTableNames: string[],
  tableTiles: TileData[],
  plotArguments: PlotArguments,
  fields: LogFieldsResponseProps[],
  plotFields: LogFieldsResponseProps,
  projectId: string,
  logsActions: LogsActions
) {
  const plotDataPromises = usedTableNames.map(async (tableName) => {
    // Find the table tile for this name
    const tableTile = tableTiles.find(t => t.name === tableName);

    // Also find the index of the table tile
    const tableTileIndex = tableTiles.findIndex(t => t.name === tableName);
    
    // Skip if table not found or no plot arguments
    if (!tableTile || !plotArguments[tableName]) {
      return { [tableName]: { plotLogs: [], plotFields: {} } };
    }
    
    // Get params from pre-built plotArguments
    const context = plotArguments[tableName].context;
    const columnContext = plotArguments[tableName].column_context;
    const filterExpression = plotArguments[tableName].filter_expr;
    const metric = plotArguments[tableName].metric;
    const grouping = plotArguments[tableName].grouping;

    // Get fields for this table context
    const tableFields = fields[tableTileIndex] || {};
    
    // Get plot data
    let data: LogsResponseProps = { params: {}, logs: [], count: 0, groups: [] };

    let [xAxis, yAxis, group] = [plotTile.plot_tile?.x_axis, plotTile.plot_tile?.y_axis, plotTile.plot_tile?.plot_group_by];
    
    let subset = null;
    if (xAxis && xAxis.split(".").length > 1) {
      /* Extract required fields */
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
      if (subset) plotArguments[tableName]["subset"] = subset;
      
      // Get raw logs values or grouped metrics as logs
      if (
        (plotTile.plot_tile?.plot_aggregate && plotTile.plot_tile?.plot_aggregate.split(".").length > 1)
        && plotTile.plot_tile?.plot_aggregate.split(".")[0] === tableName
        && grouping
      ) {
        const groupFields = grouping.split(",").slice(0, grouping.split(",").indexOf(plotTile.plot_tile?.plot_aggregate.split(".")[1]) + 1);
        const metrics = await logsActions.getMetrics(
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
          tableFields, 
          metrics as GroupedMetrics
        );
    
      }
      else if (subset) {
        const rawData = await logsActions.get(
          projectId, 
          context ?? null, 
          columnContext ?? null, 
          filterExpression, 
          null, null, null, null,
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
  });
  
  // Wait for all promises to resolve
  const plotData = await Promise.all(plotDataPromises);
  
  // Reduce to a single object
  return plotData.reduce((acc, curr) => ({ ...acc, ...curr }), {});
} 