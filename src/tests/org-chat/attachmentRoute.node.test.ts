import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/org-chat/attachment/route';

const getApiKeyFromRequestMock = vi.hoisted(() => vi.fn());
const getCurrentUserMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/_utils/auth', () => {
  const jsonResponse = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  return {
    getApiKeyFromRequest: getApiKeyFromRequestMock,
    unauthorized: (message = 'Unauthorized - no API key') => jsonResponse({ error: message }, 401),
    badRequest: (message: string) => jsonResponse({ detail: message }, 400),
    internalError: (message: string) => jsonResponse({ detail: message }, 500),
  };
});

vi.mock('@/lib/user/user', () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock('@/lib/simulation/config', () => ({
  mockSimulationEnabled: () => false,
}));

vi.mock('@/utils/assistants/api-utils', () => ({
  getAdaptersBaseUrl: () => 'https://adapters.test',
}));

const fetchMock = vi.fn();

function request(orgId: string | null): NextRequest {
  const formData = new FormData();
  formData.append('file', new File(['hello'], 'hello.txt', { type: 'text/plain' }));
  if (orgId !== null) {
    formData.append('org_id', orgId);
  }
  return new NextRequest('http://localhost/api/org-chat/attachment', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/org-chat/attachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    process.env.ORCHESTRA_ADMIN_KEY = 'test-admin-key';
    getApiKeyFromRequestMock.mockResolvedValue('user-api-key');
    getCurrentUserMock.mockResolvedValue({
      id: 'user-1',
      organizations: [{ id: 7, name: 'Acme', apiKey: 'org-key' }],
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'att-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('uploads for an organization the caller belongs to', async () => {
    const resp = await POST(request('7'));
    expect(resp.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const forwarded = init.body as FormData;
    expect(forwarded.get('assistant_id')).toBe('org-7');
  });

  it('rejects an organization the caller does not belong to', async () => {
    const resp = await POST(request('8'));
    expect(resp.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects callers without a resolvable user', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const resp = await POST(request('7'));
    expect(resp.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric org id', async () => {
    const resp = await POST(request('not-a-number'));
    expect(resp.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes the storage key to the parsed org id', async () => {
    const resp = await POST(request('007'));
    expect(resp.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    const forwarded = init.body as FormData;
    expect(forwarded.get('assistant_id')).toBe('org-7');
  });
});
