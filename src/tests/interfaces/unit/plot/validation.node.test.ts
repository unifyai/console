/**
 * Unit tests for plot validation module
 */

import { describe, it, expect } from "vitest";
import {
  validateLLMResponse,
  isConfigMinimallyValid,
  PlotConfigValidationError,
  getValidPlotTypes,
  getPlotTypeRequirements,
} from "@/lib/plot/validation";
import type { InferredPlotConfig } from "@/lib/plot/llm-config";

describe("validateLLMResponse", () => {
  const availableFields = [
    "latency_ms",
    "token_count",
    "model",
    "timestamp",
    "status",
  ];
  const fieldTypes: Record<string, string> = {
    latency_ms: "float",
    token_count: "int",
    model: "string",
    timestamp: "datetime",
    status: "string",
  };

  describe("scatter plot validation", () => {
    it("passes with valid x and y axes", () => {
      const config: InferredPlotConfig = {
        type: "scatter",
        x_axis: "latency_ms",
        y_axis: "token_count",
        confidence: 0.9,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.x_axis).toBe("latency_ms");
      expect(result.y_axis).toBe("token_count");
    });

    it("provides fallback for missing y_axis", () => {
      const config: InferredPlotConfig = {
        type: "scatter",
        x_axis: "latency_ms",
        // y_axis missing!
        confidence: 0.8,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      // Should have found a numeric fallback
      expect(result.y_axis).toBe("token_count"); // First available numeric field after latency_ms
      expect(result.reasoning).toContain("Validation notes");
    });

    it("throws when no suitable fallback exists", () => {
      const stringOnlyFields = ["model", "status", "name"];
      const stringOnlyTypes = { model: "string", status: "string", name: "string" };

      const config: InferredPlotConfig = {
        type: "scatter",
        x_axis: "nonexistent", // Doesn't exist in available fields
        confidence: 0.7,
      };

      expect(() =>
        validateLLMResponse(config, stringOnlyFields, stringOnlyTypes)
      ).toThrow(PlotConfigValidationError);
    });
  });

  describe("histogram validation", () => {
    it("passes with only x_axis (y not required)", () => {
      const config: InferredPlotConfig = {
        type: "histogram",
        x_axis: "latency_ms",
        y_axis: null, // Correctly null for histogram
        confidence: 0.95,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.type).toBe("histogram");
      expect(result.x_axis).toBe("latency_ms");
    });

    it("provides default bin_count when missing", () => {
      const config: InferredPlotConfig = {
        type: "histogram",
        x_axis: "latency_ms",
        // bin_count missing
        confidence: 0.9,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.bin_count).toBe(10); // Default
    });

    it("clamps bin_count to valid range (max)", () => {
      const config: InferredPlotConfig = {
        type: "histogram",
        x_axis: "latency_ms",
        bin_count: 500, // Too high!
        confidence: 0.9,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.bin_count).toBe(100); // Clamped to max
    });

    it("clamps bin_count to valid range (min)", () => {
      const config: InferredPlotConfig = {
        type: "histogram",
        x_axis: "latency_ms",
        bin_count: 0, // Too low!
        confidence: 0.9,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.bin_count).toBe(1); // Clamped to min
    });
  });

  describe("bar chart validation", () => {
    it("passes with categorical x and numeric y", () => {
      const config: InferredPlotConfig = {
        type: "bar",
        x_axis: "model",
        y_axis: "latency_ms",
        aggregate: "mean",
        confidence: 0.9,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.type).toBe("bar");
      expect(result.aggregate).toBe("mean");
    });

    it("defaults invalid aggregate to mean", () => {
      const config: InferredPlotConfig = {
        type: "bar",
        x_axis: "model",
        y_axis: "latency_ms",
        aggregate: "invalid_agg", // Invalid!
        confidence: 0.8,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.aggregate).toBe("mean");
    });
  });

  describe("field validation", () => {
    it("ignores invalid group_by field", () => {
      const config: InferredPlotConfig = {
        type: "scatter",
        x_axis: "latency_ms",
        y_axis: "token_count",
        group_by: "nonexistent_field", // Doesn't exist
        confidence: 0.85,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.group_by).toBeNull();
      expect(result.reasoning).toContain("not found");
    });

    it("corrects invalid scales to linear", () => {
      const config: InferredPlotConfig = {
        type: "scatter",
        x_axis: "latency_ms",
        y_axis: "token_count",
        scale_x: "exponential", // Invalid
        scale_y: "quadratic", // Invalid
        confidence: 0.9,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.scale_x).toBe("linear");
      expect(result.scale_y).toBe("linear");
    });

    it("accepts valid scales", () => {
      const config: InferredPlotConfig = {
        type: "scatter",
        x_axis: "latency_ms",
        y_axis: "token_count",
        scale_x: "log",
        scale_y: "linear",
        confidence: 0.9,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.scale_x).toBe("log");
      expect(result.scale_y).toBe("linear");
    });
  });

  describe("plot type validation", () => {
    it("throws for invalid plot type", () => {
      const config = {
        type: "pie", // Not supported!
        x_axis: "model",
        confidence: 0.9,
      } as InferredPlotConfig;

      expect(() =>
        validateLLMResponse(config, availableFields, fieldTypes)
      ).toThrow(PlotConfigValidationError);
    });

    it("throws for missing plot type", () => {
      const config = {
        x_axis: "latency_ms",
        y_axis: "token_count",
        confidence: 0.9,
      } as InferredPlotConfig;

      expect(() =>
        validateLLMResponse(config, availableFields, fieldTypes)
      ).toThrow(PlotConfigValidationError);
    });
  });

  describe("confidence validation", () => {
    it("defaults invalid confidence to 0.5", () => {
      const config: InferredPlotConfig = {
        type: "scatter",
        x_axis: "latency_ms",
        y_axis: "token_count",
        confidence: 1.5, // Invalid - over 1
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.confidence).toBe(0.5);
    });

    it("defaults negative confidence to 0.5", () => {
      const config: InferredPlotConfig = {
        type: "scatter",
        x_axis: "latency_ms",
        y_axis: "token_count",
        confidence: -0.5, // Invalid - negative
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.confidence).toBe(0.5);
    });

    it("preserves valid confidence", () => {
      const config: InferredPlotConfig = {
        type: "scatter",
        x_axis: "latency_ms",
        y_axis: "token_count",
        confidence: 0.85,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.confidence).toBe(0.85);
    });
  });

  describe("metric validation", () => {
    it("defaults invalid metric to mean", () => {
      const config: InferredPlotConfig = {
        type: "bar",
        x_axis: "model",
        y_axis: "latency_ms",
        metric: "invalid_metric",
        confidence: 0.9,
      };

      const result = validateLLMResponse(config, availableFields, fieldTypes);

      expect(result.metric).toBe("mean");
    });

    it("preserves valid metrics", () => {
      const validMetrics = ["mean", "sum", "count", "min", "max"];

      for (const metric of validMetrics) {
        const config: InferredPlotConfig = {
          type: "bar",
          x_axis: "model",
          y_axis: "latency_ms",
          metric,
          confidence: 0.9,
        };

        const result = validateLLMResponse(config, availableFields, fieldTypes);
        expect(result.metric).toBe(metric);
      }
    });
  });
});

describe("isConfigMinimallyValid", () => {
  it("returns true for valid scatter config", () => {
    expect(
      isConfigMinimallyValid({
        type: "scatter",
        x_axis: "x",
        y_axis: "y",
      })
    ).toBe(true);
  });

  it("returns false for scatter missing y_axis", () => {
    expect(
      isConfigMinimallyValid({
        type: "scatter",
        x_axis: "x",
        // y_axis missing
      })
    ).toBe(false);
  });

  it("returns true for histogram with only x_axis", () => {
    expect(
      isConfigMinimallyValid({
        type: "histogram",
        x_axis: "x",
      })
    ).toBe(true);
  });

  it("returns false for invalid type", () => {
    expect(
      isConfigMinimallyValid({
        type: "invalid",
        x_axis: "x",
      })
    ).toBe(false);
  });

  it("returns false for missing type", () => {
    expect(
      isConfigMinimallyValid({
        x_axis: "x",
        y_axis: "y",
      })
    ).toBe(false);
  });

  it("returns true for valid bar config", () => {
    expect(
      isConfigMinimallyValid({
        type: "bar",
        x_axis: "category",
        y_axis: "value",
      })
    ).toBe(true);
  });

  it("returns true for valid line config", () => {
    expect(
      isConfigMinimallyValid({
        type: "line",
        x_axis: "time",
        y_axis: "value",
      })
    ).toBe(true);
  });
});

describe("getValidPlotTypes", () => {
  it("returns all valid plot types", () => {
    const types = getValidPlotTypes();

    expect(types).toContain("scatter");
    expect(types).toContain("bar");
    expect(types).toContain("histogram");
    expect(types).toContain("line");
    expect(types.length).toBe(4);
  });
});

describe("getPlotTypeRequirements", () => {
  it("returns requirements for scatter plot", () => {
    const reqs = getPlotTypeRequirements("scatter");

    expect(reqs).not.toBeNull();
    expect(reqs?.required).toContain("x_axis");
    expect(reqs?.required).toContain("y_axis");
    expect(reqs?.numericRequired).toContain("x_axis");
    expect(reqs?.numericRequired).toContain("y_axis");
  });

  it("returns requirements for histogram", () => {
    const reqs = getPlotTypeRequirements("histogram");

    expect(reqs).not.toBeNull();
    expect(reqs?.required).toContain("x_axis");
    expect(reqs?.required).not.toContain("y_axis");
  });

  it("returns null for invalid plot type", () => {
    const reqs = getPlotTypeRequirements("invalid");

    expect(reqs).toBeNull();
  });
});


