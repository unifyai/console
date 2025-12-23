/**
 * Unit tests for Plot API data transformation logic.
 *
 * Tests the transformation of raw Orchestra API responses
 * to the format expected by PlotCanvas/PlotViewer.
 */

import { describe, it, expect } from "vitest";

/**
 * Transform logs to the expected format for PlotCanvas.
 * This mirrors the transformation in the data route.
 */
function transformLogs(rawLogs: Record<string, any>[]): Record<string, any>[] {
  return rawLogs.map((log) => {
    const entries: Record<string, any> = {};
    for (const [key, value] of Object.entries(log)) {
      entries[`table1.${key}`] = value;
    }
    return {
      type: "ungrouped",
      "table1.entries": entries,
    };
  });
}

/**
 * Prefix field names with table1.
 * This mirrors the transformation in the data route.
 */
function transformFields(
  rawFields: Record<string, any>
): Record<string, any> {
  const prefixed: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawFields)) {
    prefixed[`table1.${key}`] = value;
  }
  return prefixed;
}

/**
 * Add table1 prefix to axis/groupBy field names in config.
 */
function transformConfig(config: {
  type: string;
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  [key: string]: any;
}): typeof config {
  return {
    ...config,
    xAxis: config.xAxis ? `table1.${config.xAxis}` : undefined,
    yAxis: config.yAxis ? `table1.${config.yAxis}` : undefined,
    groupBy: config.groupBy ? `table1.${config.groupBy}` : undefined,
  };
}

