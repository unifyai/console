/**
 * Real API tests for Bootstrap endpoint.
 *
 * Tests the /api/bootstrap endpoint which aggregates multiple
 * data sources for initial page load optimization.
 *
 * Run with: npm run test:api
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  bootstrapApi,
  realTestOptions,
  realTestOptionsExtended,
  skipIfServerNotReachable,
} from '../assistants/api/fixtures/api-actions';

describe('@real Bootstrap API', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  it('@real fetches bootstrap data without project', realTestOptionsExtended, async () => {
    const result = await bootstrapApi.fetch();

    expect(result).toBeDefined();
    expect(result.projectsTree).toBeDefined();
    expect(Array.isArray(result.projectsTree)).toBe(true);
    expect(result.interfaces).toBeDefined();
    expect(Array.isArray(result.interfaces)).toBe(true);
    expect(result.contexts).toBeDefined();
    expect(Array.isArray(result.contexts)).toBe(true);
    expect(result.fields).toBeDefined();
    expect(Array.isArray(result.fields)).toBe(true);
    expect(result.fetchedAt).toBeDefined();
    expect(result.statuses).toBeDefined();
  });

  it('@real fetches bootstrap data with project', realTestOptionsExtended, async () => {
    // Try with a test project name - if it doesn't exist, we still get valid response
    const result = await bootstrapApi.fetch('test-project');

    expect(result).toBeDefined();
    expect(result.project).toBe('test-project');
    expect(result.projectsTree).toBeDefined();
    expect(result.interfaces).toBeDefined();
    expect(result.contexts).toBeDefined();
    expect(result.fields).toBeDefined();
    expect(result.fetchedAt).toBeDefined();
    expect(result.statuses).toBeDefined();
  });

  it(
    '@real returns proper status codes for each aggregated request',
    realTestOptionsExtended,
    async () => {
      const result = await bootstrapApi.fetch();

      expect(result.statuses).toBeDefined();
      expect(typeof result.statuses.projectsTree).toBe('number');
      expect(typeof result.statuses.interfaces).toBe('number');
      expect(typeof result.statuses.contexts).toBe('number');
      expect(typeof result.statuses.fields).toBe('number');
    }
  );

  it('@real returns camelCase response properties', realTestOptions, async () => {
    const result = await bootstrapApi.fetch();

    // Check top-level keys are camelCase
    expect(result).toHaveProperty('projectsTree');
    expect(result).toHaveProperty('fetchedAt');
    expect(result).not.toHaveProperty('projects_tree');
    expect(result).not.toHaveProperty('fetched_at');

    // Check statuses object uses camelCase
    expect(result.statuses).toHaveProperty('projectsTree');
    expect(result.statuses).not.toHaveProperty('projects_tree');
  });

  it('@real returns valid ISO timestamp for fetchedAt', realTestOptions, async () => {
    const result = await bootstrapApi.fetch();

    expect(result.fetchedAt).toBeDefined();
    const date = new Date(result.fetchedAt);
    expect(date.getTime()).not.toBeNaN();

    // Should be recent (within last minute)
    const now = Date.now();
    const fetchedTime = date.getTime();
    expect(now - fetchedTime).toBeLessThan(60000);
  });

  it(
    '@real projectsTree contains expected structure when projects exist',
    realTestOptionsExtended,
    async () => {
      const result = await bootstrapApi.fetch();

      if (result.projectsTree.length > 0) {
        // Each project entry should have expected structure
        const project = result.projectsTree[0] as Record<string, unknown>;
        // Project should not have snake_case keys
        const keys = Object.keys(project);
        for (const key of keys) {
          expect(key).not.toMatch(/^[a-z]+_[a-z]+$/);
        }
      }
    }
  );
});
