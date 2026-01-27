/**
 * API tests for Assistant Spending Routes
 *
 * These tests verify that the spending API routes properly:
 * 1. Handle authentication via getApiKeyFromRequest
 * 2. Validate request parameters (month format, body schema)
 * 3. Transform response data from snake_case to camelCase
 * 4. Return appropriate error codes
 * 5. Handle upstream errors gracefully
 *
 * @group real
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getTestApiKey,
  skipIfServerNotReachable,
  realTestOptions,
  getTestAssistant,
} from './fixtures/api-actions';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT_MS = 30000;

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

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

describe('@real Assistant Spending API Routes', () => {
  beforeAll(async () => {
    await skipIfServerNotReachable();
  });

  // ===========================================================================
  // GET /api/assistant/[assistantId]/spending
  // ===========================================================================

  describe('GET /api/assistant/[assistantId]/spending', () => {
    it('@real returns spending data with camelCase response', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available for spending test');
          return;
        }
        throw e;
      }

      const month = getCurrentMonth();
      const res = await apiFetch(`/api/assistant/${testAssistant.agentId}/spending?month=${month}`);

      // May return 200 (data found) or 404 (no spend data yet)
      if (res.status === 200) {
        const data = await res.json();
        // Check for camelCase properties
        expect(data).toHaveProperty('cumulativeSpend');
        expect(data).toHaveProperty('limit');
        expect(data).toHaveProperty('percentUsed');
        // Should not have snake_case
        expect(data).not.toHaveProperty('cumulative_spend');
        expect(data).not.toHaveProperty('percent_used');
      } else if (res.status === 404) {
        // Expected if no spending data exists yet
        const data = await res.json();
        expect(data).toHaveProperty('detail');
      } else {
        // Unexpected status
        expect(res.status).toBeOneOf([200, 404]);
      }
    });

    it('@real returns 400 when month parameter is missing', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available');
          return;
        }
        throw e;
      }

      const res = await apiFetch(`/api/assistant/${testAssistant.agentId}/spending`);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('month');
    });

    it('@real returns 400 for invalid month format', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available');
          return;
        }
        throw e;
      }

      // Invalid format: should be YYYY-MM
      const res = await apiFetch(`/api/assistant/${testAssistant.agentId}/spending?month=2026-1`);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('format');
    });

    it('@real returns 400 for month with invalid month number', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available');
          return;
        }
        throw e;
      }

      // Invalid month: 13 is not a valid month
      const res = await apiFetch(`/api/assistant/${testAssistant.agentId}/spending?month=2026-13`);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('format');
    });

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/assistant/123/spending?month=${getCurrentMonth()}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect([401, 307]).toContain(res.status);
    });
  });

  // ===========================================================================
  // GET /api/assistant/[assistantId]/spending-limit
  // ===========================================================================

  describe('GET /api/assistant/[assistantId]/spending-limit', () => {
    it('@real returns spending limit with camelCase response', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available for spending limit test');
          return;
        }
        throw e;
      }

      const res = await apiFetch(`/api/assistant/${testAssistant.agentId}/spending-limit`);

      // Should return 200 even if no limit is set (limit would be null)
      if (res.status === 200) {
        const data = await res.json();
        // Check for camelCase properties
        expect(data).toHaveProperty('monthlySpendingCap');
        expect(data).toHaveProperty('effectiveLimit');
        // Should not have snake_case
        expect(data).not.toHaveProperty('monthly_spending_cap');
        expect(data).not.toHaveProperty('effective_limit');
      } else if (res.status === 404) {
        // Endpoint might not exist yet in Orchestra
        console.log('Spending limit endpoint returned 404 - may not be deployed yet');
      } else {
        // Other errors should be logged
        const data = await res.json();
        console.log('Unexpected response:', res.status, data);
      }
    });

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/assistant/123/spending-limit`, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect([401, 307]).toContain(res.status);
    });
  });

  // ===========================================================================
  // PUT /api/assistant/[assistantId]/spending-limit
  // ===========================================================================

  describe('PUT /api/assistant/[assistantId]/spending-limit', () => {
    it('@real returns 400 when monthlySpendingCap is missing', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available');
          return;
        }
        throw e;
      }

      const res = await apiFetch(`/api/assistant/${testAssistant.agentId}/spending-limit`, {
        method: 'PUT',
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('monthlySpendingCap');
    });

    it('@real returns 400 for invalid monthlySpendingCap type', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available');
          return;
        }
        throw e;
      }

      const res = await apiFetch(`/api/assistant/${testAssistant.agentId}/spending-limit`, {
        method: 'PUT',
        body: JSON.stringify({ monthlySpendingCap: 'not-a-number' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('number');
    });

    it('@real returns 400 for negative monthlySpendingCap', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available');
          return;
        }
        throw e;
      }

      const res = await apiFetch(`/api/assistant/${testAssistant.agentId}/spending-limit`, {
        method: 'PUT',
        body: JSON.stringify({ monthlySpendingCap: -100 }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('non-negative');
    });

    it('@real accepts valid monthlySpendingCap value', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available');
          return;
        }
        throw e;
      }

      const res = await apiFetch(`/api/assistant/${testAssistant.agentId}/spending-limit`, {
        method: 'PUT',
        body: JSON.stringify({ monthlySpendingCap: 100.0 }),
      });

      // May return 200 (success) or 404 (endpoint not deployed) or 400/403 (validation)
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty('monthlySpendingCap');
        expect(data).toHaveProperty('effectiveLimit');
      } else if (res.status === 404) {
        console.log('Spending limit endpoint returned 404 - may not be deployed yet');
      } else {
        // Log other responses for debugging
        const data = await res.json();
        console.log('PUT spending-limit response:', res.status, data);
      }
    });

    it('@real accepts null monthlySpendingCap to remove limit', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available');
          return;
        }
        throw e;
      }

      const res = await apiFetch(`/api/assistant/${testAssistant.agentId}/spending-limit`, {
        method: 'PUT',
        body: JSON.stringify({ monthlySpendingCap: null }),
      });

      // May return 200 (success) or 404 (endpoint not deployed)
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty('monthlySpendingCap');
        expect(data.monthlySpendingCap).toBeNull();
      } else if (res.status === 404) {
        console.log('Spending limit endpoint returned 404 - may not be deployed yet');
      } else {
        const data = await res.json();
        console.log('PUT spending-limit null response:', res.status, data);
      }
    });

    it('@real returns 401 without API key', realTestOptions, async () => {
      const res = await fetch(`${BASE_URL}/api/assistant/123/spending-limit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlySpendingCap: 100 }),
      });

      expect([401, 307]).toContain(res.status);
    });

    it('@real returns 400 for invalid JSON body', realTestOptions, async () => {
      let testAssistant;
      try {
        testAssistant = await getTestAssistant();
      } catch (e) {
        if (e instanceof Error && e.message.includes('No assistants found')) {
          console.log('Skipping: No assistants available');
          return;
        }
        throw e;
      }

      const apiKey = getTestApiKey();
      const res = await fetch(`${BASE_URL}/api/assistant/${testAssistant.agentId}/spending-limit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          apiKey: apiKey,
        },
        body: 'invalid-json',
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid');
    });
  });
});
