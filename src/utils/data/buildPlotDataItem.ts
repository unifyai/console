import { PlotDataItem, TileData } from "@/types/interfaces/grid";
import { PlotArguments, LogFieldsResponseProps, LogsResponseProps, LogProps, GroupedMetrics } from "@/types/interfaces/logs";
import { LogsActions } from "@/types/interfaces/grid";
import { processContext } from "@/utils/interfaces/table/columnOperations";
import { convertMetricsToLogs, replaceParamsIndicesWithValues } from "@/utils/interfaces/common";
import { sanitizeKey } from "@/app/(home)/interfaces/utils";
import { DataLabel, GroupedDataLabel } from "@/types/interfaces/plot";

/**
 * Debug flag for performance logging
 * Set NEXT_PUBLIC_DEBUG_PERFORMANCE=true to enable detailed performance timing logs
 */
const DEBUG_PERFORMANCE = process.env.NEXT_PUBLIC_DEBUG_PERFORMANCE === 'true';

/**
 * Conditional debug logger for performance metrics
 */
const perfLog = (...args: any[]) => {
  if (DEBUG_PERFORMANCE) {
    console.log(...args);
  }
};

// Metrics value type from backend - allows for any metric name as key
interface MetricsValue {
  [metric: string]: number | null | undefined;
}

/**
 * Convert backend metrics response to DataLabel[] for non-grouped bar charts.
 * Backend returns: { "yField": { "CategoryA": { "mean": 42.5 }, "CategoryB": { "mean": 31.2 } } }
 * Output: [["CategoryA", 42.5], ["CategoryB", 31.2]]
 */
export function convertMetricsToDataLabels(
  metricsResponse: Record<string, Record<string, MetricsValue>>,
  yAxisField: string,
  metric: string
): DataLabel[] {
  const fieldMetrics = metricsResponse[yAxisField] || {};
  return Object.entries(fieldMetrics).map(([category, values]) => {
    const value = values.shared_value ?? values[metric] ?? 0;
    return [category, typeof value === 'number' ? value : 0] as DataLabel;
  });
}

/**
 * Convert backend metrics response to GroupedDataLabel[] for grouped bar charts.
 * Backend returns nested: { "yField": { "GroupA": { "Cat1": { "mean": 10 } }, "GroupB": { "Cat1": { "mean": 20 } } } }
 * Output: [["GroupA", ["Cat1", 10]], ["GroupB", ["Cat1", 20]]]
 */
export function convertMetricsToGroupedDataLabels(
  metricsResponse: Record<string, Record<string, Record<string, MetricsValue>>>,
  yAxisField: string,
  metric: string
): GroupedDataLabel[] {
  const result: GroupedDataLabel[] = [];
  const fieldMetrics = metricsResponse[yAxisField] || {};
  
  for (const [groupKey, categories] of Object.entries(fieldMetrics)) {
    for (const [category, values] of Object.entries(categories as Record<string, MetricsValue>)) {
      const value = values.shared_value ?? values[metric] ?? 0;
      result.push([groupKey, [category, typeof value === 'number' ? value : 0]]);
    }
  }
  return result;
}

/**
 * Fetch pre-aggregated bar chart data from backend metrics endpoint.
 * Returns data in DataLabel[] or GroupedDataLabel[] format ready for D3 rendering.
 */
