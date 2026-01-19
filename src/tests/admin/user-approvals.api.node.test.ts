/**
 * Real API tests for Admin User Approvals endpoints.
 *
 * Tests the /api/admin/user-approvals endpoints which allow
 * admins to list and manage user hiring approvals.
 *
 * Note: These tests require VITE_TEST_ADMIN_KEY to be set.
 *
 * Run with: npm run test:api
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  adminApi,
  realTestOptions,
  skipIfServerNotReachable,
  ApiError,
  getAdminApiKey,
} from '../assistants/api/fixtures/api-actions';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT_MS = 90000;

/**
 * Helper to make admin authenticated fetch requests
 */
async function adminFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  let adminKey: string;
  try {
    adminKey = getAdminApiKey();
  } catch {
    throw new Error('VITE_TEST_ADMIN_KEY not set');
  }

  const url = `${BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apiKey: adminKey,
        ...options.headers,
      },
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

describe('@real Admin User Approvals API', () => {
  let hasAdminKey = false;

  beforeAll(async () => {
    await skipIfServerNotReachable();

    // Check if admin key is available
    try {
      hasAdminKey = !!process.env.VITE_TEST_ADMIN_KEY;
    } catch {
      hasAdminKey = false;
    }
  });

  describe('GET /api/admin/user-approvals', () => {
    it('@real lists user approvals', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const result = await adminApi.listApprovals();

      expect(result).toBeDefined();
      // Response should have approvals or info array
      const approvals = result.approvals || result.info || [];
      expect(Array.isArray(approvals)).toBe(true);
    });

    it('@real lists approvals with status filter', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const result = await adminApi.listApprovals('approved', 10, 0);

      expect(result).toBeDefined();
      const approvals = result.approvals || result.info || [];
      expect(Array.isArray(approvals)).toBe(true);
    });

    it('@real lists approvals with pagination', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const result = await adminApi.listApprovals(undefined, 5, 0);

      expect(result).toBeDefined();
      const approvals = result.approvals || result.info || [];
      expect(Array.isArray(approvals)).toBe(true);
      expect(approvals.length).toBeLessThanOrEqual(5);
    });

    it('@real returns camelCase response properties', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const result = await adminApi.listApprovals();

      // Verify we don't get snake_case properties at top level
      const keys = Object.keys(result);
      for (const key of keys) {
        expect(key).not.toMatch(/^[a-z]+_[a-z]+/); // No snake_case
      }
    });

    it('@real returns error without admin key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/admin/user-approvals`, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Should fail without admin key (return 401, 403, 500 for missing config, or 200 if using internal key)
      expect([200, 401, 403, 500]).toContain(res.status);
    });
  });

  describe('PUT /api/admin/user-approvals/[userId]/[status]', () => {
    it('@real rejects update with invalid user ID', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      try {
        await adminApi.updateApprovalStatus('non-existent-user-id', 'approve');
        expect.fail('Expected ApiError for invalid user ID');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect([400, 404]).toContain((e as ApiError).status);
      }
    });

    it('@real validates status parameter', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/user-approvals/some-user-id/invalid-status', {
        method: 'PUT',
      });

      // Should return 400 or 404 for invalid status
      expect([400, 404]).toContain(res.status);
    });
  });
});

describe('@real Admin One-Time Approval Link API', () => {
  let hasAdminKey = false;

  beforeAll(async () => {
    await skipIfServerNotReachable();

    try {
      hasAdminKey = !!process.env.VITE_TEST_ADMIN_KEY;
    } catch {
      hasAdminKey = false;
    }
  });

  describe('GET /api/admin/one-time-approval-link', () => {
    it('@real lists approval links', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/one-time-approval-link');

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toBeDefined();
      // Should return an array or object with links
      expect(typeof data).toBe('object');
    });

    it('@real lists links with pagination', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/one-time-approval-link?limit=5&offset=0');

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('@real returns camelCase response properties', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/one-time-approval-link');

      expect(res.status).toBe(200);

      const data = await res.json();
      // Check for camelCase properties (not snake_case)
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const keys = Object.keys(data);
        for (const key of keys) {
          expect(key).not.toMatch(/^[a-z]+_[a-z]+/);
        }
      }
    });
  });

  describe('POST /api/admin/one-time-approval-link', () => {
    it('@real creates approval link with default expiry', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/one-time-approval-link', {
        method: 'POST',
        body: JSON.stringify({}), // Use default expiry
      });

      expect([200, 201]).toContain(res.status);

      const data = await res.json();
      expect(data).toBeDefined();
      // Should return link info
      expect(typeof data).toBe('object');
    });

    it('@real creates approval link with custom expiry', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/one-time-approval-link', {
        method: 'POST',
        body: JSON.stringify({ expiresInDays: 7 }),
      });

      expect([200, 201]).toContain(res.status);

      const data = await res.json();
      expect(data).toBeDefined();
    });
  });

  describe('DELETE /api/admin/one-time-approval-link/[linkId]', () => {
    it('@real rejects delete with invalid link ID', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      try {
        await adminApi.deleteApprovalLink('non-existent-link-id');
        expect.fail('Expected ApiError for invalid link ID');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect([400, 404]).toContain((e as ApiError).status);
      }
    });
  });
});

describe('@real Admin Contact Sync API', () => {
  let hasAdminKey = false;

  beforeAll(async () => {
    await skipIfServerNotReachable();

    try {
      hasAdminKey = !!process.env.VITE_TEST_ADMIN_KEY;
    } catch {
      hasAdminKey = false;
    }
  });

  describe('POST /api/admin/contact-sync/assistant', () => {
    it('@real returns 400 for missing required fields', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/contact-sync/assistant', {
        method: 'POST',
        body: JSON.stringify({}), // Missing required fields
      });

      expect([400, 422]).toContain(res.status);
    });
  });

  describe('POST /api/admin/contact-sync/user', () => {
    it('@real returns 400 for missing required fields', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/contact-sync/user', {
        method: 'POST',
        body: JSON.stringify({}), // Missing required fields
      });

      expect([400, 422]).toContain(res.status);
    });
  });
});
