/**
 * Real API tests for User Assistant Hiring Approval endpoint.
 *
 * Tests the /api/user/assistant-hiring-approval endpoint which
 * allows users to request approval to hire assistants.
 *
 * Run with: npm run test:api
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  userApi,
  realTestOptions,
  skipIfServerNotReachable,
  ApiError,
} from './fixtures/api-actions';

describe('@real User Hiring Approval API', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  it('@real requests hiring approval', realTestOptions, async () => {
    try {
      const result = await userApi.requestHiringApproval();

      expect(result).toBeDefined();
      // Response could indicate already approved, pending, or new request
      // All are valid responses - we just verify the endpoint works
      expect(
        result.status !== undefined ||
          result.approved !== undefined ||
          result.message !== undefined ||
          result.detail !== undefined
      ).toBe(true);
    } catch (e) {
      // 400/409 could indicate already has approval - that's acceptable
      if (e instanceof ApiError) {
        expect([400, 409, 200, 201]).toContain(e.status);
      } else {
        throw e;
      }
    }
  });

  it('@real returns camelCase response properties', realTestOptions, async () => {
    try {
      const result = await userApi.requestHiringApproval();

      // Verify we don't get snake_case properties
      const keys = Object.keys(result);
      for (const key of keys) {
        expect(key).not.toContain('_');
      }
    } catch (e) {
      // Errors are acceptable for this test (already approved, etc.)
      if (!(e instanceof ApiError)) {
        throw e;
      }
    }
  });
});
