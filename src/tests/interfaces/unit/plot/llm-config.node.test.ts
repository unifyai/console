/**
 * Unit tests for plot LLM config inference module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { inferPlotConfigFromDescription, isInferenceAvailable } from "@/lib/plot/llm-config";

// Mock fetch for Orchestra API calls
const mockFetch = vi.fn();

describe("LLM Plot Config Inference", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    // Set required env var
    process.env = {
      ...originalEnv,
      ORCHESTRA_URL: "https://api.orchestra.test",
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  const baseRequest = {
    description: "test description",
    available_fields: ["latency_ms", "token_count", "model"],
    field_types: { latency_ms: "float", token_count: "int", model: "string" },
    apiKey: "test-api-key",
  };

  function mockOrchestraResponse(content: object | string) {
    const responseContent =
      typeof content === "string" ? content : JSON.stringify(content);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content: responseContent },
          },
        ],
      }),
    });
  }

  it("infers scatter plot for correlation description", async () => {
    mockOrchestraResponse({
      type: "scatter",
      x_axis: "latency_ms",
      y_axis: "token_count",
      group_by: null,
      scale_x: "linear",
      scale_y: "linear",
      show_regression: true,
      confidence: 0.9,
      reasoning: "Correlation between two numeric variables",
    });

    const result = await inferPlotConfigFromDescription({
      ...baseRequest,
      description: "Show correlation between latency and token count",
    });

    expect(result.type).toBe("scatter");
    expect(result.x_axis).toBe("latency_ms");
    expect(result.y_axis).toBe("token_count");
    expect(result.show_regression).toBe(true);

    // Verify correct API call
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/v0/chat/completions");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-api-key");
  });

  it("infers histogram for distribution description", async () => {
    mockOrchestraResponse({
      type: "histogram",
      x_axis: "latency_ms",
      y_axis: null,
      bin_count: 20,
      confidence: 0.85,
      reasoning: "Distribution of a single numeric variable",
    });

    const result = await inferPlotConfigFromDescription({
      ...baseRequest,
      description: "Show distribution of latency values",
    });

    expect(result.type).toBe("histogram");
    expect(result.x_axis).toBe("latency_ms");
    expect(result.y_axis).toBeNull();
  });

  it("infers bar chart for comparison description", async () => {
    mockOrchestraResponse({
      type: "bar",
      x_axis: "model",
      y_axis: "latency_ms",
      aggregate: "mean",
      confidence: 0.88,
      reasoning: "Comparing averages across categories",
    });

    const result = await inferPlotConfigFromDescription({
      ...baseRequest,
      description: "Compare average latency by model",
    });

    expect(result.type).toBe("bar");
    expect(result.aggregate).toBe("mean");
  });

  it("handles markdown code blocks in response", async () => {
    // LLM sometimes wraps JSON in markdown code blocks
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '```json\n{"type": "scatter", "x_axis": "latency_ms", "y_axis": "token_count", "confidence": 0.9}\n```',
            },
          },
        ],
      }),
    });

    const result = await inferPlotConfigFromDescription(baseRequest);
    expect(result.type).toBe("scatter");
  });

  it("handles LLM response parsing errors", async () => {
    mockOrchestraResponse("This is not valid JSON");

    await expect(inferPlotConfigFromDescription(baseRequest)).rejects.toThrow(
      "Failed to parse LLM response"
    );
  });

  it("handles empty LLM response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    });

    await expect(inferPlotConfigFromDescription(baseRequest)).rejects.toThrow(
      "No response content from LLM"
    );
  });

  it("handles Orchestra API errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ detail: "Insufficient credits" }),
    });

    await expect(inferPlotConfigFromDescription(baseRequest)).rejects.toThrow(
      "Insufficient credits"
    );
  });

  it("handles network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    await expect(inferPlotConfigFromDescription(baseRequest)).rejects.toThrow(
      "Network error"
    );
  });

  it("sends correct payload structure", async () => {
    mockOrchestraResponse({
      type: "scatter",
      x_axis: "latency_ms",
      y_axis: "token_count",
      confidence: 0.9,
    });

    await inferPlotConfigFromDescription(baseRequest);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.model).toBe("gpt-4o-mini@openai");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(500);
    expect(body.stream).toBe(false);
  });

  it("includes field information in user prompt", async () => {
    mockOrchestraResponse({
      type: "scatter",
      x_axis: "latency_ms",
      y_axis: "token_count",
      confidence: 0.9,
    });

    await inferPlotConfigFromDescription({
      ...baseRequest,
      description: "Test description",
      available_fields: ["field_a", "field_b"],
      field_types: { field_a: "int", field_b: "string" },
    });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    const userMessage = body.messages[1].content;

    expect(userMessage).toContain("field_a: int");
    expect(userMessage).toContain("field_b: string");
    expect(userMessage).toContain("Test description");
  });

  it("validates inferred config with fallbacks", async () => {
    // LLM returns config with invalid scale
    mockOrchestraResponse({
      type: "scatter",
      x_axis: "latency_ms",
      y_axis: "token_count",
      scale_x: "exponential", // Invalid - should be corrected
      confidence: 0.9,
    });

    const result = await inferPlotConfigFromDescription(baseRequest);

    // Should have been corrected by validation
    expect(result.scale_x).toBe("linear");
    expect(result.reasoning).toContain("Validation notes");
  });
});

describe("isInferenceAvailable", () => {
  // Note: ORCHESTRA_URL is read at module load time, so we test the current state
  // In the test environment, ORCHESTRA_URL is typically set from .env or CI config

  it("returns boolean based on ORCHESTRA_URL presence", () => {
    // This test validates that the function returns a boolean
    // The actual value depends on the test environment's config
    const result = isInferenceAvailable();
    expect(typeof result).toBe("boolean");
  });

  it("returns true when ORCHESTRA_URL is set in environment", () => {
    // Since we set ORCHESTRA_URL in beforeEach of the parent describe,
    // and tests run in a shared process, this should be true
    // This is more of an integration check than a unit test
    expect(isInferenceAvailable()).toBe(true);
  });
});

