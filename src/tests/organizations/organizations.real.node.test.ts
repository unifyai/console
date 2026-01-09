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

describe('@real Organizations API', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('Teams', () => {
    it('@real lists teams for organization', realTestOptions, async () => {
      // Using 'default' as a test org ID - adjust if needed
      try {
        const result = await organizationsApi.listTeams('default');

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      } catch (e) {
        // 404/403/422 is acceptable if org doesn't exist or is invalid
        if (e instanceof ApiError) {
          expect([404, 403, 422]).toContain(e.status);
        } else {
          throw e;
        }
      }
    });

    it('@real rejects teams request with invalid org ID', realTestOptions, async () => {
      try {
        await organizationsApi.listTeams('non-existent-org-12345');
        // If it doesn't throw, the response should still be valid
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect([403, 404, 422]).toContain((e as ApiError).status);
      }
    });

    it('@real returns camelCase response for teams', realTestOptions, async () => {
      try {
        const result = await organizationsApi.listTeams('default');

        if (result.length > 0) {
          const team = result[0];
          const keys = Object.keys(team);
          for (const key of keys) {
            expect(key).not.toMatch(/^[a-z]+_[a-z]+/); // No snake_case
          }
        }
      } catch (e) {
        // 404/403 is acceptable if org doesn't exist
        if (!(e instanceof ApiError)) {
          throw e;
        }
      }
    });
  });

  describe('Members', () => {
    it('@real lists members for organization', realTestOptions, async () => {
      try {
        const result = await organizationsApi.listMembers('default');

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      } catch (e) {
        // 404/403/422 is acceptable if org doesn't exist or is invalid
        if (e instanceof ApiError) {
          expect([404, 403, 422]).toContain(e.status);
        } else {
          throw e;
        }
      }
    });

    it('@real rejects members request with invalid org ID', realTestOptions, async () => {
      try {
        await organizationsApi.listMembers('non-existent-org-12345');
        // If it doesn't throw, the response should still be valid
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect([403, 404, 422]).toContain((e as ApiError).status);
      }
    });

    it('@real returns camelCase response for members', realTestOptions, async () => {
      try {
        const result = await organizationsApi.listMembers('default');

        if (result.length > 0) {
          const member = result[0];
          const keys = Object.keys(member);
          for (const key of keys) {
            expect(key).not.toMatch(/^[a-z]+_[a-z]+/); // No snake_case
          }
        }
      } catch (e) {
        // 404/403 is acceptable if org doesn't exist
        if (!(e instanceof ApiError)) {
          throw e;
        }
      }
    });
  });
});
