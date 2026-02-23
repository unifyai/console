/**
 * Unit tests for user spending server actions.
 *
 * These tests verify the server action logic without making actual HTTP calls.
 * They test response handling, error cases, and data transformation.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock process.env
const originalEnv = process.env;

describe('user spending server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NEXTAUTH_URL: 'http://localhost:3000',
    };
    // Re-setup fetch mock after module reset
    global.fetch = mockFetch;
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
  // getUserSpend tests
  // ==========================================================================

  describe('getUserSpend', () => {
    it('returns spend data on successful response', async () => {
      const { getUserSpend } = await import('@/lib/user/spending');

      const mockSpendData = {
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 75.5,
        limit: 200.0,
        percentUsed: 37.75,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockSpendData));

      const getSpend = await getUserSpend('test-api-key');
      const result = await getSpend('2026-01');

      expect(result).toEqual(mockSpendData);
      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/user/spending?month=2026-01');
      expect(options.method).toBe('GET');
      expect(options.headers).toEqual(expect.objectContaining({ apiKey: 'test-api-key' }));
    });

    it('returns zero spend for 404 response', async () => {
      const { getUserSpend, isUserSpendData } = await import('@/lib/user/spending');

      mockFetch.mockResolvedValueOnce(createMockResponse({ detail: 'Not found' }, 404));

      const getSpend = await getUserSpend('test-api-key');
      const result = await getSpend('2026-01');

      expect(isUserSpendData(result)).toBe(true);
      if (isUserSpendData(result)) {
        expect(result.cumulativeSpend).toBe(0);
        expect(result.limit).toBeNull();
        expect(result.percentUsed).toBe(0);
      }
    });

    it('uses current month when no month specified', async () => {
      const { getUserSpend } = await import('@/lib/user/spending');

      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      const getSpend = await getUserSpend('test-api-key');
      await getSpend();

      const now = new Date();
      const expectedMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

      expect(mockFetch).toHaveBeenCalled();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(`month=${expectedMonth}`);
    });

    it('returns error detail on API failure', async () => {
      const { getUserSpend } = await import('@/lib/user/spending');

      mockFetch.mockResolvedValueOnce(createMockResponse({ detail: 'Server error' }, 500));

      const getSpend = await getUserSpend('test-api-key');
      const result = await getSpend('2026-01');

      expect(result).toHaveProperty('detail', 'Server error');
    });

    it('handles network errors gracefully', async () => {
      const { getUserSpend } = await import('@/lib/user/spending');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const getSpend = await getUserSpend('test-api-key');
      const result = await getSpend('2026-01');

      expect(result).toHaveProperty('detail', 'Network error');
    });

    it('handles non-JSON responses', async () => {
      const { getUserSpend } = await import('@/lib/user/spending');

      const nonJsonResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        json: () => Promise.reject(new Error('Not JSON')),
      } as Response;

      mockFetch.mockResolvedValueOnce(nonJsonResponse);

      const getSpend = await getUserSpend('test-api-key');
      const result = await getSpend('2026-01');

      expect(result).toHaveProperty('detail');
    });
  });

  // ==========================================================================
  // getUserSpendingLimit tests
  // ==========================================================================

  describe('getUserSpendingLimit', () => {
    it('returns limit data on successful response', async () => {
      const { getUserSpendingLimit } = await import('@/lib/user/spending');

      const mockLimitData = {
        userId: 'user-123',
        monthlySpendingCap: 200.0,
        assistantsCapped: 0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockLimitData));

      const getLimit = await getUserSpendingLimit('test-api-key');
      const result = await getLimit();

      expect(result).toEqual(mockLimitData);
      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/user/spending-limit');
      expect(options.method).toBe('GET');
      expect(options.headers).toEqual(expect.objectContaining({ apiKey: 'test-api-key' }));
    });

    it('handles null limit (unlimited)', async () => {
      const { getUserSpendingLimit, isUserSpendingLimitData } = await import('@/lib/user/spending');

      const mockLimitData = {
        userId: 'user-123',
        monthlySpendingCap: null,
        assistantsCapped: 0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockLimitData));

      const getLimit = await getUserSpendingLimit('test-api-key');
      const result = await getLimit();

      expect(isUserSpendingLimitData(result)).toBe(true);
      if (isUserSpendingLimitData(result)) {
        expect(result.monthlySpendingCap).toBeNull();
      }
    });

    it('returns error detail on API failure', async () => {
      const { getUserSpendingLimit } = await import('@/lib/user/spending');

      mockFetch.mockResolvedValueOnce(createMockResponse({ detail: 'Unauthorized' }, 401));

      const getLimit = await getUserSpendingLimit('test-api-key');
      const result = await getLimit();

      expect(result).toHaveProperty('detail', 'Unauthorized');
    });
  });

  // ==========================================================================
  // setUserSpendingLimit tests
  // ==========================================================================

  describe('setUserSpendingLimit', () => {
    it('sends correct payload for setting limit', async () => {
      const { setUserSpendingLimit } = await import('@/lib/user/spending');

      const mockResponse = {
        userId: 'user-123',
        monthlySpendingCap: 150.0,
        assistantsCapped: 3,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const setLimit = await setUserSpendingLimit('test-api-key');
      const result = await setLimit({ monthlySpendingCap: 150.0 });

      expect(result).toHaveProperty('info', 'User spending limit updated successfully.');
      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/user/spending-limit');
      expect(options.method).toBe('PUT');
      expect(options.headers).toEqual(
        expect.objectContaining({
          apiKey: 'test-api-key',
          'Content-Type': 'application/json',
        })
      );
      expect(options.body).toBe(JSON.stringify({ monthlySpendingCap: 150.0 }));
    });

    it('sends null payload for removing limit', async () => {
      const { setUserSpendingLimit } = await import('@/lib/user/spending');

      const mockResponse = {
        userId: 'user-123',
        monthlySpendingCap: null,
        assistantsCapped: 0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const setLimit = await setUserSpendingLimit('test-api-key');
      await setLimit({ monthlySpendingCap: null });

      expect(mockFetch).toHaveBeenCalled();
      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toBe(JSON.stringify({ monthlySpendingCap: null }));
    });

    it('returns error detail on validation failure', async () => {
      const { setUserSpendingLimit } = await import('@/lib/user/spending');

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ detail: 'Limit must be non-negative' }, 400)
      );

      const setLimit = await setUserSpendingLimit('test-api-key');
      const result = await setLimit({ monthlySpendingCap: -50 });

      expect(result).toHaveProperty('detail', 'Limit must be non-negative');
    });
  });

  // ==========================================================================
  // removeUserSpendingLimit tests
  // ==========================================================================

  describe('removeUserSpendingLimit', () => {
    it('calls setUserSpendingLimit with null', async () => {
      const { removeUserSpendingLimit } = await import('@/lib/user/spending');

      const mockResponse = {
        userId: 'user-123',
        monthlySpendingCap: null,
        assistantsCapped: 0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const removeLimit = await removeUserSpendingLimit('test-api-key');
      const result = await removeLimit();

      expect(result).toHaveProperty('info', 'User spending limit updated successfully.');
      expect(mockFetch).toHaveBeenCalled();
      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toBe(JSON.stringify({ monthlySpendingCap: null }));
    });
  });

  // ==========================================================================
  // API key handling tests
  // ==========================================================================

  describe('API key handling', () => {
    it('includes apiKey in getUserSpend request headers', async () => {
      const { getUserSpend } = await import('@/lib/user/spending');
      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      const getSpend = await getUserSpend('secret-key-1');
      await getSpend('2026-01');

      expect(mockFetch).toHaveBeenCalled();
      const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(options.headers).toEqual(expect.objectContaining({ apiKey: 'secret-key-1' }));
    });

    it('includes apiKey in getUserSpendingLimit request headers', async () => {
      const { getUserSpendingLimit } = await import('@/lib/user/spending');
      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      const getLimit = await getUserSpendingLimit('secret-key-2');
      await getLimit();

      expect(mockFetch).toHaveBeenCalled();
      const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(options.headers).toEqual(expect.objectContaining({ apiKey: 'secret-key-2' }));
    });

    it('includes apiKey in setUserSpendingLimit request headers', async () => {
      const { setUserSpendingLimit } = await import('@/lib/user/spending');
      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      const setLimit = await setUserSpendingLimit('secret-key-3');
      await setLimit({ monthlySpendingCap: 100 });

      expect(mockFetch).toHaveBeenCalled();
      const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(options.headers).toEqual(expect.objectContaining({ apiKey: 'secret-key-3' }));
    });
  });
});
