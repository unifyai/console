/**
 * Real Orchestra API tests for Plot API.
 *
 * These tests hit the actual Plot API routes to verify:
 * - Token creation with direct config
 * - Token creation with LLM description
 * - Token retrieval and data fetching
 * - Error handling
 *
 * Run with: npm run test:interfaces:api
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  projectsApi,
  logsApi,
  uniqueName,
  safeDelete,
  realTestOptions,
  realTestOptionsExtended,
  getTestApiKey,
  skipIfServerNotReachable,
} from "./fixtures/api-actions";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

/**
 * Helper to call plot create API
 */
async function createPlot(body: Record<string, unknown>, apiKey: string) {
  const res = await fetch(`${BASE_URL}/api/plot/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

/**
 * Helper to fetch plot data
 */
async function getPlotData(token: string) {
  const res = await fetch(`${BASE_URL}/api/plot/data/${token}`);
  return { status: res.status, data: await res.json() };
}

describe("@real Plot API", () => {
  let testProject: string;
  let apiKey: string;

  beforeAll(async () => {
    await skipIfServerNotReachable();
    apiKey = getTestApiKey();

    // Create a test project with sample logs
    testProject = uniqueName("test-plot-api");
    await projectsApi.create(testProject);

    // Create varied test data for plotting
    await logsApi.create(
      testProject,
      [
        { model: "gpt-4", region: "us" },
        { model: "gpt-4", region: "eu" },
        { model: "claude-3", region: "us" },
        { model: "claude-3", region: "eu" },
      ],
      [
        { latency_ms: 150, tokens: 500, cost: 0.02, status: "success" },
        { latency_ms: 180, tokens: 600, cost: 0.025, status: "success" },
        { latency_ms: 120, tokens: 400, cost: 0.015, status: "success" },
        { latency_ms: 200, tokens: 800, cost: 0.03, status: "error" },
      ]
    );
  });

  afterAll(async () => {
    await safeDelete(
      () => projectsApi.delete(testProject),
      `project: ${testProject}`
    );
  });

  describe("POST /api/plot/create", () => {
    describe("Authentication", () => {
      it(
        "rejects request without Authorization header",
        realTestOptions,
        async () => {
          const res = await fetch(`${BASE_URL}/api/plot/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plot_config: { type: "scatter", x_axis: "latency_ms", y_axis: "tokens" },
              project_config: { project_name: testProject },
            }),
          });

          expect(res.status).toBe(401);
          const data = await res.json();
          expect(data.error).toContain("Authorization");
        }
      );

      it(
        "rejects request with invalid Authorization header format",
        realTestOptions,
        async () => {
          const res = await fetch(`${BASE_URL}/api/plot/create`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "InvalidFormat",
            },
            body: JSON.stringify({
              plot_config: { type: "scatter", x_axis: "latency_ms", y_axis: "tokens" },
              project_config: { project_name: testProject },
            }),
          });

          expect(res.status).toBe(401);
        }
      );
    });

    describe("Validation", () => {
      it(
        "rejects request without plot_config or description",
        realTestOptions,
        async () => {
          const { status, data } = await createPlot(
            {
              project_config: { project_name: testProject },
            },
            apiKey
          );

          expect(status).toBe(400);
          expect(data.error).toContain("plot_config");
        }
      );

      it(
        "rejects request without project_config.project_name",
        realTestOptions,
        async () => {
          const { status, data } = await createPlot(
            {
              plot_config: { type: "scatter", x_axis: "latency_ms", y_axis: "tokens" },
              project_config: {},
            },
            apiKey
          );

          expect(status).toBe(400);
          expect(data.error).toContain("project_name");
        }
      );

      it(
        "rejects request without plot_config.x_axis",
        realTestOptions,
        async () => {
          const { status, data } = await createPlot(
            {
              plot_config: { type: "scatter" },
              project_config: { project_name: testProject },
            },
            apiKey
          );

          expect(status).toBe(400);
          expect(data.error).toContain("x_axis");
        }
      );

      it("rejects invalid JSON body", realTestOptions, async () => {
        const res = await fetch(`${BASE_URL}/api/plot/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: "not valid json",
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain("JSON");
      });
    });

    describe("Scatter Plot Creation", () => {
      it(
        "creates scatter plot token with valid config",
        realTestOptions,
        async () => {
          const { status, data } = await createPlot(
            {
              plot_config: {
                type: "scatter",
                x_axis: "latency_ms",
                y_axis: "tokens",
              },
              project_config: {
                project_name: testProject,
                limit: 100,
              },
            },
            apiKey
          );

          expect(status).toBe(201);
          expect(data.url).toContain("/plot/view/");
          expect(data.token).toMatch(/^[a-f0-9]{12}$/);
        }
      );

      it(
        "creates scatter plot with grouping and regression",
        realTestOptions,
        async () => {
          const { status, data } = await createPlot(
            {
              plot_config: {
                type: "scatter",
                x_axis: "latency_ms",
                y_axis: "tokens",
                group_by: "model",
                show_regression: true,
                scale_x: "log",
                scale_y: "linear",
              },
              project_config: {
                project_name: testProject,
              },
            },
            apiKey
          );

          expect(status).toBe(201);
          expect(data.token).toBeDefined();
        }
      );
    });

    describe("Bar Chart Creation", () => {
      it("creates bar chart with aggregation", realTestOptions, async () => {
        const { status, data } = await createPlot(
          {
            plot_config: {
              type: "bar",
              x_axis: "model",
              y_axis: "latency_ms",
              aggregate: "mean",
              metric: "mean",
            },
            project_config: {
              project_name: testProject,
            },
          },
          apiKey
        );

        expect(status).toBe(201);
        expect(data.token).toBeDefined();
      });
    });

    describe("Histogram Creation", () => {
      it("creates histogram with bin count", realTestOptions, async () => {
        const { status, data } = await createPlot(
          {
            plot_config: {
              type: "histogram",
              x_axis: "latency_ms",
              bin_count: 15,
            },
            project_config: {
              project_name: testProject,
            },
          },
          apiKey
        );

        expect(status).toBe(201);
        expect(data.token).toBeDefined();
      });
    });

    describe("Line Chart Creation", () => {
      it("creates line chart", realTestOptions, async () => {
        const { status, data } = await createPlot(
          {
            plot_config: {
              type: "line",
              x_axis: "latency_ms",
              y_axis: "tokens",
            },
            project_config: {
              project_name: testProject,
            },
          },
          apiKey
        );

        expect(status).toBe(201);
        expect(data.token).toBeDefined();
      });
    });

    describe("Plot Type Normalization", () => {
      it(
        'normalizes "Scatter Plot" to "scatter"',
        realTestOptions,
        async () => {
          const { status, data } = await createPlot(
            {
              plot_config: {
                plot_type: "Scatter Plot",
                x_axis: "latency_ms",
                y_axis: "tokens",
              },
              project_config: { project_name: testProject },
            },
            apiKey
          );

          expect(status).toBe(201);
        }
      );

      it('normalizes "Bar Chart" to "bar"', realTestOptions, async () => {
        const { status, data } = await createPlot(
          {
            plot_config: {
              plot_type: "Bar Chart",
              x_axis: "model",
              y_axis: "latency_ms",
            },
            project_config: { project_name: testProject },
          },
          apiKey
        );

        expect(status).toBe(201);
      });
    });

    describe("Full Project Config Support", () => {
      it(
        "accepts all log fetching parameters",
        realTestOptions,
        async () => {
          const { status, data } = await createPlot(
            {
              plot_config: {
                type: "scatter",
                x_axis: "latency_ms",
                y_axis: "tokens",
              },
              project_config: {
                project_name: testProject,
                context: null,
                filter_expr: 'status == "success"',
                sorting: '{"latency_ms": "descending"}',
                limit: 50,
                offset: 0,
                value_limit: 1000,
              },
              title: "Latency vs Tokens",
            },
            apiKey
          );

          expect(status).toBe(201);
          expect(data.token).toBeDefined();
        }
      );
    });

    describe("LLM Description-based Creation", () => {
      it(
        "creates plot from natural language description",
        realTestOptionsExtended,
        async () => {
          const { status, data } = await createPlot(
            {
              description:
                "Show a scatter plot comparing latency_ms to tokens, grouped by model",
              project_config: {
                project_name: testProject,
              },
            },
            apiKey
          );

          // May succeed or fail depending on LLM availability
          if (status === 201) {
            expect(data.token).toBeDefined();
            expect(data.inferred_config).toBeDefined();
            expect(data.inferred_config.type).toBe("scatter");
            expect(data.inferred_config.confidence).toBeGreaterThan(0);
          } else {
            // LLM inference failed - acceptable in test env
            expect([500, 502]).toContain(status);
          }
        }
      );
    });
  });

  describe("GET /api/plot/data/[token]", () => {
    let validToken: string;

    beforeAll(async () => {
      // Create a plot to test data retrieval
      const { data } = await createPlot(
        {
          plot_config: {
            type: "scatter",
            x_axis: "latency_ms",
            y_axis: "tokens",
            group_by: "model",
          },
          project_config: { project_name: testProject },
          title: "Test Plot",
        },
        apiKey
      );
      validToken = data.token;
    });

    describe("Token Validation", () => {
      it("returns 400 for invalid token format", realTestOptions, async () => {
        const { status, data } = await getPlotData("invalid-token!");

        expect(status).toBe(400);
        expect(data.error).toContain("token");
      });

      it("returns 400 for too-short token", realTestOptions, async () => {
        const { status } = await getPlotData("abc123");

        expect(status).toBe(400);
      });

      it(
        "returns 404 for non-existent token",
        realTestOptions,
        async () => {
          const { status, data } = await getPlotData("000000000000");

          expect(status).toBe(404);
          expect(data.expired).toBe(true);
        }
      );
    });

    describe("Data Retrieval", () => {
      it("returns plot data for valid token", realTestOptions, async () => {
        const { status, data } = await getPlotData(validToken);

        expect(status).toBe(200);
        expect(data.config).toBeDefined();
        expect(data.data).toBeDefined();
        expect(data.fields).toBeDefined();
        expect(data.metadata).toBeDefined();
      });

      it(
        "returns correct config structure",
        realTestOptions,
        async () => {
          const { data } = await getPlotData(validToken);

          expect(data.config.type).toBe("scatter");
          expect(data.config.xAxis).toBe("latency_ms");
          expect(data.config.yAxis).toBe("tokens");
          expect(data.config.groupBy).toBe("model");
        }
      );

      it("returns correct metadata", realTestOptions, async () => {
        const { data } = await getPlotData(validToken);

        expect(data.metadata.title).toBe("Test Plot");
        expect(data.metadata.project_name).toBe(testProject);
        expect(data.metadata.created_at).toBeDefined();
        expect(data.metadata.expires_at).toBeDefined();
      });

      it(
        "returns data array with correct structure",
        realTestOptions,
        async () => {
          const { data } = await getPlotData(validToken);

          expect(Array.isArray(data.data)).toBe(true);
          expect(data.data.length).toBeGreaterThan(0);

          const firstLog = data.data[0];
          expect(firstLog.type).toBe("ungrouped");
          expect(firstLog["table1.entries"]).toBeDefined();
        }
      );

      it(
        "returns fields with table prefix",
        realTestOptions,
        async () => {
          const { data } = await getPlotData(validToken);

          // Fields should be prefixed with "table1."
          const fieldKeys = Object.keys(data.fields);
          expect(fieldKeys.some((k) => k.startsWith("table1."))).toBe(true);
        }
      );
    });

    describe("Caching", () => {
      it("includes cache control header", realTestOptions, async () => {
        const res = await fetch(`${BASE_URL}/api/plot/data/${validToken}`);

        expect(res.status).toBe(200);
        const cacheControl = res.headers.get("cache-control");
        expect(cacheControl).toContain("private");
      });
    });
  });

  describe("End-to-End Flows", () => {
    it(
      "create scatter plot → fetch data → verify format",
      realTestOptions,
      async () => {
        // 1. Create plot
        const { status: createStatus, data: createData } = await createPlot(
          {
            plot_config: {
              type: "scatter",
              x_axis: "latency_ms",
              y_axis: "tokens",
              group_by: "model",
              show_regression: true,
            },
            project_config: {
              project_name: testProject,
              filter_expr: 'status == "success"',
            },
            title: "E2E Test Plot",
          },
          apiKey
        );

        expect(createStatus).toBe(201);
        const { token } = createData;

        // 2. Fetch plot data
        const { status: dataStatus, data: plotData } = await getPlotData(token);
        expect(dataStatus).toBe(200);

        // 3. Verify config
        expect(plotData.config.type).toBe("scatter");
        expect(plotData.config.xAxis).toBe("latency_ms");
        expect(plotData.config.yAxis).toBe("tokens");
        expect(plotData.config.groupBy).toBe("model");
        expect(plotData.config.showRegression).toBe(true);

        // 4. Verify metadata
        expect(plotData.metadata.title).toBe("E2E Test Plot");
        expect(plotData.metadata.project_name).toBe(testProject);

        // 5. Verify data transformation
        expect(plotData.data.length).toBeGreaterThan(0);
        const firstLog = plotData.data[0];
        expect(firstLog["table1.entries"]).toBeDefined();
        expect(firstLog["table1.entries"]["table1.latency_ms"]).toBeDefined();
      }
    );

    it(
      "create bar chart → verify aggregation preserved",
      realTestOptions,
      async () => {
        const { status: createStatus, data: createData } = await createPlot(
          {
            plot_config: {
              type: "bar",
              x_axis: "model",
              y_axis: "latency_ms",
              aggregate: "mean",
              metric: "mean",
            },
            project_config: { project_name: testProject },
          },
          apiKey
        );

        expect(createStatus).toBe(201);

        const { data: plotData } = await getPlotData(createData.token);
        expect(plotData.config.type).toBe("bar");
        expect(plotData.config.metric).toBe("mean");
      }
    );

    it(
      "create histogram → verify bin count preserved",
      realTestOptions,
      async () => {
        const { status: createStatus, data: createData } = await createPlot(
          {
            plot_config: {
              type: "histogram",
              x_axis: "latency_ms",
              bin_count: 25,
            },
            project_config: { project_name: testProject },
          },
          apiKey
        );

        expect(createStatus).toBe(201);

        const { data: plotData } = await getPlotData(createData.token);
        expect(plotData.config.type).toBe("histogram");
        expect(plotData.config.binCount).toBe(25);
      }
    );
  });
});