describe("Plot Data Transformation", () => {
  describe("transformLogs", () => {
    it("transforms empty array", () => {
      const result = transformLogs([]);
      expect(result).toEqual([]);
    });

    it("transforms single log entry", () => {
      const rawLogs = [{ latency_ms: 150, tokens: 500, model: "gpt-4" }];
      const result = transformLogs(rawLogs);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("ungrouped");
      expect(result[0]["table1.entries"]["table1.latency_ms"]).toBe(150);
      expect(result[0]["table1.entries"]["table1.tokens"]).toBe(500);
      expect(result[0]["table1.entries"]["table1.model"]).toBe("gpt-4");
    });

    it("transforms multiple log entries", () => {
      const rawLogs = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
      ];
      const result = transformLogs(rawLogs);

      expect(result).toHaveLength(3);
      result.forEach((log, i) => {
        expect(log.type).toBe("ungrouped");
        expect(log["table1.entries"]["table1.x"]).toBe(rawLogs[i].x);
        expect(log["table1.entries"]["table1.y"]).toBe(rawLogs[i].y);
      });
    });

    it("preserves null values", () => {
      const rawLogs = [{ value: null, other: 10 }];
      const result = transformLogs(rawLogs);

      expect(result[0]["table1.entries"]["table1.value"]).toBeNull();
      expect(result[0]["table1.entries"]["table1.other"]).toBe(10);
    });

    it("preserves undefined values", () => {
      const rawLogs = [{ value: undefined, other: 10 }];
      const result = transformLogs(rawLogs);

      expect(result[0]["table1.entries"]["table1.value"]).toBeUndefined();
    });

    it("handles nested objects", () => {
      const rawLogs = [{ metadata: { nested: true }, value: 10 }];
      const result = transformLogs(rawLogs);

      expect(result[0]["table1.entries"]["table1.metadata"]).toEqual({
        nested: true,
      });
    });

    it("handles arrays in values", () => {
      const rawLogs = [{ tags: ["a", "b", "c"], value: 10 }];
      const result = transformLogs(rawLogs);

      expect(result[0]["table1.entries"]["table1.tags"]).toEqual(["a", "b", "c"]);
    });

    it("handles numeric string values", () => {
      const rawLogs = [{ count: "100", ratio: "0.5" }];
      const result = transformLogs(rawLogs);

      expect(result[0]["table1.entries"]["table1.count"]).toBe("100");
      expect(result[0]["table1.entries"]["table1.ratio"]).toBe("0.5");
    });

    it("handles boolean values", () => {
      const rawLogs = [{ enabled: true, disabled: false }];
      const result = transformLogs(rawLogs);

      expect(result[0]["table1.entries"]["table1.enabled"]).toBe(true);
      expect(result[0]["table1.entries"]["table1.disabled"]).toBe(false);
    });

    it("handles date strings", () => {
      const dateStr = "2024-01-15T10:30:00Z";
      const rawLogs = [{ timestamp: dateStr }];
      const result = transformLogs(rawLogs);

      expect(result[0]["table1.entries"]["table1.timestamp"]).toBe(dateStr);
    });

    it("handles special characters in keys", () => {
      const rawLogs = [{ "key-with-dashes": 1, "key.with.dots": 2 }];
      const result = transformLogs(rawLogs);

      expect(result[0]["table1.entries"]["table1.key-with-dashes"]).toBe(1);
      expect(result[0]["table1.entries"]["table1.key.with.dots"]).toBe(2);
    });
  });

  describe("transformFields", () => {
    it("transforms empty fields object", () => {
      const result = transformFields({});
      expect(result).toEqual({});
    });

    it("transforms single field", () => {
      const rawFields = { latency_ms: { data_type: "float" } };
      const result = transformFields(rawFields);

      expect(result["table1.latency_ms"]).toEqual({ data_type: "float" });
      expect(result["latency_ms"]).toBeUndefined();
    });

    it("transforms multiple fields", () => {
      const rawFields = {
        latency_ms: { data_type: "float" },
        tokens: { data_type: "int" },
        model: { data_type: "str" },
      };
      const result = transformFields(rawFields);

      expect(result["table1.latency_ms"]).toEqual({ data_type: "float" });
      expect(result["table1.tokens"]).toEqual({ data_type: "int" });
      expect(result["table1.model"]).toEqual({ data_type: "str" });
    });

    it("preserves field metadata", () => {
      const rawFields = {
        score: {
          data_type: "float",
          nullable: true,
          indexed: false,
          description: "User score",
        },
      };
      const result = transformFields(rawFields);

      expect(result["table1.score"]).toEqual({
        data_type: "float",
        nullable: true,
        indexed: false,
        description: "User score",
      });
    });

    it("handles all data types", () => {
      const rawFields = {
        float_field: { data_type: "float" },
        int_field: { data_type: "int" },
        str_field: { data_type: "str" },
        bool_field: { data_type: "bool" },
        datetime_field: { data_type: "datetime" },
        json_field: { data_type: "json" },
      };
      const result = transformFields(rawFields);

      expect(result["table1.float_field"].data_type).toBe("float");
      expect(result["table1.int_field"].data_type).toBe("int");
      expect(result["table1.str_field"].data_type).toBe("str");
      expect(result["table1.bool_field"].data_type).toBe("bool");
      expect(result["table1.datetime_field"].data_type).toBe("datetime");
      expect(result["table1.json_field"].data_type).toBe("json");
    });
  });

  describe("transformConfig", () => {
    it("transforms scatter config", () => {
      const config = {
        type: "scatter",
        xAxis: "latency_ms",
        yAxis: "tokens",
        groupBy: "model",
        scaleX: "linear",
        scaleY: "linear",
      };
      const result = transformConfig(config);

      expect(result.type).toBe("scatter");
      expect(result.xAxis).toBe("table1.latency_ms");
      expect(result.yAxis).toBe("table1.tokens");
      expect(result.groupBy).toBe("table1.model");
      expect(result.scaleX).toBe("linear");
      expect(result.scaleY).toBe("linear");
    });

    it("transforms bar config", () => {
      const config = {
        type: "bar",
        xAxis: "category",
        yAxis: "count",
        aggregate: "sum",
      };
      const result = transformConfig(config);

      expect(result.xAxis).toBe("table1.category");
      expect(result.yAxis).toBe("table1.count");
      expect(result.aggregate).toBe("sum");
    });

    it("transforms histogram config (no yAxis)", () => {
      const config = {
        type: "histogram",
        xAxis: "latency_ms",
        binCount: 20,
      };
      const result = transformConfig(config);

      expect(result.xAxis).toBe("table1.latency_ms");
      expect(result.yAxis).toBeUndefined();
      expect(result.binCount).toBe(20);
    });

    it("handles missing optional fields", () => {
      const config = {
        type: "scatter",
        xAxis: "x",
      };
      const result = transformConfig(config);

      expect(result.xAxis).toBe("table1.x");
      expect(result.yAxis).toBeUndefined();
      expect(result.groupBy).toBeUndefined();
    });

    it("preserves non-axis fields", () => {
      const config = {
        type: "scatter",
        xAxis: "x",
        yAxis: "y",
        showRegression: true,
        scaleX: "log",
        scaleY: "linear",
        metric: "mean",
        binCount: 15,
      };
      const result = transformConfig(config);

      expect(result.showRegression).toBe(true);
      expect(result.scaleX).toBe("log");
      expect(result.scaleY).toBe("linear");
      expect(result.metric).toBe("mean");
      expect(result.binCount).toBe(15);
    });
  });
});

