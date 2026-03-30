/**
 * Unit tests for member spending API routes
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to define mock functions that will be available in vi.mock factories
const { mockClientGET, mockClientPUT } = vi.hoisted(() => ({
  mockClientGET: vi.fn(),
  mockClientPUT: vi.fn(),
}));

// Mock dependencies before imports
vi.mock('@/lib/user/user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ apiKey: 'test-api-key', id: 'test-user' }),
}));

vi.mock('@/lib/orchestra/client', () => ({
  createOrchestraClient: vi.fn(() => ({
    GET: mockClientGET,
    PUT: mockClientPUT,
  })),
}));

// Import routes after mocks
import { GET as getSpending } from '@/app/api/organizations/[orgId]/members/[userId]/spending/route';
import {
  GET as getSpendingLimit,
  PUT as putSpendingLimit,
} from '@/app/api/organizations/[orgId]/members/[userId]/spending-limit/route';

describe('Member Spending API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/organizations/[orgId]/members/[userId]/spending', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should return member spending data successfully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            organization_id: 1,
            user_id: 'user-123',
            month: '2026-01',
            cumulative_spend: 45.5,
            limit: 100,
            percent_used: 45.5,
          }),
          { status: 200 }
        )
      );

      const request = new NextRequest(
        'http://localhost/api/organizations/1/members/user-123/spending?month=2026-01',
        {
          headers: { cookie: 'unify_api_key=test-api-key' },
        }
      );
      const params = Promise.resolve({ orgId: '1', userId: 'user-123' });

      const response = await getSpending(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.orgId).toBe(1);
      expect(json.userId).toBe('user-123');
      expect(json.cumulativeSpend).toBe(45.5);
      expect(json.limit).toBe(100);
      expect(json.percentUsed).toBe(45.5);
    });

    it('should return 400 for invalid orgId', async () => {
      const request = new NextRequest(
        'http://localhost/api/organizations/invalid/members/user-123/spending?month=2026-01',
        {
          headers: { cookie: 'unify_api_key=test-api-key' },
        }
      );
      const params = Promise.resolve({ orgId: 'invalid', userId: 'user-123' });

      const response = await getSpending(request, { params });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('Invalid organization ID');
    });

    it('should return 400 for missing month parameter', async () => {
      const request = new NextRequest(
        'http://localhost/api/organizations/1/members/user-123/spending',
        {
          headers: { cookie: 'unify_api_key=test-api-key' },
        }
      );
      const params = Promise.resolve({ orgId: '1', userId: 'user-123' });

      const response = await getSpending(request, { params });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('month');
    });

    it('should return empty spend data for 404 (member not found)', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: 'Member not found' }), { status: 404 })
        );

      const request = new NextRequest(
        'http://localhost/api/organizations/1/members/user-123/spending?month=2026-01',
        {
          headers: { cookie: 'unify_api_key=test-api-key' },
        }
      );
      const params = Promise.resolve({ orgId: '1', userId: 'user-123' });

      const response = await getSpending(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.cumulativeSpend).toBe(0);
      expect(json.limit).toBeNull();
    });
  });

  describe('GET /api/organizations/[orgId]/members/[userId]/spending-limit', () => {
    it('should return member spending limit successfully', async () => {
      // Mock returns camelCase because createOrchestraClient has response middleware
      mockClientGET.mockResolvedValue({
        data: {
          organizationId: 1,
          userId: 'user-123',
          monthlySpendingCap: 100,
        },
        error: null,
        response: { status: 200 },
      });

      const request = new NextRequest(
        'http://localhost/api/organizations/1/members/user-123/spending-limit',
        {
          headers: { cookie: 'unify_api_key=test-api-key' },
        }
      );
      const params = Promise.resolve({ orgId: '1', userId: 'user-123' });

      const response = await getSpendingLimit(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.orgId).toBe(1);
      expect(json.userId).toBe('user-123');
      expect(json.monthlySpendingCap).toBe(100);
    });

    it('should return null spending cap for unlimited', async () => {
      mockClientGET.mockResolvedValue({
        data: {
          organizationId: 1,
          userId: 'user-123',
          monthlySpendingCap: null,
        },
        error: null,
        response: { status: 200 },
      });

      const request = new NextRequest(
        'http://localhost/api/organizations/1/members/user-123/spending-limit',
        {
          headers: { cookie: 'unify_api_key=test-api-key' },
        }
      );
      const params = Promise.resolve({ orgId: '1', userId: 'user-123' });

      const response = await getSpendingLimit(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.monthlySpendingCap).toBeNull();
    });
  });

  describe('PUT /api/organizations/[orgId]/members/[userId]/spending-limit', () => {
    it('should update member spending limit successfully', async () => {
      // Mock returns camelCase because createOrchestraClient has response middleware
      mockClientPUT.mockResolvedValue({
        data: {
          organizationId: 1,
          userId: 'user-123',
          monthlySpendingCap: 150,
          cascadedUpdates: { assistantsCapped: 2 },
        },
        error: null,
        response: { status: 200 },
      });

      const request = new NextRequest(
        'http://localhost/api/organizations/1/members/user-123/spending-limit',
        {
          method: 'PUT',
          headers: {
            cookie: 'unify_api_key=test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ monthlySpendingCap: 150 }),
        }
      );
      const params = Promise.resolve({ orgId: '1', userId: 'user-123' });

      const response = await putSpendingLimit(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.monthlySpendingCap).toBe(150);
      expect(json.cascadedUpdates?.assistantsCapped).toBe(2);
    });

    it('should return 400 for missing monthlySpendingCap', async () => {
      const request = new NextRequest(
        'http://localhost/api/organizations/1/members/user-123/spending-limit',
        {
          method: 'PUT',
          headers: {
            cookie: 'unify_api_key=test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
      const params = Promise.resolve({ orgId: '1', userId: 'user-123' });

      const response = await putSpendingLimit(request, { params });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('monthlySpendingCap');
    });

    it('should return 400 for negative spending limit', async () => {
      const request = new NextRequest(
        'http://localhost/api/organizations/1/members/user-123/spending-limit',
        {
          method: 'PUT',
          headers: {
            cookie: 'unify_api_key=test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ monthlySpendingCap: -50 }),
        }
      );
      const params = Promise.resolve({ orgId: '1', userId: 'user-123' });

      const response = await putSpendingLimit(request, { params });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('non-negative');
    });

    it('should allow setting limit to null (unlimited)', async () => {
      mockClientPUT.mockResolvedValue({
        data: {
          organizationId: 1,
          userId: 'user-123',
          monthlySpendingCap: null,
        },
        error: null,
        response: { status: 200 },
      });

      const request = new NextRequest(
        'http://localhost/api/organizations/1/members/user-123/spending-limit',
        {
          method: 'PUT',
          headers: {
            cookie: 'unify_api_key=test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ monthlySpendingCap: null }),
        }
      );
      const params = Promise.resolve({ orgId: '1', userId: 'user-123' });

      const response = await putSpendingLimit(request, { params });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.monthlySpendingCap).toBeNull();
    });
  });
});
