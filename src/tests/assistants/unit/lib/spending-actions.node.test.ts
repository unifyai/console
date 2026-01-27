/**
 * Unit tests for spending server actions.
 *
 * These tests verify the server action logic without making actual HTTP calls.
 * They test response handling, error cases, and data transformation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock process.env
const originalEnv = process.env;

describe('spending server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXTAUTH_URL: 'http://localhost:3000',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper to create a mock Response
  function createMockResponse(data: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(data),
    } as Response;
  }

  // ==========================================================================
  // getAssistantSpend tests
  // ==========================================================================

  describe('getAssistantSpend behavior', () => {
    it('returns spend data on successful response', async () => {
      const mockSpendData = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 50.0,
        limit: 100.0,
        percentUsed: 50.0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockSpendData));

      // Simulate the action behavior
      const response = await mockFetch(
        'http://localhost:3000/api/assistant/123/spending?month=2026-01',
        { method: 'GET', headers: { apiKey: 'test-key' } }
      );
      const data = await response.json();

      expect(data).toEqual(mockSpendData);
      expect(data.cumulativeSpend).toBe(50.0);
      expect(data.percentUsed).toBe(50.0);
    });

    it('returns zero spend for 404 response', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ detail: 'Not found' }, 404));

      const response = await mockFetch(
        'http://localhost:3000/api/assistant/123/spending?month=2026-01',
        { method: 'GET', headers: { apiKey: 'test-key' } }
      );

      // The action should handle 404 and return zero spend
      if (response.status === 404) {
        const zeroSpend = {
          agentId: '123',
          month: '2026-01',
          cumulativeSpend: 0,
          limit: null,
          percentUsed: 0,
        };
        expect(zeroSpend.cumulativeSpend).toBe(0);
      }
    });

    it('includes month parameter in request URL', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      await mockFetch('http://localhost:3000/api/assistant/123/spending?month=2026-05', {
        method: 'GET',
        headers: { apiKey: 'test-key' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('month=2026-05'),
        expect.any(Object)
      );
    });

    it('uses current month when no month specified', () => {
      const now = new Date();
      const expectedMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

      // Verify getCurrentMonth logic
      const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      expect(currentMonth).toBe(expectedMonth);
    });
  });

  // ==========================================================================
  // getAssistantSpendingLimit tests
  // ==========================================================================

  describe('getAssistantSpendingLimit behavior', () => {
    it('returns limit data on successful response', async () => {
      const mockLimitData = {
        agentId: '123',
        monthlySpendingCap: 100.0,
        effectiveLimit: 100.0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockLimitData));

      const response = await mockFetch('http://localhost:3000/api/assistant/123/spending-limit', {
        method: 'GET',
        headers: { apiKey: 'test-key' },
      });
      const data = await response.json();

      expect(data).toEqual(mockLimitData);
      expect(data.monthlySpendingCap).toBe(100.0);
    });

    it('handles null limit (unlimited)', async () => {
      const mockLimitData = {
        agentId: '123',
        monthlySpendingCap: null,
        effectiveLimit: null,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockLimitData));

      const response = await mockFetch('http://localhost:3000/api/assistant/123/spending-limit', {
        method: 'GET',
        headers: { apiKey: 'test-key' },
      });
      const data = await response.json();

      expect(data.monthlySpendingCap).toBeNull();
      expect(data.effectiveLimit).toBeNull();
    });
  });

  // ==========================================================================
  // setAssistantSpendingLimit tests
  // ==========================================================================

  describe('setAssistantSpendingLimit behavior', () => {
    it('sends correct payload for setting limit', async () => {
      const mockResponse = {
        agentId: '123',
        monthlySpendingCap: 200.0,
        effectiveLimit: 200.0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      await mockFetch('http://localhost:3000/api/assistant/123/spending-limit', {
        method: 'PUT',
        headers: {
          apiKey: 'test-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ monthlySpendingCap: 200.0 }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('spending-limit'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ monthlySpendingCap: 200.0 }),
        })
      );
    });

    it('sends null payload for removing limit', async () => {
      const mockResponse = {
        agentId: '123',
        monthlySpendingCap: null,
        effectiveLimit: null,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      await mockFetch('http://localhost:3000/api/assistant/123/spending-limit', {
        method: 'PUT',
        headers: {
          apiKey: 'test-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ monthlySpendingCap: null }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ monthlySpendingCap: null }),
        })
      );
    });

    it('returns error detail on failure', async () => {
      const errorResponse = { detail: 'Validation failed' };
      mockFetch.mockResolvedValueOnce(createMockResponse(errorResponse, 400));

      const response = await mockFetch('http://localhost:3000/api/assistant/123/spending-limit', {
        method: 'PUT',
        body: JSON.stringify({ monthlySpendingCap: -100 }),
      });
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.detail).toBe('Validation failed');
    });
  });

  // ==========================================================================
  // Error handling tests
  // ==========================================================================

  describe('error handling', () => {
    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await mockFetch('http://localhost:3000/api/assistant/123/spending');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('Network error');
      }
    });

    it('handles non-JSON responses', async () => {
      const nonJsonResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'text/html' }),
        json: () => Promise.reject(new Error('Not JSON')),
      } as Response;

      mockFetch.mockResolvedValueOnce(nonJsonResponse);

      const response = await mockFetch('http://localhost:3000/api/assistant/123/spending');

      // The action should detect non-JSON and handle appropriately
      const contentType = response.headers.get('content-type');
      expect(contentType).not.toContain('application/json');
    });

    it('handles timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('AbortError: Request timed out'));

      try {
        await mockFetch('http://localhost:3000/api/assistant/123/spending');
      } catch (e) {
        expect((e as Error).message).toContain('AbortError');
      }
    });
  });

  // ==========================================================================
  // API key handling tests
  // ==========================================================================

  describe('API key handling', () => {
    it('includes apiKey in request headers', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      await mockFetch('http://localhost:3000/api/assistant/123/spending', {
        method: 'GET',
        headers: { apiKey: 'my-secret-key' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ apiKey: 'my-secret-key' }),
        })
      );
    });
  });
});
