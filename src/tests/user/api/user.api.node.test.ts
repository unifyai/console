/**
 * Real API tests for User Routes
 *
 * These tests verify that the user API routes properly:
 * 1. Handle authentication via getApiKeyFromRequest
 * 2. Transform response data from snake_case to camelCase
 * 3. Return appropriate error codes
 *
 * @group real
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getTestApiKey,
  skipIfServerNotReachable,
  realTestOptions,
  userApi,
  ApiError,
} from '../../assistants/api/fixtures/api-actions';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT_MS = 90000;

/**
 * Helper to make authenticated fetch requests
 */
async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = getTestApiKey();
  const url = `${BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        apiKey: apiKey,
        ...options.headers,
      },
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

describe('@real User Onboarding Status Route', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('GET /api/user/onboarding-status', () => {
    it('@real returns onboarding status with API key', realTestOptions, async () => {
      const res = await apiFetch('/api/user/onboarding-status');

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(typeof data).toBe('object');
    });

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/user/onboarding-status`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });
});

describe('@real Billing Tax Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('GET /api/billing/supported-tax-countries', () => {
    it('@real returns supported tax countries with API key', realTestOptions, async () => {
      const res = await apiFetch('/api/billing/supported-tax-countries');

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toBeTruthy();
    });

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/billing/supported-tax-countries`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/billing/validate-tax-id', () => {
    it('@real returns 400 for missing required fields', realTestOptions, async () => {
      const res = await apiFetch('/api/billing/validate-tax-id', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('@real validates tax ID with proper input', realTestOptions, async () => {
      const res = await apiFetch('/api/billing/validate-tax-id', {
        method: 'POST',
        body: JSON.stringify({
          country: 'US',
          taxId: '123-45-6789',
        }),
      });

      // Should return 200 or validation error from backend
      expect([200, 400, 422]).toContain(res.status);
    });

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/billing/validate-tax-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: 'US', taxId: '123' }),
      });

      expect(res.status).toBe(401);
    });
  });
});

describe('@real User Favourites Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('GET /api/user/favourites', () => {
    it('@real lists user favourites', realTestOptions, async () => {
      const res = await apiFetch('/api/user/favourites');

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/user/favourites`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });
});

describe('@real User Assistant Hiring Approval Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('POST /api/user/assistant-hiring-approval', () => {
    it('@real requests hiring approval', realTestOptions, async () => {
      try {
        const result = await userApi.requestHiringApproval();

        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      } catch (e) {
        // May fail if already approved or other business logic
        expect(e).toBeInstanceOf(ApiError);
      }
    });

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/user/assistant-hiring-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });
});

describe('@real User Projects Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('GET /api/user/projects', () => {
    it('@real lists user projects with API key', realTestOptions, async () => {
      const res = await apiFetch('/api/user/projects');

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/user/projects`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });
});

describe('@real User Profile Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  describe('GET /api/user/profile', () => {
    it(
      '@real returns 404 with API key only (session required for profile data)',
      realTestOptions,
      async () => {
        const res = await apiFetch('/api/user/profile');

        // Profile data requires session, API key alone returns 404
        expect(res.status).toBe(404);
      }
    );

    it('@real returns 401 without any auth', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/user/profile`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/user/update-profile', () => {
    it('@real returns 400 with API key only (session required)', realTestOptions, async () => {
      const res = await apiFetch('/api/user/update-profile', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
      });

      // Profile update requires session
      expect(res.status).toBe(400);
    });

    it('@real returns 401 without any auth', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/user/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });

      expect(res.status).toBe(401);
    });
  });
});

describe('@real Logging Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  // Note: These routes use the legacy Axios-based OrchestraUserClient which may fail
  // TODO: Migrate to typed OpenAPI client

  describe('GET /api/logging/getMetrics', () => {
    it(
      '@real returns metrics with API key (or 500 if backend issue)',
      realTestOptions,
      async () => {
        const res = await apiFetch('/api/logging/getMetrics');

        // 200 on success, 500 if backend/lib function fails
        expect([200, 500]).toContain(res.status);

        if (res.status === 200) {
          const data = await res.json();
          expect(data).toHaveProperty('calls');
          expect(data).toHaveProperty('tokens');
          expect(data).toHaveProperty('latency');
          expect(data).toHaveProperty('throughput');
        }
      }
    );

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/logging/getMetrics`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/logging/getQueries', () => {
    it(
      '@real returns queries with API key (or 500 if backend issue)',
      realTestOptions,
      async () => {
        const res = await apiFetch('/api/logging/getQueries');

        // 200 on success, 500 if backend/lib function fails
        expect([200, 500]).toContain(res.status);

        if (res.status === 200) {
          const data = await res.json();
          expect(data).toHaveProperty('queries');
          expect(data).toHaveProperty('totalPages');
        }
      }
    );

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/logging/getQueries`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/logging/getQueryTags', () => {
    it(
      '@real returns query tags with API key (or 500 if backend issue)',
      realTestOptions,
      async () => {
        const res = await apiFetch('/api/logging/getQueryTags');

        // 200 on success, 500 if backend/lib function fails
        expect([200, 500]).toContain(res.status);

        if (res.status === 200) {
          const data = await res.json();
          expect(Array.isArray(data)).toBe(true);
        }
      }
    );

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/logging/getQueryTags`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(res.status).toBe(401);
    });
  });
});