export async function fetchBarChartAggregatedData(
  projectId: string,
  context: string | null,
  columnContext: string | null,
  xAxis: string,           // Group-by field (categories for X-axis)
  yAxis: string,           // Field to aggregate
  metric: string,          // mean, sum, count, etc.
  groupBy: string | null,  // Optional secondary grouping (color groups)
  filterExpr: string | null,
  signal?: AbortSignal
): Promise<{ data: DataLabel[] | GroupedDataLabel[]; isGrouped: boolean }> {
  const params = new URLSearchParams();
  params.set('project', projectId);
  if (context) params.set('context', context);
  params.set('key', JSON.stringify([sanitizeKey(yAxis)]));
  
  // Build group_by: if we have a secondary groupBy, use [groupBy, xAxis] for nested grouping
  // Otherwise just [xAxis] for simple category grouping
  const groupByFields = groupBy ? [sanitizeKey(groupBy), sanitizeKey(xAxis)] : [sanitizeKey(xAxis)];
  params.set('group_by', JSON.stringify(groupByFields));
  
  if (filterExpr) params.set('filter_expr', filterExpr);

  const response = await fetch(`/api/logs/${metric}?${params.toString()}`, {
    method: 'GET',
    signal,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch bar chart metrics: ${response.status}`);
  }

  const metricsData = await response.json();

  // Convert to appropriate tuple type
  if (groupBy) {
    return {
      data: convertMetricsToGroupedDataLabels(metricsData, sanitizeKey(yAxis), metric),
      isGrouped: true
    };
  } else {
    return {
      data: convertMetricsToDataLabels(metricsData, sanitizeKey(yAxis), metric),
      isGrouped: false
    };
  }
}

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
  logsActions: LogsActions,
  signal?: AbortSignal
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
    logsActions,
    signal
  );
  const tFetchPlotDataByTableEnd = performance.now();
  perfLog(`[perf] fetchPlotDataByTable: ${(tFetchPlotDataByTableEnd - tFetchPlotDataByTable).toFixed(2)} ms`);

  // Process plot data
  let plotDataItem: PlotDataItem;
  
  if (Object.keys(plotDataByTable).length > 0) {
    // Check if we have pre-aggregated bar chart data
    const firstTableData = Object.values(plotDataByTable)[0];
    if (firstTableData.preAggregatedBarData) {
      // Bar chart with pre-aggregated data - no need to merge logs
      plotDataItem = {
        plotLogs: [],
        plotFields: plotFields,
        preAggregatedBarData: firstTableData.preAggregatedBarData,
        isGroupedBarChart: firstTableData.isGroupedBarChart
      };
    } else {
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
 * Internal type for table data returned by fetchPlotDataByTable
 */
interface TablePlotData {
  plotLogs: LogProps[];
  plotFields: LogFieldsResponseProps;
  preAggregatedBarData?: DataLabel[] | GroupedDataLabel[];
  isGroupedBarChart?: boolean;
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
  logsActions: LogsActions,
  signal?: AbortSignal
): Promise<Record<string, TablePlotData>> {
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
    const limit = plotArguments[tableName].limit;
    const randomize = plotArguments[tableName].randomize;

    // Get fields for this table context
    const tableFields = fields[tableTileIndex] || {};
    
    // Get plot data
    let data: LogsResponseProps = { params: {}, logs: [], count: 0, groups: [] };

    let [xAxis, yAxis, group] = [plotTile.plot_tile?.x_axis, plotTile.plot_tile?.y_axis, plotTile.plot_tile?.plot_group_by];
    const plotType = plotTile.plot_tile?.plot_type;
    
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
      
      // BAR CHART: Use backend aggregation for better performance
      if (plotType === "Bar Chart" && xAxis && yAxis) {
        try {
          const metricName = metric || "mean";
          const { data: barData, isGrouped } = await fetchBarChartAggregatedData(
            projectId,
            context,
            columnContext,
            xAxis,
            yAxis,
            metricName,
            group || null,
            filterExpression,
            signal
          );
          
          perfLog(`[perf] Bar chart using pre-aggregated data: ${barData.length} bars, grouped: ${isGrouped}`);
          
          return {
            [tableName]: {
              plotLogs: [],  // Not needed for pre-aggregated bar charts
              plotFields: plotFields,
              preAggregatedBarData: barData,
              isGroupedBarChart: isGrouped
            }
          };
        } catch (err) {
          // Fall through to regular fetch on error
          perfLog(`[perf] Bar chart aggregation failed, falling back to raw logs:`, err);
        }
      }
      
      // Get raw logs values or grouped metrics as logs
      if (
        (plotTile.plot_tile?.plot_aggregate && plotTile.plot_tile?.plot_aggregate.split(".").length > 1)
        && plotTile.plot_tile?.plot_aggregate.split(".")[0] === tableName
        && grouping
      ) {
        const groupFields = grouping.split(",").slice(0, grouping.split(",").indexOf(plotTile.plot_tile?.plot_aggregate.split(".")[1]) + 1);
        
        // Call API route directly instead of server action
        const metricName = metric ? metric : "mean";
        const keyNames = subset ? subset.split("&").map(sanitizeKey) : [];
        const params = new URLSearchParams();
        params.set('project', projectId);
        if (context) params.set('context', context);
        params.set('key', JSON.stringify(keyNames));
        if (filterExpression) params.set('filter_expr', filterExpression);
        params.set('group_by', JSON.stringify(groupFields));
        
        const metricsRes = await fetch(`/api/logs/${metricName}?${params.toString()}`, {
          method: 'GET',
          signal: signal as AbortSignal,
          cache: 'no-store',
        });
        
        if (!metricsRes.ok) {
          throw new Error(`Failed to fetch metrics: ${metricsRes.status}`);
        }
        
        const metrics = await metricsRes.json();
    
        data.logs = convertMetricsToLogs(
          groupFields, 
          metricName, 
          tableFields, 
          metrics as GroupedMetrics
        );
    
      }
      else if (subset) {
        // Call API route directly instead of server action
        const params = new URLSearchParams();
        params.set('project', projectId);
        if (context) params.set('context', context);
        if (columnContext) params.set('column_context', columnContext);
        if (filterExpression) params.set('filter_expr', filterExpression);
        if (subset) params.set('from_fields', subset);
        if (limit) params.set('limit', limit);
        if (randomize) params.set('randomize', randomize);

        const logsRes = await fetch(`/api/logs?${params.toString()}`, {
          method: 'GET',
          signal: signal as AbortSignal,
          cache: 'no-store',
        });
        
        if (!logsRes.ok) {
          throw new Error(`Failed to fetch plot logs: ${logsRes.status}`);
        }

        const rawData = await logsRes.json();
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