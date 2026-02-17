/**
 * Real API tests for Admin Credit Grant Link endpoints.
 *
 * Tests the /api/admin/credit-grant-link endpoints which allow
 * admins to create, list, and delete credit grant links.
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

describe('@real Admin Credit Grant Link API', () => {
  let hasAdminKey = false;

  beforeAll(async () => {
    await skipIfServerNotReachable();

    try {
      hasAdminKey = !!process.env.VITE_TEST_ADMIN_KEY;
    } catch {
      hasAdminKey = false;
    }
  });

  describe('GET /api/admin/credit-grant-link', () => {
    it('@real lists credit grant links', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/credit-grant-link');

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

      const res = await adminFetch('/api/admin/credit-grant-link?limit=5&offset=0');

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('@real returns camelCase response properties', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/credit-grant-link');

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

  describe('POST /api/admin/credit-grant-link', () => {
    it('@real creates credit grant link with default expiry', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/credit-grant-link', {
        method: 'POST',
        body: JSON.stringify({}), // Use default expiry
      });

      expect([200, 201]).toContain(res.status);

      const data = await res.json();
      expect(data).toBeDefined();
      // Should return link info
      expect(typeof data).toBe('object');
    });

    it('@real creates credit grant link with custom expiry', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/credit-grant-link', {
        method: 'POST',
        body: JSON.stringify({ expiresInDays: 7 }),
      });

      expect([200, 201]).toContain(res.status);

      const data = await res.json();
      expect(data).toBeDefined();
    });

    it('@real creates credit grant link with custom credit amount', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      const res = await adminFetch('/api/admin/credit-grant-link', {
        method: 'POST',
        body: JSON.stringify({ expiresInDays: 7, creditAmount: 50.0 }),
      });

      expect([200, 201]).toContain(res.status);

      const data = await res.json();
      expect(data).toBeDefined();
      expect(data.creditAmount).toBeDefined();
    });
  });

  describe('DELETE /api/admin/credit-grant-link/[linkId]', () => {
    it('@real rejects delete with invalid link ID', realTestOptions, async () => {
      if (!hasAdminKey) {
        console.log('Skipping: VITE_TEST_ADMIN_KEY not set');
        return;
      }

      try {
        await adminApi.deleteCreditGrantLink('non-existent-link-id');
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
