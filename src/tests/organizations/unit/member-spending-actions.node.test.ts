/**
 * Unit tests for member spending server actions.
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

describe('member spending server actions', () => {
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
  // getMemberSpend tests
  // ==========================================================================

  describe('getMemberSpend', () => {
    it('returns spend data on successful response', async () => {
      const { getMemberSpend } = await import('@/lib/organizations/member-spending');

      const mockSpendData = {
        orgId: 1,
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 45.5,
        limit: 100,
        percentUsed: 45.5,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockSpendData));

      const getSpend = await getMemberSpend('test-api-key');
      const result = await getSpend(1, 'user-123', '2026-01');

      expect(result).toEqual(mockSpendData);
      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/organizations/1/members/user-123/spending?month=2026-01');
      expect(options.method).toBe('GET');
      expect(options.headers).toEqual(expect.objectContaining({ apiKey: 'test-api-key' }));
    });

    it('returns zero spend for 404 response', async () => {
      const { getMemberSpend, isMemberSpendData } =
        await import('@/lib/organizations/member-spending');

      mockFetch.mockResolvedValueOnce(createMockResponse({ detail: 'Not found' }, 404));

      const getSpend = await getMemberSpend('test-api-key');
      const result = await getSpend(1, 'user-123', '2026-01');

      expect(isMemberSpendData(result)).toBe(true);
      if (isMemberSpendData(result)) {
        expect(result.cumulativeSpend).toBe(0);
        expect(result.limit).toBeNull();
        expect(result.percentUsed).toBe(0);
      }
    });

    it('uses current month when no month specified', async () => {
      const { getMemberSpend } = await import('@/lib/organizations/member-spending');

      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      const getSpend = await getMemberSpend('test-api-key');
      await getSpend(1, 'user-123');

      const now = new Date();
      const expectedMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`month=${expectedMonth}`),
        expect.any(Object)
      );
    });

    it('encodes userId in URL', async () => {
      const { getMemberSpend } = await import('@/lib/organizations/member-spending');

      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      const getSpend = await getMemberSpend('test-api-key');
      await getSpend(1, 'user@example.com', '2026-01');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(encodeURIComponent('user@example.com'));
    });
  });

  // ==========================================================================
  // getMemberSpendingLimit tests
  // ==========================================================================

  describe('getMemberSpendingLimit', () => {
    it('returns spending limit on successful response', async () => {
      const { getMemberSpendingLimit, isMemberSpendingLimitData } =
        await import('@/lib/organizations/member-spending');

      const mockLimitData = {
        orgId: 1,
        userId: 'user-123',
        monthlySpendingCap: 100,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockLimitData));

      const getLimit = await getMemberSpendingLimit('test-api-key');
      const result = await getLimit(1, 'user-123');

      expect(isMemberSpendingLimitData(result)).toBe(true);
      if (isMemberSpendingLimitData(result)) {
        expect(result.monthlySpendingCap).toBe(100);
        expect(result.orgId).toBe(1);
        expect(result.userId).toBe('user-123');
      }
    });

    it('returns null spending cap for unlimited', async () => {
      const { getMemberSpendingLimit, isMemberSpendingLimitData } =
        await import('@/lib/organizations/member-spending');

      const mockLimitData = {
        orgId: 1,
        userId: 'user-123',
        monthlySpendingCap: null,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockLimitData));

      const getLimit = await getMemberSpendingLimit('test-api-key');
      const result = await getLimit(1, 'user-123');

      expect(isMemberSpendingLimitData(result)).toBe(true);
      if (isMemberSpendingLimitData(result)) {
        expect(result.monthlySpendingCap).toBeNull();
      }
    });

    it('returns error response on failure', async () => {
      const { getMemberSpendingLimit, isMemberSpendingLimitData } =
        await import('@/lib/organizations/member-spending');

      mockFetch.mockResolvedValueOnce(createMockResponse({ detail: 'Access denied' }, 403));

      const getLimit = await getMemberSpendingLimit('test-api-key');
      const result = await getLimit(1, 'user-123');

      expect(isMemberSpendingLimitData(result)).toBe(false);
      expect('detail' in result).toBe(true);
    });
  });

  // ==========================================================================
  // setMemberSpendingLimit tests
  // ==========================================================================

  describe('setMemberSpendingLimit', () => {
    it('sets spending limit successfully', async () => {
      const { setMemberSpendingLimit, isMemberSpendingLimitData } =
        await import('@/lib/organizations/member-spending');

      const mockResponse = {
        orgId: 1,
        userId: 'user-123',
        monthlySpendingCap: 150,
        cascadedUpdates: { assistantsCapped: 2 },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const setLimit = await setMemberSpendingLimit('test-api-key');
      const result = await setLimit(1, 'user-123', { monthlySpendingCap: 150 });

      expect(isMemberSpendingLimitData(result)).toBe(true);
      if (isMemberSpendingLimitData(result)) {
        expect(result.monthlySpendingCap).toBe(150);
      }
      expect('info' in result).toBe(true);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/organizations/1/members/user-123/spending-limit');
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual({ monthlySpendingCap: 150 });
    });

    it('returns error when limit exceeds org limit', async () => {
      const { setMemberSpendingLimit, isMemberSpendingLimitData } =
        await import('@/lib/organizations/member-spending');

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ detail: 'Member limit cannot exceed org limit ($100.00)' }, 400)
      );

      const setLimit = await setMemberSpendingLimit('test-api-key');
      const result = await setLimit(1, 'user-123', { monthlySpendingCap: 500 });

      expect(isMemberSpendingLimitData(result)).toBe(false);
      expect('detail' in result && (result as { detail: string }).detail).toContain(
        'exceed org limit'
      );
    });
  });

  // ==========================================================================
  // removeMemberSpendingLimit tests
  // ==========================================================================

  describe('removeMemberSpendingLimit', () => {
    it('removes spending limit (sets to null)', async () => {
      const { removeMemberSpendingLimit, isMemberSpendingLimitData } =
        await import('@/lib/organizations/member-spending');

      const mockResponse = {
        orgId: 1,
        userId: 'user-123',
        monthlySpendingCap: null,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const removeLimit = await removeMemberSpendingLimit('test-api-key');
      const result = await removeLimit(1, 'user-123');

      expect(isMemberSpendingLimitData(result)).toBe(true);
      if (isMemberSpendingLimitData(result)) {
        expect(result.monthlySpendingCap).toBeNull();
      }

      const [, options] = mockFetch.mock.calls[0];
      expect(JSON.parse(options.body)).toEqual({ monthlySpendingCap: null });
    });
  });
});
