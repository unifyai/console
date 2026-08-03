import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/user/api-keys/route';

const getApiKeyFromRequestMock = vi.hoisted(() => vi.fn());
const orchestraGetMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/_utils/auth', () => {
  const jsonResponse = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  return {
    getApiKeyFromRequest: getApiKeyFromRequestMock,
    unauthorized: (message = 'Unauthorized - no API key') => jsonResponse({ error: message }, 401),
  };
});

vi.mock('@/lib/orchestra/orchestra-client', () => ({
  getOrchestraUserClient: vi.fn(async () => ({ get: orchestraGetMock })),
}));

function request(): NextRequest {
  return new NextRequest('http://localhost/api/user/api-keys', { method: 'GET' });
}

/** Wire the two upstream calls this route makes, by path. */
function orchestraReturns({ keys, gate }: { keys?: unknown; gate?: unknown | Error }) {
  orchestraGetMock.mockImplementation(async (path: string) => {
    if (path === '/api-keys') {
      return { data: keys ?? { personal_keys: [] } };
    }
    if (path === '/billing/access-gate') {
      if (gate instanceof Error) throw gate;
      return { data: gate ?? {} };
    }
    throw new Error(`unexpected path ${path}`);
  });
}

describe('GET /api/user/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiKeyFromRequestMock.mockResolvedValue('user-api-key');
  });

  it('returns the user programmatic keys', async () => {
    orchestraReturns({
      keys: { personal_keys: [{ id: 1, name: 'Default', key: 'sk-visible' }] },
      gate: { api_access_allowed: true },
    });

    const body = await (await GET(request())).json();

    expect(body.personalKeys).toEqual([{ id: 1, name: 'Default', key: 'sk-visible' }]);
    expect(body.apiAccessAllowed).toBe(true);
  });

  it('reports when the key exists but is gated', async () => {
    // The case Profile has to explain: a valid key whose every call is
    // refused with 402 until the account has paid.
    orchestraReturns({
      keys: { personal_keys: [{ id: 1, name: 'Default', key: 'sk-visible' }] },
      gate: { api_access_allowed: false },
    });

    const body = await (await GET(request())).json();

    expect(body.personalKeys).toHaveLength(1);
    expect(body.apiAccessAllowed).toBe(false);
  });

  it('still returns the keys when the gate lookup fails', async () => {
    // The keys are the point of this route. A gate lookup that throws
    // must not blank the page the user came here for.
    orchestraReturns({
      keys: { personal_keys: [{ id: 1, name: 'Default', key: 'sk-visible' }] },
      gate: new Error('orchestra unavailable'),
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.personalKeys).toHaveLength(1);
    expect(body.apiAccessAllowed).toBe(true);
  });

  it('assumes access is allowed when the field is absent', async () => {
    // An older Orchestra omits it. Defaulting the other way would have
    // the Console announce a restriction that is not in force.
    orchestraReturns({
      keys: { personal_keys: [{ id: 1, name: 'Default', key: 'sk-visible' }] },
      gate: {},
    });

    const body = await (await GET(request())).json();

    expect(body.apiAccessAllowed).toBe(true);
  });

  it('401s without a session', async () => {
    getApiKeyFromRequestMock.mockResolvedValue(null);

    expect((await GET(request())).status).toBe(401);
  });

  it('propagates an upstream failure to load keys', async () => {
    orchestraGetMock.mockImplementation(async () => {
      const err: any = new Error('boom');
      err.response = { status: 503, data: { detail: 'upstream down' } };
      throw err;
    });

    const response = await GET(request());

    expect(response.status).toBe(503);
  });
});
