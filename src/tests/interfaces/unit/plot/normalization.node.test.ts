/**
 * Unit tests for plot normalization module
 */

import { describe, it, expect } from "vitest";
import {
  normalizePlotType,
  normalizeConfig,
  buildLogsParams,
  buildFieldsParams,
} from "@/lib/plot/normalization";

describe("normalizePlotType", () => {
  it("normalizes lowercase type names", () => {
    expect(normalizePlotType("scatter")).toBe("scatter");
    expect(normalizePlotType("bar")).toBe("bar");
    expect(normalizePlotType("histogram")).toBe("histogram");
    expect(normalizePlotType("line")).toBe("line");
  });

  it("normalizes display names", () => {
    expect(normalizePlotType("Scatter Plot")).toBe("scatter");
    expect(normalizePlotType("Bar Chart")).toBe("bar");
    expect(normalizePlotType("Line Chart")).toBe("line");
  });

  it("normalizes from plot_type parameter", () => {
    expect(normalizePlotType(undefined, "scatter")).toBe("scatter");
    expect(normalizePlotType(undefined, "Bar Chart")).toBe("bar");
  });

  it("prefers type over plot_type", () => {
    expect(normalizePlotType("scatter", "bar")).toBe("scatter");
  });

  it("defaults to scatter for unknown types", () => {
    expect(normalizePlotType("unknown")).toBe("scatter");
    expect(normalizePlotType("")).toBe("scatter");
    expect(normalizePlotType(undefined)).toBe("scatter");
  });

  it('handles "time series" as line chart', () => {
    expect(normalizePlotType("time series")).toBe("line");
    expect(normalizePlotType("timeseries")).toBe("line");
  });

  it('handles "distribution" as histogram', () => {
    expect(normalizePlotType("distribution")).toBe("histogram");
  });

  it("handles case variations", () => {
    expect(normalizePlotType("SCATTER")).toBe("scatter");
    expect(normalizePlotType("ScAtTeR")).toBe("scatter");
    expect(normalizePlotType("  scatter  ")).toBe("scatter");
  });
});

describe("normalizeConfig", () => {
  it("normalizes a complete config", () => {
    const result = normalizeConfig({
      type: "scatter",
      x_axis: "latency",
      y_axis: "tokens",
      group_by: "model",
      scale_x: "log",
      scale_y: "linear",
    });

    expect(result).toEqual({
      type: "scatter",
      xAxis: "latency",
      yAxis: "tokens",
      groupBy: "model",
      aggregate: undefined,
      scaleX: "log",
      scaleY: "linear",
      metric: "mean",
      binCount: 10,
      showRegression: false,
      colors: undefined,
    });
  });

  it("provides defaults for missing optional fields", () => {
    const result = normalizeConfig({
      type: "scatter",
      x_axis: "x",
    });

    expect(result.scaleX).toBe("linear");
    expect(result.scaleY).toBe("linear");
    expect(result.metric).toBe("mean");
    expect(result.binCount).toBe(10);
    expect(result.showRegression).toBe(false);
  });

  it("uses plot_type when type is missing", () => {
    const result = normalizeConfig({
      plot_type: "Bar Chart",
      x_axis: "category",
      y_axis: "value",
    });

    expect(result.type).toBe("bar");
  });

  it("preserves colors if provided", () => {
    const colors = { model1: "#ff0000", model2: "#00ff00" };
    const result = normalizeConfig({
      type: "scatter",
      x_axis: "x",
      colors,
    });

    expect(result.colors).toEqual(colors);
  });

  it("handles all optional fields", () => {
    const result = normalizeConfig({
      type: "histogram",
      x_axis: "latency",
      bin_count: 25,
      aggregate: "sum",
      metric: "count",
      show_regression: true,
    });

    expect(result.type).toBe("histogram");
    expect(result.binCount).toBe(25);
    expect(result.aggregate).toBe("sum");
    expect(result.metric).toBe("count");
    expect(result.showRegression).toBe(true);
  });
});

