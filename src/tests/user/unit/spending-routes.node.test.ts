/**
 * Tests for User Spending API Routes
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { AxiosError } from 'axios';

// Create mock for OrchestraAdminClient
const mockAdminClientGet = vi.fn();
vi.mock('@/lib/orchestra/orchestra-client', () => ({
  OrchestraAdminClient: {
    get: mockAdminClientGet,
  },
}));

// Mock user module
vi.mock('@/lib/user/user', () => ({
  getCurrentUser: vi.fn(),
}));

// Mock Orchestra client - returns a mock client with GET method
const mockUserClientGet = vi.fn();
vi.mock('@/lib/orchestra/client', () => ({
  createOrchestraClient: vi.fn(() => ({
    GET: mockUserClientGet,
  })),
}));

// Mock auth utilities
vi.mock('@/app/api/_utils/auth', () => ({
  getApiKeyFromRequest: vi.fn(),
  unauthorized: vi.fn(
    () => new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 })
  ),
  badRequest: vi.fn(
    (msg: string) => new Response(JSON.stringify({ detail: msg }), { status: 400 })
  ),
}));

// Pre-import modules to ensure mocks are applied
import { getCurrentUser } from '@/lib/user/user';
import { getApiKeyFromRequest } from '@/app/api/_utils/auth';
import { createOrchestraClient } from '@/lib/orchestra/client';

describe('GET /api/user/spending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Default: mock user client to return user info from /user/basic-info
    // Note: response is transformed from snake_case to camelCase by middleware
    mockUserClientGet.mockResolvedValue({
      data: { userId: 'user-123', email: 'test@example.com' },
      error: null,
    });
  });

  it('returns 401 when API key is not provided', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue(null);

    const { GET } = await import('@/app/api/user/spending/route');
    const request = new NextRequest('http://localhost/api/user/spending?month=2026-01');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns 400 when month parameter is missing', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue('test-api-key');

    const { GET } = await import('@/app/api/user/spending/route');
    const request = new NextRequest('http://localhost/api/user/spending');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('month');
  });

  it('returns 400 when month format is invalid', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue('test-api-key');

    const { GET } = await import('@/app/api/user/spending/route');
    const request = new NextRequest('http://localhost/api/user/spending?month=invalid');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('YYYY-MM');
  });

  it('returns zero spend for 404 from Orchestra', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue('test-api-key');

    // Mock AxiosError with 404 status
    const axiosError = new AxiosError('Not Found');
    axiosError.response = {
      status: 404,
      data: { detail: 'Not found' },
      statusText: 'Not Found',
      headers: {},
      config: {} as any,
    };
    mockAdminClientGet.mockRejectedValue(axiosError);

    const { GET } = await import('@/app/api/user/spending/route');
    const request = new NextRequest('http://localhost/api/user/spending?month=2026-01');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.cumulativeSpend).toBe(0);
    expect(data.userId).toBe('user-123');
  });

  it('returns spending data from OrchestraAdminClient (already camelCase)', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue('test-api-key');

    // OrchestraAdminClient automatically transforms response to camelCase
    mockAdminClientGet.mockResolvedValue({
      data: {
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 50.0,
        limit: 100.0,
        percentUsed: 50.0,
      },
    });

    const { GET } = await import('@/app/api/user/spending/route');
    const request = new NextRequest('http://localhost/api/user/spending?month=2026-01');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.userId).toBe('user-123');
    expect(data.cumulativeSpend).toBe(50.0);
    expect(data.percentUsed).toBe(50.0);

    // Verify the admin client was called with correct path and params
    expect(mockAdminClientGet).toHaveBeenCalledWith('/user/user-123/spend', {
      params: { month: '2026-01' },
    });
  });
});

describe('GET /api/user/spending-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when API key is missing', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue(null);

    const { GET } = await import('@/app/api/user/spending-limit/route');
    const request = new NextRequest('http://localhost/api/user/spending-limit');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns spending limit from Orchestra', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue('test-api-key');

    const mockClient = {
      GET: vi.fn().mockResolvedValue({
        data: { user_id: 'user-123', monthly_spending_cap: 100.0, assistants_capped: 0 },
        error: null,
        response: { status: 200 },
      }),
    };

    vi.mocked(createOrchestraClient).mockReturnValue(mockClient as any);

    const { GET } = await import('@/app/api/user/spending-limit/route');
    const request = new NextRequest('http://localhost/api/user/spending-limit');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.monthlySpendingCap).toBe(100.0);
  });
});

describe('PUT /api/user/spending-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when API key is missing', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue(null);

    const { PUT } = await import('@/app/api/user/spending-limit/route');
    const request = new NextRequest('http://localhost/api/user/spending-limit', {
      method: 'PUT',
      body: JSON.stringify({ monthlySpendingCap: 100 }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(401);
  });

  it('returns 400 when monthlySpendingCap is missing', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue('test-api-key');

    const { PUT } = await import('@/app/api/user/spending-limit/route');
    const request = new NextRequest('http://localhost/api/user/spending-limit', {
      method: 'PUT',
      body: JSON.stringify({}),
    });
    const response = await PUT(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when monthlySpendingCap is negative', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue('test-api-key');

    const { PUT } = await import('@/app/api/user/spending-limit/route');
    const request = new NextRequest('http://localhost/api/user/spending-limit', {
      method: 'PUT',
      body: JSON.stringify({ monthlySpendingCap: -10 }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(400);
  });

  it('updates spending limit successfully', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue('test-api-key');

    const mockClient = {
      PUT: vi.fn().mockResolvedValue({
        data: { user_id: 'user-123', monthly_spending_cap: 150.0, assistants_capped: 2 },
        error: null,
        response: { status: 200 },
      }),
    };

    vi.mocked(createOrchestraClient).mockReturnValue(mockClient as any);

    const { PUT } = await import('@/app/api/user/spending-limit/route');
    const request = new NextRequest('http://localhost/api/user/spending-limit', {
      method: 'PUT',
      body: JSON.stringify({ monthlySpendingCap: 150 }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.monthlySpendingCap).toBe(150.0);
    expect(data.assistantsCapped).toBe(2);
    expect(data.info).toContain('successfully');
  });

  it('allows setting limit to null (unlimited)', async () => {
    vi.mocked(getApiKeyFromRequest).mockResolvedValue('test-api-key');

    const mockClient = {
      PUT: vi.fn().mockResolvedValue({
        data: { user_id: 'user-123', monthly_spending_cap: null, assistants_capped: 0 },
        error: null,
        response: { status: 200 },
      }),
    };

    vi.mocked(createOrchestraClient).mockReturnValue(mockClient as any);

    const { PUT } = await import('@/app/api/user/spending-limit/route');
    const request = new NextRequest('http://localhost/api/user/spending-limit', {
      method: 'PUT',
      body: JSON.stringify({ monthlySpendingCap: null }),
    });
    const response = await PUT(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.monthlySpendingCap).toBeNull();
  });
});