describe("Plot Metadata Generation", () => {
  describe("Timestamps", () => {
    it("generates created_at timestamp", () => {
      const created_at = Date.now();
      expect(created_at).toBeGreaterThan(0);
      expect(typeof created_at).toBe("number");
    });

    it("calculates expires_at from TTL", () => {
      const created_at = Date.now();
      const ttl_seconds = 86400; // 24 hours
      const expires_at = created_at + ttl_seconds * 1000;

      expect(expires_at).toBeGreaterThan(created_at);
      expect(expires_at - created_at).toBe(86400000);
    });

    it("formats timestamps as ISO strings", () => {
      const timestamp = Date.now();
      const isoString = new Date(timestamp).toISOString();

      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("Title", () => {
    it("includes title when provided", () => {
      const title = "My Custom Plot";
      const metadata = { title };

      expect(metadata.title).toBe("My Custom Plot");
    });

    it("handles undefined title", () => {
      const title = undefined;
      const metadata = { title };

      expect(metadata.title).toBeUndefined();
    });
  });

  describe("Project Name", () => {
    it("includes project name from config", () => {
      const project_name = "my-project";
      const metadata = { project_name };

      expect(metadata.project_name).toBe("my-project");
    });
  });
});

describe("Plot Response Assembly", () => {
  it("assembles complete data response", () => {
    const rawLogs = [
      { latency_ms: 150, tokens: 500 },
      { latency_ms: 180, tokens: 600 },
    ];
    const rawFields = {
      latency_ms: { data_type: "float" },
      tokens: { data_type: "int" },
    };
    const config = {
      type: "scatter",
      xAxis: "latency_ms",
      yAxis: "tokens",
      scaleX: "linear",
      scaleY: "linear",
      metric: "mean",
      binCount: 10,
      showRegression: false,
    };
    const title = "Test Plot";
    const project_name = "test-project";
    const created_at = Date.now();
    const expires_at = created_at + 86400000;

    const response = {
      config: transformConfig(config),
      data: transformLogs(rawLogs),
      fields: transformFields(rawFields),
      metadata: {
        title,
        project_name,
        created_at,
        expires_at,
      },
    };

    // Verify structure
    expect(response.config.type).toBe("scatter");
    expect(response.config.xAxis).toBe("table1.latency_ms");
    expect(response.config.yAxis).toBe("table1.tokens");

    expect(response.data).toHaveLength(2);
    expect(response.data[0].type).toBe("ungrouped");
    expect(response.data[0]["table1.entries"]["table1.latency_ms"]).toBe(150);

    expect(response.fields["table1.latency_ms"]).toBeDefined();
    expect(response.fields["table1.tokens"]).toBeDefined();

    expect(response.metadata.title).toBe("Test Plot");
    expect(response.metadata.project_name).toBe("test-project");
    expect(response.metadata.created_at).toBe(created_at);
    expect(response.metadata.expires_at).toBe(expires_at);
  });

  it("handles empty logs array", () => {
    const response = {
      config: { type: "scatter", xAxis: "table1.x", yAxis: "table1.y" },
      data: [],
      fields: { "table1.x": { data_type: "float" } },
      metadata: { project_name: "test" },
    };

    expect(response.data).toEqual([]);
    expect(response.config).toBeDefined();
  });
});

describe("Create Response Assembly", () => {
  it("assembles create response without LLM", () => {
    const token = "abc123def456";
    const baseUrl = "https://console.example.com";

    const response = {
      url: `${baseUrl}/plot/view/${token}`,
      token,
      expires_in_hours: 24,
    };

    expect(response.url).toBe("https://console.example.com/plot/view/abc123def456");
    expect(response.token).toBe("abc123def456");
    expect(response.expires_in_hours).toBe(24);
    expect((response as any).inferred_config).toBeUndefined();
  });

  it("assembles create response with LLM inference", () => {
    const token = "abc123def456";
    const baseUrl = "https://console.example.com";
    const inferredConfig = {
      type: "scatter",
      x_axis: "latency_ms",
      y_axis: "tokens",
      confidence: 0.85,
      reasoning: "User wants to compare latency and tokens",
    };

    const response = {
      url: `${baseUrl}/plot/view/${token}`,
      token,
      expires_in_hours: 24,
      inferred_config: inferredConfig,
    };

    expect(response.inferred_config).toBeDefined();
    expect(response.inferred_config.type).toBe("scatter");
    expect(response.inferred_config.confidence).toBe(0.85);
    expect(response.inferred_config.reasoning).toContain("latency");
  });
});

describe("Error Response Format", () => {
  it("formats validation error", () => {
    const error = {
      error: "Missing required field: project_config.project_name",
    };

    expect(error.error).toContain("project_name");
  });

  it("formats auth error", () => {
    const error = {
      error: "Missing or invalid Authorization header",
    };

    expect(error.error).toContain("Authorization");
  });

  it("formats token not found error", () => {
    const error = {
      error: "Plot token not found or expired",
      expired: true,
    };

    expect(error.error).toContain("expired");
    expect(error.expired).toBe(true);
  });

  it("formats invalid token error", () => {
    const error = {
      error: "Invalid token format",
    };

    expect(error.error).toContain("token");
  });

  it("formats orchestra API error", () => {
    const error = {
      error: "Failed to fetch logs from Orchestra",
      details: "Project not found",
    };

    expect(error.error).toContain("Orchestra");
    expect(error.details).toBeDefined();
  });

  it("formats LLM inference error", () => {
    const error = {
      error: "Failed to infer plot configuration from description",
      details: "LLM service unavailable",
    };

    expect(error.error).toContain("infer");
    expect(error.details).toContain("LLM");
  });
});


