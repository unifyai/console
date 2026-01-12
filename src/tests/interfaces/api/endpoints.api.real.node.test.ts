/**
 * Real API tests for Endpoints routes.
 *
 * These tests hit the Next.js API routes to verify endpoint listing functionality.
 * Run with: npm run test:interfaces:real
 *
 * ⚠️ SKIPPED: Orchestra removed provider/model/endpoint listing endpoints
 * - Commit 9318f256: "removed admin provider endpoints, endpoint_metrics..."
 * - Commit 2f638213: "removed the universal api related endpoints" (Jan 9, 2026)
 * - Deleted: /v0/providers, /v0/models, /v0/endpoints
 * - Console routes /api/endpoints/* will return 404 until Orchestra restores this functionality
 */

import { describe, it, expect } from 'vitest';
import { endpointsApi, realTestOptions } from './fixtures/api-actions';

describe.skip('@real Endpoints API Routes - SKIPPED: Orchestra endpoints removed', () => {
  it('@real lists all providers', realTestOptions, async () => {
    const result = await endpointsApi.listProviders();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Should contain some known providers
    const knownProviders = ['openai', 'anthropic', 'together-ai'];
    const hasKnownProvider = knownProviders.some((p) => result.includes(p));
    expect(hasKnownProvider).toBe(true);
  });

  it('@real lists providers for a specific model', realTestOptions, async () => {
    const result = await endpointsApi.listProviders('gpt-4o');

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    // GPT-4o should be available from OpenAI at minimum
    expect(result).toContain('openai');
  });

  it('@real lists all models', realTestOptions, async () => {
    const result = await endpointsApi.listModels();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Should contain some known models
    const knownModels = ['gpt-4o', 'claude-3-5-sonnet'];
    const hasKnownModel = knownModels.some((m) => result.includes(m));
    expect(hasKnownModel).toBe(true);
  });

  it('@real lists models for a specific provider', realTestOptions, async () => {
    const result = await endpointsApi.listModels('openai');

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // OpenAI should have GPT models
    const hasGptModel = result.some((m) => m.includes('gpt'));
    expect(hasGptModel).toBe(true);
  });

  it('@real lists all endpoints', realTestOptions, async () => {
    const result = await endpointsApi.listEndpoints();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Endpoints should be in model@provider format
    const hasValidFormat = result.some((e) => e.includes('@'));
    expect(hasValidFormat).toBe(true);
  });

  it('@real lists endpoints for a specific provider', realTestOptions, async () => {
    const result = await endpointsApi.listEndpoints({ provider: 'openai' });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // All endpoints should be from OpenAI
    const allFromOpenai = result.every((e) => e.endsWith('@openai'));
    expect(allFromOpenai).toBe(true);
  });

  it('@real lists endpoints for a specific model', realTestOptions, async () => {
    const result = await endpointsApi.listEndpoints({ model: 'gpt-4o' });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // All endpoints should be for gpt-4o
    const allForModel = result.every((e) => e.startsWith('gpt-4o@'));
    expect(allForModel).toBe(true);
  });
});
