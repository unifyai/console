/**
 * Unit tests for plot token store module
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  storePlotToken,
  getPlotToken,
  hasPlotToken,
  deletePlotToken,
  listPlotTokens,
  getPlotTokenStats,
  PlotConfig,
  ProjectConfig,
} from "@/lib/plot/store";

describe("Plot Token Store", () => {
  const originalEnv = process.env;

  beforeAll(() => {
    // Ensure we have an encryption key set
    process.env = {
      ...originalEnv,
      PLOT_TOKEN_SECRET: "test-secret-key-for-encryption",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const samplePlotConfig: PlotConfig = {
    type: "scatter",
    xAxis: "latency_ms",
    yAxis: "token_count",
    scaleX: "linear",
    scaleY: "log",
    metric: "mean",
    binCount: 10,
    showRegression: true,
  };

  const sampleProjectConfig: ProjectConfig = {
    project_name: "test-project",
    context: "production",
    filter_expr: 'status == "success"',
    limit: 100,
  };

  describe("storePlotToken", () => {
    it("stores a token and returns a 12-character hex string", () => {
      const token = storePlotToken(samplePlotConfig, sampleProjectConfig);

      expect(token).toMatch(/^[a-f0-9]{12}$/);
    });

    it("generates unique tokens for each call", () => {
      const token1 = storePlotToken(samplePlotConfig, sampleProjectConfig);
      const token2 = storePlotToken(samplePlotConfig, sampleProjectConfig);

      expect(token1).not.toBe(token2);
    });

    it("stores title if provided", () => {
      const token = storePlotToken(
        samplePlotConfig,
        sampleProjectConfig,
        3600,
        "My Plot Title"
      );

      const data = getPlotToken(token);
      expect(data?.title).toBe("My Plot Title");
    });

    it("stores and encrypts API key", () => {
      const apiKey = "sk-test-api-key-12345";
      const token = storePlotToken(
        samplePlotConfig,
        sampleProjectConfig,
        3600,
        undefined,
        apiKey
      );

      const data = getPlotToken(token);
      // getPlotToken should decrypt the key
      expect(data?.api_key).toBe(apiKey);
    });

    it("sets correct expiry time", () => {
      const ttlSeconds = 7200; // 2 hours
      const beforeStore = new Date();

      const token = storePlotToken(
        samplePlotConfig,
        sampleProjectConfig,
        ttlSeconds
      );

      const data = getPlotToken(token);
      const expiresAt = new Date(data!.expires_at);
      const expectedExpiry = new Date(beforeStore.getTime() + ttlSeconds * 1000);

      // Should be within a few seconds of expected
      expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(
        5000
      );
    });
  });

  describe("getPlotToken", () => {
    it("retrieves stored token data", () => {
      const token = storePlotToken(samplePlotConfig, sampleProjectConfig);

      const data = getPlotToken(token);

      expect(data).not.toBeNull();
      expect(data?.plot_config).toEqual(samplePlotConfig);
      expect(data?.project_config).toEqual(sampleProjectConfig);
    });

    it("returns null for non-existent token", () => {
      const data = getPlotToken("nonexistent123");

      expect(data).toBeNull();
    });

    it("decrypts API key on retrieval", () => {
      const apiKey = "my-secret-api-key";
      const token = storePlotToken(
        samplePlotConfig,
        sampleProjectConfig,
        3600,
        undefined,
        apiKey
      );

      const data = getPlotToken(token);

      expect(data?.api_key).toBe(apiKey);
    });

    it("includes created_at and expires_at timestamps", () => {
      const token = storePlotToken(samplePlotConfig, sampleProjectConfig);

      const data = getPlotToken(token);

      expect(data?.created_at).toBeDefined();
      expect(data?.expires_at).toBeDefined();

      // Should be valid ISO timestamps
      expect(() => new Date(data!.created_at)).not.toThrow();
      expect(() => new Date(data!.expires_at)).not.toThrow();
    });
  });

  describe("hasPlotToken", () => {
    it("returns true for existing token", () => {
      const token = storePlotToken(samplePlotConfig, sampleProjectConfig);

      expect(hasPlotToken(token)).toBe(true);
    });

    it("returns false for non-existent token", () => {
      expect(hasPlotToken("nonexistent123")).toBe(false);
    });
  });

  describe("deletePlotToken", () => {
    it("deletes existing token and returns true", () => {
      const token = storePlotToken(samplePlotConfig, sampleProjectConfig);

      const result = deletePlotToken(token);

      expect(result).toBe(true);
      expect(hasPlotToken(token)).toBe(false);
    });

    it("returns false for non-existent token", () => {
      const result = deletePlotToken("nonexistent123");

      expect(result).toBe(false);
    });
  });

  describe("listPlotTokens", () => {
    it("returns array of token strings", () => {
      const token1 = storePlotToken(samplePlotConfig, sampleProjectConfig);
      const token2 = storePlotToken(samplePlotConfig, sampleProjectConfig);

      const tokens = listPlotTokens();

      expect(tokens).toContain(token1);
      expect(tokens).toContain(token2);
    });
  });

  describe("getPlotTokenStats", () => {
    it("returns cache statistics", () => {
      // Store some tokens to ensure cache has data
      storePlotToken(samplePlotConfig, sampleProjectConfig);

      const stats = getPlotTokenStats();

      expect(stats).toHaveProperty("hits");
      expect(stats).toHaveProperty("misses");
      expect(stats).toHaveProperty("keys");
    });
  });

  describe("ProjectConfig full parameter support", () => {
    it("stores all ProjectConfig fields", () => {
      const fullProjectConfig: ProjectConfig = {
        project_name: "test-project",
        context: "production",
        column_context: "metrics",
        filter_expr: 'status == "success"',
        from_ids: "id1,id2",
        exclude_ids: "id3",
        from_fields: "field1,field2",
        exclude_fields: "field3",
        limit: 100,
        offset: 50,
        group_by: ["model", "status"],
        group_limit: 10,
        group_offset: 5,
        group_depth: 2,
        groups_only: true,
        nested_groups: false,
        sorting: '{"latency": "descending"}',
        group_sorting: '{"count": "ascending"}',
        value_limit: 1000,
        randomize: true,
        seed: "12345",
      };

      const token = storePlotToken(samplePlotConfig, fullProjectConfig);
      const data = getPlotToken(token);

      expect(data?.project_config).toEqual(fullProjectConfig);
    });
  });
});


