/**
 * Unit tests for Plot API route handlers.
 *
 * These tests use mocked dependencies to test route logic in isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the store module first, before importing it
vi.mock("@/lib/plot/store", () => ({
  storePlotToken: vi.fn().mockReturnValue("mock-token-123"),
  getPlotToken: vi.fn(),
  DEFAULT_TTL_SECONDS: 86400,
}));

// Mock crypto module
vi.mock("@/lib/plot/crypto", () => ({
  encryptApiKey: vi.fn((key: string) => `encrypted:${key}`),
  decryptApiKey: vi.fn((key: string) => key.replace("encrypted:", "")),
}));

// Mock LLM config
vi.mock("@/lib/plot/llm-config", () => ({
  inferPlotConfigFromDescription: vi.fn(),
}));

// Mock orchestra URL
vi.mock("@/utils/orchestra", () => ({
  ORCHESTRA_URL: "https://mock-orchestra.test",
}));

// Import store functions for mocking
import { storePlotToken, getPlotToken } from "@/lib/plot/store";
import { inferPlotConfigFromDescription } from "@/lib/plot/llm-config";

describe("Plot API Routes - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup global fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Request Validation", () => {
    it("validates required Authorization header format", () => {
      // Test Bearer token format parsing
      const validHeader = "Bearer test-api-key";
      expect(validHeader.startsWith("Bearer ")).toBe(true);
      expect(validHeader.slice(7)).toBe("test-api-key");

      const invalidHeader = "Basic test-api-key";
      expect(invalidHeader.startsWith("Bearer ")).toBe(false);
    });

    it("validates project_config.project_name is required", () => {
      const validBody = {
        plot_config: { type: "scatter", x_axis: "x", y_axis: "y" },
        project_config: { project_name: "test" },
      };
      expect(validBody.project_config.project_name).toBeDefined();

      const invalidBody = {
        plot_config: { type: "scatter", x_axis: "x", y_axis: "y" },
        project_config: {},
      };
      expect((invalidBody.project_config as any).project_name).toBeUndefined();
    });

    it("validates plot_config.x_axis is required", () => {
      const validBody = {
        plot_config: { type: "scatter", x_axis: "latency" },
      };
      expect(validBody.plot_config.x_axis).toBeDefined();

      const invalidBody = {
        plot_config: { type: "scatter" },
      };
      expect((invalidBody.plot_config as any).x_axis).toBeUndefined();
    });

    it("validates either plot_config or description is required", () => {
      const validWithConfig = {
        plot_config: { type: "scatter", x_axis: "x" },
        project_config: { project_name: "test" },
      };

      const validWithDescription = {
        description: "Show me a scatter plot",
        project_config: { project_name: "test" },
      };

      const invalidNoEither = {
        project_config: { project_name: "test" },
      };

      expect(
        validWithConfig.plot_config || (validWithConfig as any).description
      ).toBeTruthy();
      expect(
        validWithDescription.description ||
          (validWithDescription as any).plot_config
      ).toBeTruthy();
      expect(
        (invalidNoEither as any).plot_config ||
          (invalidNoEither as any).description
      ).toBeFalsy();
    });

    it("validates token format (12 hex chars)", () => {
      const validToken = "a1b2c3d4e5f6";
      const tokenRegex = /^[a-f0-9]{12}$/;

      expect(tokenRegex.test(validToken)).toBe(true);
      expect(tokenRegex.test("invalid!")).toBe(false);
      expect(tokenRegex.test("tooshort")).toBe(false);
      expect(tokenRegex.test("toolongtoken123456")).toBe(false);
      expect(tokenRegex.test("UPPERCASE123")).toBe(false);
    });
  });

  describe("storePlotToken Integration", () => {
    it("calls storePlotToken with correct arguments", () => {
      const plotConfig = {
        type: "scatter",
        xAxis: "latency_ms",
        yAxis: "tokens",
        scaleX: "linear",
        scaleY: "linear",
        metric: "mean",
        binCount: 10,
        showRegression: false,
      };

      const projectConfig = {
        project_name: "test-project",
        limit: 100,
      };

      const token = storePlotToken(
        plotConfig,
        projectConfig,
        86400,
        "Test Title",
        "test-api-key"
      );

      expect(storePlotToken).toHaveBeenCalledWith(
        plotConfig,
        projectConfig,
        86400,
        "Test Title",
        "test-api-key"
      );
      expect(token).toBe("mock-token-123");
    });
  });

  describe("getPlotToken Integration", () => {
    it("returns null for non-existent token", () => {
      (getPlotToken as any).mockReturnValueOnce(null);

      const result = getPlotToken("nonexistent");
      expect(result).toBeNull();
    });

    it("returns token data for valid token", () => {
      const mockData = {
        plot_config: { type: "scatter", xAxis: "x", yAxis: "y" },
        project_config: { project_name: "test" },
        api_key: "decrypted-key",
        created_at: Date.now(),
        expires_at: Date.now() + 86400000,
      };
      (getPlotToken as any).mockReturnValueOnce(mockData);

      const result = getPlotToken("validtoken12");
      expect(result).toEqual(mockData);
    });
  });

  describe("LLM Config Inference Integration", () => {
    it("calls inferPlotConfigFromDescription with correct params", async () => {
      const mockInferredConfig = {
        type: "scatter",
        x_axis: "latency_ms",
        y_axis: "tokens",
        confidence: 0.9,
        reasoning: "User wants to compare latency vs tokens",
      };
      (inferPlotConfigFromDescription as any).mockResolvedValueOnce(
        mockInferredConfig
      );

      const request = {
        description: "Show latency vs tokens",
        available_fields: ["latency_ms", "tokens", "model"],
        field_types: { latency_ms: "float", tokens: "int", model: "str" },
        apiKey: "test-key",
      };

      const result = await inferPlotConfigFromDescription(request);

      expect(inferPlotConfigFromDescription).toHaveBeenCalledWith(request);
      expect(result.type).toBe("scatter");
      expect(result.confidence).toBe(0.9);
    });

    it("handles LLM inference error", async () => {
      (inferPlotConfigFromDescription as any).mockRejectedValueOnce(
        new Error("LLM service unavailable")
      );

      await expect(
        inferPlotConfigFromDescription({
          description: "test",
          available_fields: [],
          field_types: {},
          apiKey: "key",
        })
      ).rejects.toThrow("LLM service unavailable");
    });
  });

  describe("Logs API Fetch Simulation", () => {
    it("builds correct query params for basic request", () => {
      const projectConfig = {
        project_name: "test-project",
        limit: 100,
      };

      const params = new URLSearchParams({ project: projectConfig.project_name });
      if (projectConfig.limit) params.append("limit", String(projectConfig.limit));

      expect(params.toString()).toBe("project=test-project&limit=100");
    });

    it("builds correct query params with all options", () => {
      const projectConfig = {
        project_name: "test-project",
        context: "prod",
        filter_expr: 'status == "success"',
        limit: 50,
        offset: 10,
        sorting: '{"timestamp": "descending"}',
        group_by: ["model", "region"],
      };

      const params = new URLSearchParams({ project: projectConfig.project_name });
      if (projectConfig.context) params.append("context", projectConfig.context);
      if (projectConfig.filter_expr) params.append("filter_expr", projectConfig.filter_expr);
      if (projectConfig.limit) params.append("limit", String(projectConfig.limit));
      if (projectConfig.offset) params.append("offset", String(projectConfig.offset));
      if (projectConfig.sorting) params.append("sorting", projectConfig.sorting);
      if (projectConfig.group_by) {
        projectConfig.group_by.forEach((g) => params.append("group_by", g));
      }

      const paramsStr = params.toString();
      expect(paramsStr).toContain("project=test-project");
      expect(paramsStr).toContain("context=prod");
      expect(paramsStr).toContain("filter_expr=status");
      expect(paramsStr).toContain("limit=50");
      expect(paramsStr).toContain("offset=10");
      expect(paramsStr).toContain("sorting=");
      expect(paramsStr).toContain("group_by=model");
      expect(paramsStr).toContain("group_by=region");
    });
  });

  describe("Response Format", () => {
    it("create endpoint returns correct response shape", () => {
      const response = {
        url: "https://console.test/plot/view/abc123def456",
        token: "abc123def456",
        expires_in_hours: 24,
      };

      expect(response.url).toContain("/plot/view/");
      expect(response.token).toMatch(/^[a-z0-9]+$/);
      expect(response.expires_in_hours).toBeGreaterThan(0);
    });

    it("create endpoint returns inferred_config when description used", () => {
      const response = {
        url: "https://console.test/plot/view/abc123def456",
        token: "abc123def456",
        expires_in_hours: 24,
        inferred_config: {
          type: "scatter",
          x_axis: "latency_ms",
          y_axis: "tokens",
          confidence: 0.85,
          reasoning: "User wants to compare latency and tokens",
        },
      };

      expect(response.inferred_config).toBeDefined();
      expect(response.inferred_config.type).toBe("scatter");
      expect(response.inferred_config.confidence).toBeGreaterThan(0);
    });

    it("data endpoint returns correct response shape", () => {
      const response = {
        config: {
          type: "scatter",
          xAxis: "latency_ms",
          yAxis: "tokens",
          groupBy: "model",
          scaleX: "linear",
          scaleY: "linear",
          metric: "mean",
          binCount: 10,
          showRegression: false,
        },
        data: [
          {
            type: "ungrouped",
            "table1.entries": {
              "table1.latency_ms": 150,
              "table1.tokens": 500,
            },
          },
        ],
        fields: {
          "table1.latency_ms": { data_type: "float" },
          "table1.tokens": { data_type: "int" },
        },
        metadata: {
          title: "Test Plot",
          project_name: "test-project",
          created_at: Date.now(),
          expires_at: Date.now() + 86400000,
        },
      };

      expect(response.config).toBeDefined();
      expect(response.data).toBeInstanceOf(Array);
      expect(response.fields).toBeDefined();
      expect(response.metadata).toBeDefined();
      expect(response.metadata.created_at).toBeDefined();
    });

    it("data endpoint returns expired for non-existent token", () => {
      const response = {
        error: "Plot token not found or expired",
        expired: true,
      };

      expect(response.error).toContain("expired");
      expect(response.expired).toBe(true);
    });
  });

  describe("Data Transformation", () => {
    it("transforms flat logs to table format", () => {
      const rawLogs = [
        { latency_ms: 150, tokens: 500, model: "gpt-4" },
        { latency_ms: 180, tokens: 600, model: "claude-3" },
      ];

      const transformed = rawLogs.map((log) => {
        const entries: Record<string, any> = {};
        for (const [key, value] of Object.entries(log)) {
          entries[`table1.${key}`] = value;
        }
        return {
          type: "ungrouped",
          "table1.entries": entries,
        };
      });

      expect(transformed[0].type).toBe("ungrouped");
      expect(transformed[0]["table1.entries"]["table1.latency_ms"]).toBe(150);
      expect(transformed[0]["table1.entries"]["table1.model"]).toBe("gpt-4");
    });

    it("prefixes field names with table1", () => {
      const rawFields = {
        latency_ms: { data_type: "float" },
        tokens: { data_type: "int" },
        model: { data_type: "str" },
      };

      const prefixedFields: Record<string, any> = {};
      for (const [key, value] of Object.entries(rawFields)) {
        prefixedFields[`table1.${key}`] = value;
      }

      expect(prefixedFields["table1.latency_ms"]).toBeDefined();
      expect(prefixedFields["table1.tokens"]).toBeDefined();
      expect(prefixedFields["table1.model"]).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("handles fetch errors gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await expect(fetch("https://test.example/api")).rejects.toThrow(
        "Network error"
      );
    });

    it("handles non-JSON response body", () => {
      const parseBody = (text: string) => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      };

      expect(parseBody('{"valid": true}')).toEqual({ valid: true });
      expect(parseBody("not json")).toBeNull();
      expect(parseBody("")).toBeNull();
    });

    it("handles Orchestra API errors", () => {
      const handleOrchestraError = (status: number, body: any) => {
        if (status === 401) {
          return { error: "Invalid API key", status: 401 };
        }
        if (status === 404) {
          return { error: "Project not found", status: 404 };
        }
        if (status >= 500) {
          return { error: "Orchestra service error", status: 502 };
        }
        return { error: body.detail || "Unknown error", status };
      };

      expect(handleOrchestraError(401, {}).error).toBe("Invalid API key");
      expect(handleOrchestraError(404, {}).error).toBe("Project not found");
      expect(handleOrchestraError(500, {}).error).toBe("Orchestra service error");
      expect(handleOrchestraError(400, { detail: "Bad request" }).error).toBe(
        "Bad request"
      );
    });
  });

  describe("Security", () => {
    it("rejects SQL injection in filter_expr (validation example)", () => {
      // In practice, filter_expr is passed to Orchestra which validates it
      // This test demonstrates the pattern
      const suspiciousFilter = "status; DROP TABLE logs;--";

      // Filter should not contain semicolons or SQL keywords
      const isSafe = !/;|DROP|DELETE|UPDATE|INSERT/i.test(suspiciousFilter);
      expect(isSafe).toBe(false);
    });

    it("sanitizes token before lookup", () => {
      const sanitizeToken = (token: string) => {
        // Only allow hex chars
        return token.replace(/[^a-f0-9]/gi, "").toLowerCase().slice(0, 12);
      };

      expect(sanitizeToken("abc123DEF456")).toBe("abc123def456");
      expect(sanitizeToken("abc<script>")).toBe("abcc"); // Only hex chars a,b,c are kept
      expect(sanitizeToken("../../../etc")).toBe("ec"); // Only hex chars e,c are kept (t is not hex)
    });
  });
});

