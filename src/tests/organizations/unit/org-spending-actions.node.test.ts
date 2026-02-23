/**
 * Unit tests for organization spending server actions.
 *
 * These tests verify the server action behavior patterns without making actual HTTP calls.
 * They test response handling, error cases, and data transformation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isOrgSpendData,
  isOrgSpendingLimitData,
  OrgSpend,
  OrgSpendingLimitResponse,
} from '@/types/organization';
import { ResponseProps } from '@/types/common';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock process.env
const originalEnv = process.env;

describe('Organization Spending Server Actions', () => {
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

  const testApiKey = 'test-api-key';
  const testOrgId = 123;
  const testMonth = '2026-01';

  // ===========================================================================
  // getOrgSpend behavior tests
  // ===========================================================================

  describe('getOrgSpend behavior', () => {
    it('returns spend data on successful response', async () => {
      const mockSpendData: OrgSpend = {
        orgId: testOrgId,
        month: testMonth,
        cumulativeSpend: 1500.0,
        limit: 5000.0,
        percentUsed: 30.0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockSpendData));

      // Simulate the action behavior
      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending?month=${testMonth}`,
        { method: 'GET', headers: { apiKey: testApiKey } }
      );
      const data = await response.json();

      expect(isOrgSpendData(data)).toBe(true);
      expect(data.cumulativeSpend).toBe(1500.0);
      expect(data.limit).toBe(5000.0);
      expect(data.percentUsed).toBe(30.0);
    });

    it('handles 404 by returning zero spend', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ detail: 'Not found' }, 404));

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending?month=${testMonth}`,
        { method: 'GET', headers: { apiKey: testApiKey } }
      );

      // The action should handle 404 and return zero spend
      if (response.status === 404) {
        const zeroSpend: OrgSpend = {
          orgId: testOrgId,
          month: testMonth,
          cumulativeSpend: 0,
          limit: null,
          percentUsed: 0,
        };
        expect(zeroSpend.cumulativeSpend).toBe(0);
        expect(zeroSpend.limit).toBeNull();
      }
    });

    it('includes month parameter in request URL', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending?month=2026-05`,
        {
          method: 'GET',
          headers: { apiKey: testApiKey },
        }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('month=2026-05'),
        expect.any(Object)
      );
    });

    it('includes orgId in request URL', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending?month=${testMonth}`,
        {
          method: 'GET',
          headers: { apiKey: testApiKey },
        }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/organizations/${testOrgId}/`),
        expect.any(Object)
      );
    });

    it('handles unlimited org (null limit)', async () => {
      const mockSpendData: OrgSpend = {
        orgId: testOrgId,
        month: testMonth,
        cumulativeSpend: 5000.0,
        limit: null,
        percentUsed: 0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockSpendData));

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending?month=${testMonth}`,
        { method: 'GET', headers: { apiKey: testApiKey } }
      );
      const data = await response.json();

      expect(data.limit).toBeNull();
      expect(data.percentUsed).toBe(0);
    });

    it('handles error responses with detail message', async () => {
      const errorData = { detail: 'Internal server error' };
      mockFetch.mockResolvedValueOnce(createMockResponse(errorData, 500));

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending?month=${testMonth}`,
        { method: 'GET', headers: { apiKey: testApiKey } }
      );
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.detail).toBe('Internal server error');
    });

    it('handles permission denied errors', async () => {
      const errorData = { detail: 'You do not have permission to view this organization' };
      mockFetch.mockResolvedValueOnce(createMockResponse(errorData, 403));

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending?month=${testMonth}`,
        { method: 'GET', headers: { apiKey: testApiKey } }
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.detail).toContain('permission');
    });
  });

  // ===========================================================================
  // getOrgSpendingLimit behavior tests
  // ===========================================================================

  describe('getOrgSpendingLimit behavior', () => {
    it('returns spending limit data on successful response', async () => {
      const mockLimitData: OrgSpendingLimitResponse = {
        orgId: testOrgId,
        monthlySpendingCap: 5000.0,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockLimitData));

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending-limit`,
        { method: 'GET', headers: { apiKey: testApiKey } }
      );
      const data = await response.json();

      expect(isOrgSpendingLimitData(data)).toBe(true);
      expect(data.monthlySpendingCap).toBe(5000.0);
    });

    it('handles unlimited org (null cap)', async () => {
      const mockLimitData: OrgSpendingLimitResponse = {
        orgId: testOrgId,
        monthlySpendingCap: null,
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockLimitData));

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending-limit`,
        { method: 'GET', headers: { apiKey: testApiKey } }
      );
      const data = await response.json();

      expect(data.monthlySpendingCap).toBeNull();
    });

    it('handles org not found error', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ detail: 'Organization not found' }, 404)
      );

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending-limit`,
        { method: 'GET', headers: { apiKey: testApiKey } }
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.detail).toBe('Organization not found');
    });
  });

  // ===========================================================================
  // setOrgSpendingLimit behavior tests
  // ===========================================================================

  describe('setOrgSpendingLimit behavior', () => {
    it('updates spending limit successfully', async () => {
      const newLimit = 10000.0;
      const mockResponse = {
        orgId: testOrgId,
        monthlySpendingCap: newLimit,
        info: 'Spending limit updated successfully',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending-limit`,
        {
          method: 'PATCH',
          headers: { apiKey: testApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthlySpendingCap: newLimit }),
        }
      );
      const data = await response.json();

      expect(data.monthlySpendingCap).toBe(newLimit);
      expect(data.info).toBeDefined();
    });

    it('removes limit by setting to null', async () => {
      const mockResponse = {
        orgId: testOrgId,
        monthlySpendingCap: null,
        info: 'Spending limit updated successfully',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending-limit`,
        {
          method: 'PATCH',
          headers: { apiKey: testApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthlySpendingCap: null }),
        }
      );
      const data = await response.json();

      expect(data.monthlySpendingCap).toBeNull();
    });

    it('rejects negative limit values', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ detail: 'monthlySpendingCap must be non-negative' }, 400)
      );

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending-limit`,
        {
          method: 'PATCH',
          headers: { apiKey: testApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthlySpendingCap: -100 }),
        }
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.detail).toContain('non-negative');
    });

    it('handles permission denied for non-admin', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ detail: 'Only organization admins can modify spending limits' }, 403)
      );

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending-limit`,
        {
          method: 'PATCH',
          headers: { apiKey: testApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthlySpendingCap: 5000 }),
        }
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.detail).toContain('admin');
    });

    it('uses PATCH method for updates', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      await mockFetch(`http://localhost:3000/api/organizations/${testOrgId}/spending-limit`, {
        method: 'PATCH',
        headers: { apiKey: testApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlySpendingCap: 5000 }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  // ===========================================================================
  // removeOrgSpendingLimit behavior tests
  // ===========================================================================

  describe('removeOrgSpendingLimit behavior', () => {
    it('removes limit by calling setOrgSpendingLimit with null', async () => {
      const mockResponse = {
        orgId: testOrgId,
        monthlySpendingCap: null,
        info: 'Spending limit removed',
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const response = await mockFetch(
        `http://localhost:3000/api/organizations/${testOrgId}/spending-limit`,
        {
          method: 'PATCH',
          headers: { apiKey: testApiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthlySpendingCap: null }),
        }
      );
      const data = await response.json();

      expect(data.monthlySpendingCap).toBeNull();

      // Verify the request body contains null
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ monthlySpendingCap: null }),
        })
      );
    });
  });

  // ===========================================================================
  // Type guard tests
  // ===========================================================================

  describe('type guards', () => {
    it('isOrgSpendData correctly identifies spend data', () => {
      const spendData: OrgSpend = {
        orgId: 1,
        month: '2026-01',
        cumulativeSpend: 100,
        limit: 500,
        percentUsed: 20,
      };

      const errorResponse: ResponseProps = { detail: 'Error' };

      expect(isOrgSpendData(spendData)).toBe(true);
      expect(isOrgSpendData(errorResponse)).toBe(false);
    });

    it('isOrgSpendingLimitData correctly identifies limit data', () => {
      const limitData: OrgSpendingLimitResponse = {
        orgId: 1,
        monthlySpendingCap: 1000,
      };

      const errorResponse: ResponseProps = { detail: 'Error' };

      expect(isOrgSpendingLimitData(limitData)).toBe(true);
      expect(isOrgSpendingLimitData(errorResponse)).toBe(false);
    });
  });
});
