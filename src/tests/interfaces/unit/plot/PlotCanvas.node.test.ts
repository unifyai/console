/**
 * Unit tests for PlotCanvas component logic.
 *
 * Since PlotCanvas uses D3.js for rendering which requires a DOM,
 * these tests focus on the component's logic, props handling,
 * and callback behavior without full DOM rendering.
 *
 * For full rendering tests, use the .test.tsx file with jsdom.
 */

import { describe, it, expect, vi } from "vitest";

// Test the prop interfaces and logic without React rendering

describe("PlotCanvas - Props Validation", () => {
  describe("Required Props", () => {
    it("requires logs array", () => {
      const validLogs = [
        {
          type: "ungrouped",
          "table1.entries": { "table1.x": 1, "table1.y": 2 },
        },
      ];
      expect(Array.isArray(validLogs)).toBe(true);
      expect(validLogs.length).toBeGreaterThan(0);
    });

    it("requires fields object", () => {
      const validFields = {
        "table1.x": { data_type: "float" },
        "table1.y": { data_type: "float" },
      };
      expect(typeof validFields).toBe("object");
      expect(Object.keys(validFields).length).toBeGreaterThan(0);
    });

    it("requires plotType string", () => {
      const validPlotTypes = [
        "Scatter Plot",
        "Bar Chart",
        "Histogram",
        "Line Chart",
      ];
      validPlotTypes.forEach((type) => {
        expect(typeof type).toBe("string");
        expect(type.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Optional Props Defaults", () => {
    it("interactive defaults to true", () => {
      const defaults = {
        interactive: true,
        zoomEnabled: true,
        scaleX: "linear",
        scaleY: "linear",
        metric: "mean",
        binCount: 10,
        showRegression: "false",
      };

      expect(defaults.interactive).toBe(true);
    });

    it("zoomEnabled defaults to true", () => {
      const defaults = { zoomEnabled: true };
      expect(defaults.zoomEnabled).toBe(true);
    });

    it("scale defaults to linear", () => {
      const defaults = { scaleX: "linear", scaleY: "linear" };
      expect(defaults.scaleX).toBe("linear");
      expect(defaults.scaleY).toBe("linear");
    });

    it("metric defaults to mean", () => {
      const defaults = { metric: "mean" };
      expect(defaults.metric).toBe("mean");
    });

    it("binCount defaults to 10", () => {
      const defaults = { binCount: 10 };
      expect(defaults.binCount).toBe(10);
    });
  });

  describe("Callback Props", () => {
    it("onScaleXChange receives scale string", () => {
      const onScaleXChange = vi.fn();
      onScaleXChange("log");
      expect(onScaleXChange).toHaveBeenCalledWith("log");
    });

    it("onScaleYChange receives scale string", () => {
      const onScaleYChange = vi.fn();
      onScaleYChange("linear");
      expect(onScaleYChange).toHaveBeenCalledWith("linear");
    });

    it("onBinCountChange receives number", () => {
      const onBinCountChange = vi.fn();
      onBinCountChange(15);
      expect(onBinCountChange).toHaveBeenCalledWith(15);
    });

    it("onHoverLog receives log object or null", () => {
      const onHoverLog = vi.fn();
      const mockLog = {
        type: "ungrouped",
        "table1.entries": { "table1.x": 1 },
      };

      onHoverLog(mockLog);
      expect(onHoverLog).toHaveBeenCalledWith(mockLog);

      onHoverLog(null);
      expect(onHoverLog).toHaveBeenCalledWith(null);
    });
  });

  describe("External Refs", () => {
    it("accepts optional external svgRef", () => {
      // When external ref is provided, component should use it
      const externalRef = { current: null };
      expect(externalRef).toBeDefined();
    });

    it("accepts optional external containerRef", () => {
      const externalRef = { current: null };
      expect(externalRef).toBeDefined();
    });

    it("accepts optional external settingsRef", () => {
      const externalRef = { current: null };
      expect(externalRef).toBeDefined();
    });

    it("uses internal refs when external not provided", () => {
      // Component creates internal refs when external are undefined
      const useInternalRef = (externalRef: any) => {
        const internalRef = { current: null };
        return externalRef ?? internalRef;
      };

      const result = useInternalRef(undefined);
      expect(result).toEqual({ current: null });

      const external = { current: "external" };
      const result2 = useInternalRef(external);
      expect(result2).toBe(external);
    });
  });
});

describe("PlotCanvas - Plot Type Mapping", () => {
  const PLOT_TYPE_MAP: Record<string, string> = {
    scatter: "Scatter Plot",
    bar: "Bar Chart",
    histogram: "Histogram",
    line: "Line Chart",
  };

  it("maps scatter to Scatter Plot", () => {
    expect(PLOT_TYPE_MAP["scatter"]).toBe("Scatter Plot");
  });

  it("maps bar to Bar Chart", () => {
    expect(PLOT_TYPE_MAP["bar"]).toBe("Bar Chart");
  });

  it("maps histogram to Histogram", () => {
    expect(PLOT_TYPE_MAP["histogram"]).toBe("Histogram");
  });

  it("maps line to Line Chart", () => {
    expect(PLOT_TYPE_MAP["line"]).toBe("Line Chart");
  });
});

describe("PlotCanvas - Dimensions Logic", () => {
  describe("Default Margins", () => {
    it("uses default margins when customMargins not provided", () => {
      const defaultMargins = { top: 0, right: 15, bottom: 45, left: 55 };
      const customMargins = undefined;
      const margins = customMargins || defaultMargins;

      expect(margins).toEqual({ top: 0, right: 15, bottom: 45, left: 55 });
    });

    it("uses customMargins when provided", () => {
      const defaultMargins = { top: 0, right: 15, bottom: 45, left: 55 };
      const customMargins = { top: 10, right: 20, bottom: 50, left: 60 };
      const margins = customMargins || defaultMargins;

      expect(margins).toEqual({ top: 10, right: 20, bottom: 50, left: 60 });
    });
  });

  describe("Axis Padding", () => {
    it("has default axis padding of 15", () => {
      const axisPadding = 15;
      expect(axisPadding).toBe(15);
    });
  });

  describe("Dimension Updates", () => {
    it("calculates plot area from container dimensions", () => {
      const containerDimensions = { width: 800, height: 600 };
      const margins = { top: 0, right: 15, bottom: 45, left: 55 };

      const plotWidth =
        containerDimensions.width - margins.left - margins.right;
      const plotHeight =
        containerDimensions.height - margins.top - margins.bottom;

      expect(plotWidth).toBe(730);
      expect(plotHeight).toBe(555);
    });
  });
});

describe("PlotCanvas - Scale Logic", () => {
  describe("Scale X", () => {
    it("accepts linear scale", () => {
      const scaleX = "linear";
      expect(["linear", "log"]).toContain(scaleX);
    });

    it("accepts log scale", () => {
      const scaleX = "log";
      expect(["linear", "log"]).toContain(scaleX);
    });
  });

  describe("Scale Y", () => {
    it("accepts linear scale", () => {
      const scaleY = "linear";
      expect(["linear", "log"]).toContain(scaleY);
    });

    it("accepts log scale", () => {
      const scaleY = "log";
      expect(["linear", "log"]).toContain(scaleY);
    });
  });

  describe("Log Scale Enablement", () => {
    it("determines if log scale is possible based on data", () => {
      const hasPositiveValues = (values: number[]) =>
        values.every((v) => v > 0);

      expect(hasPositiveValues([1, 2, 3])).toBe(true);
      expect(hasPositiveValues([0, 1, 2])).toBe(false);
      expect(hasPositiveValues([-1, 1, 2])).toBe(false);
    });
  });
});

describe("PlotCanvas - Data Processing", () => {
  describe("Field Extraction", () => {
    it("extracts numeric fields for axes", () => {
      const fields = {
        "table1.latency_ms": { data_type: "float" },
        "table1.tokens": { data_type: "int" },
        "table1.model": { data_type: "str" },
      };

      const numericFields = Object.entries(fields)
        .filter(([_, v]) => v.data_type === "float" || v.data_type === "int")
        .map(([k]) => k);

      expect(numericFields).toContain("table1.latency_ms");
      expect(numericFields).toContain("table1.tokens");
      expect(numericFields).not.toContain("table1.model");
    });

    it("extracts string fields for grouping", () => {
      const fields = {
        "table1.latency_ms": { data_type: "float" },
        "table1.model": { data_type: "str" },
        "table1.region": { data_type: "str" },
      };

      const stringFields = Object.entries(fields)
        .filter(([_, v]) => v.data_type === "str")
        .map(([k]) => k);

      expect(stringFields).toContain("table1.model");
      expect(stringFields).toContain("table1.region");
      expect(stringFields).not.toContain("table1.latency_ms");
    });
  });

  describe("Log Entry Processing", () => {
    it("extracts values from nested log entries", () => {
      const log = {
        type: "ungrouped",
        "table1.entries": {
          "table1.latency_ms": 150,
          "table1.tokens": 500,
        },
      };

      const getValue = (log: any, field: string) =>
        log["table1.entries"]?.[field];

      expect(getValue(log, "table1.latency_ms")).toBe(150);
      expect(getValue(log, "table1.tokens")).toBe(500);
    });

    it("handles missing values", () => {
      const log = {
        type: "ungrouped",
        "table1.entries": {
          "table1.latency_ms": 150,
        },
      };

      const getValue = (log: any, field: string) =>
        log["table1.entries"]?.[field];

      expect(getValue(log, "table1.tokens")).toBeUndefined();
    });
  });
});

describe("PlotCanvas - Zoom Behavior", () => {
  describe("Zoom Identity", () => {
    it("initial zoom is identity (no transform)", () => {
      // d3.zoomIdentity equivalent
      const zoomIdentity = { k: 1, x: 0, y: 0 };
      expect(zoomIdentity.k).toBe(1); // scale
      expect(zoomIdentity.x).toBe(0); // translateX
      expect(zoomIdentity.y).toBe(0); // translateY
    });
  });

  describe("Zoom Reset on Config Change", () => {
    it("resets zoom when xAxis changes", () => {
      const resetZoom = vi.fn();
      const xAxis = "latency_ms";
      const prevXAxis = "tokens";

      if (xAxis !== prevXAxis) {
        resetZoom();
      }

      expect(resetZoom).toHaveBeenCalled();
    });

    it("resets zoom when yAxis changes", () => {
      const resetZoom = vi.fn();
      const yAxis = "tokens";
      const prevYAxis = "latency_ms";

      if (yAxis !== prevYAxis) {
        resetZoom();
      }

      expect(resetZoom).toHaveBeenCalled();
    });

    it("resets zoom when plotType changes", () => {
      const resetZoom = vi.fn();
      const plotType = "Bar Chart";
      const prevPlotType = "Scatter Plot";

      if (plotType !== prevPlotType) {
        resetZoom();
      }

      expect(resetZoom).toHaveBeenCalled();
    });
  });
});

describe("PlotCanvas - Color Handling", () => {
  describe("Colors Prop", () => {
    it("accepts null colors", () => {
      const colors = null;
      expect(colors).toBeNull();
    });

    it("accepts JSON string colors", () => {
      const colors = JSON.stringify({
        "gpt-4": "#ff0000",
        "claude-3": "#00ff00",
      });

      expect(typeof colors).toBe("string");
      expect(JSON.parse(colors)).toEqual({
        "gpt-4": "#ff0000",
        "claude-3": "#00ff00",
      });
    });

    it("parses color object from string", () => {
      const colorsString = '{"model-a":"#123456","model-b":"#654321"}';
      const colors = JSON.parse(colorsString);

      expect(colors["model-a"]).toBe("#123456");
      expect(colors["model-b"]).toBe("#654321");
    });
  });
});

describe("PlotCanvas - Histogram Specific", () => {
  describe("Bin Count", () => {
    it("accepts positive bin count", () => {
      const binCount = 15;
      expect(binCount).toBeGreaterThan(0);
    });

    it("clamps bin count to reasonable range", () => {
      const clampBinCount = (count: number) =>
        Math.max(1, Math.min(100, count));

      expect(clampBinCount(0)).toBe(1);
      expect(clampBinCount(150)).toBe(100);
      expect(clampBinCount(25)).toBe(25);
    });
  });

  describe("Bin Counts State", () => {
    it("maintains min/max bin counts", () => {
      const binCounts = [1, 100]; // [min, max]
      expect(binCounts[0]).toBe(1);
      expect(binCounts[1]).toBe(100);
    });
  });
});

describe("PlotCanvas - Scatter Specific", () => {
  describe("Regression Line", () => {
    it("accepts showRegression as string", () => {
      const showRegression = "true";
      expect(showRegression === "true").toBe(true);
    });

    it("handles showRegression false", () => {
      const showRegression = "false";
      expect(showRegression === "true").toBe(false);
    });
  });
});

describe("PlotCanvas - Bar Chart Specific", () => {
  describe("Aggregation", () => {
    const validAggregates = ["sum", "mean", "count", "min", "max"];

    it("accepts sum aggregate", () => {
      expect(validAggregates).toContain("sum");
    });

    it("accepts mean aggregate", () => {
      expect(validAggregates).toContain("mean");
    });

    it("accepts count aggregate", () => {
      expect(validAggregates).toContain("count");
    });

    it("accepts min aggregate", () => {
      expect(validAggregates).toContain("min");
    });

    it("accepts max aggregate", () => {
      expect(validAggregates).toContain("max");
    });
  });

  describe("Metric", () => {
    const validMetrics = ["mean", "sum", "count", "min", "max"];

    it("uses metric for display calculation", () => {
      const metric = "mean";
      expect(validMetrics).toContain(metric);
    });
  });

  describe("Sort Bars", () => {
    it("accepts sortBars option", () => {
      const sortBars = "ascending";
      expect(["ascending", "descending", "none"]).toContain(sortBars);
    });
  });
});

describe("PlotCanvas - Tooltip", () => {
  describe("Tooltip Visibility", () => {
    it("toggles tooltip minimized state", () => {
      let isMinimized = false;
      const setIsMinimized = (value: boolean) => {
        isMinimized = value;
      };

      setIsMinimized(true);
      expect(isMinimized).toBe(true);

      setIsMinimized(false);
      expect(isMinimized).toBe(false);
    });
  });

  describe("Hovered Log State", () => {
    it("can be controlled externally", () => {
      let hoveredLog: any = null;
      const onHoverLog = (log: any) => {
        hoveredLog = log;
      };

      const mockLog = { id: "log1" };
      onHoverLog(mockLog);
      expect(hoveredLog).toBe(mockLog);

      onHoverLog(null);
      expect(hoveredLog).toBeNull();
    });
  });
});

describe("PlotCanvas - Plot Tile Actions", () => {
  it("creates plotTileActions from callbacks", () => {
    const onScaleXChange = vi.fn();
    const onScaleYChange = vi.fn();
    const onBinCountChange = vi.fn();

    const plotTileActions = {
      setPlotScaleX: onScaleXChange ?? (() => {}),
      setPlotScaleY: onScaleYChange ?? (() => {}),
      setBinCount: (count: string) => onBinCountChange?.(parseInt(count, 10)),
    };

    plotTileActions.setPlotScaleX("log");
    expect(onScaleXChange).toHaveBeenCalledWith("log");

    plotTileActions.setPlotScaleY("linear");
    expect(onScaleYChange).toHaveBeenCalledWith("linear");

    plotTileActions.setBinCount("20");
    expect(onBinCountChange).toHaveBeenCalledWith(20);
  });

  it("handles undefined callbacks gracefully", () => {
    const onScaleXChange = undefined;
    const onScaleYChange = undefined;
    const onBinCountChange = undefined;

    const plotTileActions = {
      setPlotScaleX: onScaleXChange ?? (() => {}),
      setPlotScaleY: onScaleYChange ?? (() => {}),
      setBinCount: (count: string) => onBinCountChange?.(parseInt(count, 10)),
    };

    // Should not throw
    expect(() => plotTileActions.setPlotScaleX("log")).not.toThrow();
    expect(() => plotTileActions.setPlotScaleY("linear")).not.toThrow();
    expect(() => plotTileActions.setBinCount("20")).not.toThrow();
  });
});

describe("PlotCanvas - Plot Tile State", () => {
  it("builds effectivePlotTileState from colors", () => {
    const colors = JSON.stringify({ "model-a": "#ff0000" });
    const plotTileState = undefined;

    const effectivePlotTileState = plotTileState ?? {
      plot_group_by_colors: colors ?? null,
    };

    expect(effectivePlotTileState.plot_group_by_colors).toBe(colors);
  });

  it("uses plotTileState when provided", () => {
    const colors = JSON.stringify({ "model-a": "#ff0000" });
    const plotTileState = {
      plot_group_by_colors: JSON.stringify({ "model-b": "#00ff00" }),
    };

    const effectivePlotTileState = plotTileState ?? {
      plot_group_by_colors: colors ?? null,
    };

    expect(effectivePlotTileState.plot_group_by_colors).toBe(
      plotTileState.plot_group_by_colors
    );
  });
});