describe("buildLogsParams", () => {
  it("builds params with only project name", () => {
    const params = buildLogsParams({ project_name: "test-project" });

    expect(params.get("project")).toBe("test-project");
    expect(params.toString()).toBe("project=test-project");
  });

  it("includes context parameters", () => {
    const params = buildLogsParams({
      project_name: "test",
      context: "production",
      column_context: "metrics",
    });

    expect(params.get("context")).toBe("production");
    expect(params.get("column_context")).toBe("metrics");
  });

  it("includes filter parameters", () => {
    const params = buildLogsParams({
      project_name: "test",
      filter_expr: 'status == "success"',
      from_ids: "id1,id2",
      exclude_ids: "id3",
    });

    expect(params.get("filter_expr")).toBe('status == "success"');
    expect(params.get("from_ids")).toBe("id1,id2");
    expect(params.get("exclude_ids")).toBe("id3");
  });

  it("includes pagination parameters", () => {
    const params = buildLogsParams({
      project_name: "test",
      limit: 100,
      offset: 50,
    });

    expect(params.get("limit")).toBe("100");
    expect(params.get("offset")).toBe("50");
  });

  it("includes multiple group_by values", () => {
    const params = buildLogsParams({
      project_name: "test",
      group_by: ["model", "status"],
    });

    expect(params.getAll("group_by")).toEqual(["model", "status"]);
  });

  it("includes grouping options", () => {
    const params = buildLogsParams({
      project_name: "test",
      group_limit: 10,
      group_offset: 5,
      group_depth: 2,
      groups_only: true,
      nested_groups: false,
    });

    expect(params.get("group_limit")).toBe("10");
    expect(params.get("group_offset")).toBe("5");
    expect(params.get("group_depth")).toBe("2");
    expect(params.get("groups_only")).toBe("true");
    expect(params.get("nested_groups")).toBe("false");
  });

  it("includes sorting parameters", () => {
    const params = buildLogsParams({
      project_name: "test",
      sorting: '{"latency": "descending"}',
      group_sorting: '{"count": "ascending"}',
    });

    expect(params.get("sorting")).toBe('{"latency": "descending"}');
    expect(params.get("group_sorting")).toBe('{"count": "ascending"}');
  });

  it("includes randomization options", () => {
    const params = buildLogsParams({
      project_name: "test",
      randomize: true,
      seed: "12345",
    });

    expect(params.get("randomize")).toBe("true");
    expect(params.get("seed")).toBe("12345");
  });

  it("omits undefined/null values", () => {
    const params = buildLogsParams({
      project_name: "test",
      context: undefined,
      limit: undefined,
    });

    expect(params.has("context")).toBe(false);
    expect(params.has("limit")).toBe(false);
  });

  it("includes value_limit", () => {
    const params = buildLogsParams({
      project_name: "test",
      value_limit: 1000,
    });

    expect(params.get("value_limit")).toBe("1000");
  });

  it("includes from_fields and exclude_fields", () => {
    const params = buildLogsParams({
      project_name: "test",
      from_fields: "field1,field2",
      exclude_fields: "field3",
    });

    expect(params.get("from_fields")).toBe("field1,field2");
    expect(params.get("exclude_fields")).toBe("field3");
  });
});

describe("buildFieldsParams", () => {
  it("builds params with only project name", () => {
    const params = buildFieldsParams({ project_name: "test-project" });

    expect(params.get("project")).toBe("test-project");
  });

  it("includes context if provided", () => {
    const params = buildFieldsParams({
      project_name: "test",
      context: "production",
    });

    expect(params.get("context")).toBe("production");
  });

  it("includes column_context if provided", () => {
    const params = buildFieldsParams({
      project_name: "test",
      column_context: "metrics",
    });

    expect(params.get("column_context")).toBe("metrics");
  });

  it("only includes relevant params (not filter/pagination)", () => {
    const params = buildFieldsParams({
      project_name: "test",
      context: "prod",
      filter_expr: "should-not-appear",
      limit: 100,
    });

    expect(params.has("filter_expr")).toBe(false);
    expect(params.has("limit")).toBe(false);
    expect(params.get("context")).toBe("prod");
  });
});


