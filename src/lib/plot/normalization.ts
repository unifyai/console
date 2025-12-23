/**
 * Normalization utilities for Plot API
 *
 * Pure functions for normalizing plot configurations and building query parameters.
 * These functions have no side effects and are easy to unit test.
 */

import type { PlotConfig, ProjectConfig } from "./store";

/**
 * Request plot config format (from API request)
 */
export interface RequestPlotConfig {
  type?: string;
  plot_type?: string;
  x_axis: string;
  y_axis?: string;
  group_by?: string;
  aggregate?: string;
  scale_x?: string;
  scale_y?: string;
  metric?: string;
  bin_count?: number;
  show_regression?: boolean;
  colors?: Record<string, string>;
}

/**
 * Normalize plot type from various input formats to short form.
 * Pure function - no side effects.
 *
 * @param type - Short form type ("scatter", "bar", etc.)
 * @param plotType - Long form type ("Scatter Plot", "Bar Chart", etc.)
 * @returns Normalized short form type
 */
export function normalizePlotType(type?: string, plotType?: string): string {
  const input = (type || plotType || "").toLowerCase().trim();

  const typeMap: Record<string, string> = {
    scatter: "scatter",
    "scatter plot": "scatter",
    scatterplot: "scatter",
    bar: "bar",
    "bar chart": "bar",
    barchart: "bar",
    histogram: "histogram",
    distribution: "histogram",
    line: "line",
    "line chart": "line",
    linechart: "line",
    "time series": "line",
    timeseries: "line",
  };

  return typeMap[input] || "scatter"; // Default to scatter
}

/**
 * Normalize a plot config from request format to internal format.
 * Pure function - no side effects.
 *
 * @param requestConfig - Config from API request
 * @returns Normalized PlotConfig for storage
 */
export function normalizeConfig(requestConfig: RequestPlotConfig): PlotConfig {
  return {
    type: normalizePlotType(requestConfig.type, requestConfig.plot_type),
    xAxis: requestConfig.x_axis,
    yAxis: requestConfig.y_axis,
    groupBy: requestConfig.group_by,
    aggregate: requestConfig.aggregate,
    scaleX: requestConfig.scale_x || "linear",
    scaleY: requestConfig.scale_y || "linear",
    metric: requestConfig.metric || "mean",
    binCount: requestConfig.bin_count || 10,
    showRegression: requestConfig.show_regression || false,
    colors: requestConfig.colors,
  };
}

/**
 * Build URLSearchParams for logs API from ProjectConfig.
 * Pure function - no side effects.
 *
 * @param projectConfig - Project configuration
 * @returns URLSearchParams ready for API call
 */
export function buildLogsParams(projectConfig: ProjectConfig): URLSearchParams {
  const params = new URLSearchParams({
    project: projectConfig.project_name,
  });

  // Context parameters
  if (projectConfig.context) {
    params.append("context", projectConfig.context);
  }
  if (projectConfig.column_context) {
    params.append("column_context", projectConfig.column_context);
  }

  // Filter parameters
  if (projectConfig.filter_expr) {
    params.append("filter_expr", projectConfig.filter_expr);
  }
  if (projectConfig.from_ids) {
    params.append("from_ids", projectConfig.from_ids);
  }
  if (projectConfig.exclude_ids) {
    params.append("exclude_ids", projectConfig.exclude_ids);
  }
  if (projectConfig.from_fields) {
    params.append("from_fields", projectConfig.from_fields);
  }
  if (projectConfig.exclude_fields) {
    params.append("exclude_fields", projectConfig.exclude_fields);
  }

  // Pagination parameters
  if (projectConfig.limit !== undefined) {
    params.append("limit", projectConfig.limit.toString());
  }
  if (projectConfig.offset !== undefined) {
    params.append("offset", projectConfig.offset.toString());
  }

  // Grouping parameters
  if (projectConfig.group_by?.length) {
    projectConfig.group_by.forEach((g) => params.append("group_by", g));
  }
  if (projectConfig.group_limit !== undefined) {
    params.append("group_limit", projectConfig.group_limit.toString());
  }
  if (projectConfig.group_offset !== undefined) {
    params.append("group_offset", projectConfig.group_offset.toString());
  }
  if (projectConfig.group_depth !== undefined) {
    params.append("group_depth", projectConfig.group_depth.toString());
  }
  if (projectConfig.groups_only) {
    params.append("groups_only", "true");
  }
  if (projectConfig.nested_groups === false) {
    params.append("nested_groups", "false");
  }

  // Sorting parameters
  if (projectConfig.sorting) {
    params.append("sorting", projectConfig.sorting);
  }
  if (projectConfig.group_sorting) {
    params.append("group_sorting", projectConfig.group_sorting);
  }

  // Other options
  if (projectConfig.value_limit !== undefined) {
    params.append("value_limit", projectConfig.value_limit.toString());
  }
  if (projectConfig.randomize) {
    params.append("randomize", "true");
  }
  if (projectConfig.seed) {
    params.append("seed", projectConfig.seed);
  }

  return params;
}

/**
 * Build URLSearchParams for fields API from ProjectConfig.
 * Pure function - no side effects.
 *
 * @param projectConfig - Project configuration
 * @returns URLSearchParams ready for API call
 */
export function buildFieldsParams(
  projectConfig: ProjectConfig
): URLSearchParams {
  const params = new URLSearchParams({
    project: projectConfig.project_name,
  });

  if (projectConfig.context) {
    params.append("context", projectConfig.context);
  }
  if (projectConfig.column_context) {
    params.append("column_context", projectConfig.column_context);
  }

  return params;
}


