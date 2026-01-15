/**
 * Real API tests for Organizations endpoints.
 *
 * Tests the /api/organizations/[orgId]/teams and /api/organizations/[orgId]/members
 * endpoints which return organization team and member data.
 *
 * Run with: npm run test:api
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  organizationsApi,
  realTestOptions,
  skipIfServerNotReachable,
  ApiError,
} from '../assistants/api/fixtures/api-actions';

// Test organization ID seeded in CI (see tests-api.yml)
const TEST_ORG_ID = '1';

describe('@real Organizations API', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('Teams', () => {
    it('@real lists teams for organization', realTestOptions, async () => {
      const result = await organizationsApi.listTeams(TEST_ORG_ID);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // CI seeds a test team, so we should have at least one
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('@real rejects teams request with invalid org ID format', realTestOptions, async () => {
      try {
        await organizationsApi.listTeams('not-a-number');
        expect.fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        // Console returns 400 for invalid ID format
        expect((e as ApiError).status).toBe(400);
      }
    });

    it('@real rejects teams request with non-existent org ID', realTestOptions, async () => {
      try {
        await organizationsApi.listTeams('999999');
        expect.fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        // Orchestra returns 404 for non-existent org, or 403 if user not member
        expect([403, 404]).toContain((e as ApiError).status);
      }
    });

    it('@real returns camelCase response for teams', realTestOptions, async () => {
      const result = await organizationsApi.listTeams(TEST_ORG_ID);

      if (result.length > 0) {
        const team = result[0];
        const keys = Object.keys(team);
        for (const key of keys) {
          expect(key).not.toMatch(/^[a-z]+_[a-z]+/); // No snake_case
        }
      }
    });
  });

  describe('Members', () => {
    it('@real lists members for organization', realTestOptions, async () => {
      const result = await organizationsApi.listMembers(TEST_ORG_ID);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // CI seeds the test user as owner, so we should have at least one member
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('@real rejects members request with invalid org ID format', realTestOptions, async () => {
      try {
        await organizationsApi.listMembers('not-a-number');
        expect.fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        // Console returns 400 for invalid ID format
        expect((e as ApiError).status).toBe(400);
      }
    });

    it('@real rejects members request with non-existent org ID', realTestOptions, async () => {
      try {
        await organizationsApi.listMembers('999999');
        expect.fail('Should have thrown an error');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        // Orchestra returns 404 for non-existent org, or 403 if user not member
        expect([403, 404]).toContain((e as ApiError).status);
      }
    });

    it('@real returns camelCase response for members', realTestOptions, async () => {
      const result = await organizationsApi.listMembers(TEST_ORG_ID);

      if (result.length > 0) {
        const member = result[0];
        const keys = Object.keys(member);
        for (const key of keys) {
          expect(key).not.toMatch(/^[a-z]+_[a-z]+/); // No snake_case
        }
      }
    });
  });
});
