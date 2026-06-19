import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/user/user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

import { GET, PATCH, POST } from '@/app/api/integrations/provider/[...path]/route';
import {
  PATCH as ADMIN_PATCH,
  POST as ADMIN_POST,
} from '@/app/api/integrations/provider-admin/[...path]/route';

describe('provider integration proxy route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ORCHESTRA_URL = 'http://127.0.0.1:8000/v0';
    process.env.ORCHESTRA_ADMIN_KEY = 'orchestra-admin-key';
  });

  it('does not proxy app catalog GET paths to Orchestra', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const request = new NextRequest(
      'http://localhost/api/integrations/provider/apps?owner_scope=assistant&assistant_id=123&query=slack&source_type=third_party&status_group=connected&detail_level=summary&limit=50&offset=0',
      { headers: { apiKey: 'test-api-key' } }
    );

    const response = await GET(request, { params: Promise.resolve({ path: ['apps'] }) });

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      detail: expect.stringContaining('Builtins logs'),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards POST body to the matching Orchestra path', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const request = new NextRequest(
      'http://localhost/api/integrations/provider/connect/start?source=console',
      {
        method: 'POST',
        headers: { apiKey: 'test-api-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonical_app_slug: 'slack' }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ['connect', 'start'] }),
    });

    expect(response.status).toBe(200);
    const [target, init] = fetchSpy.mock.calls[0];
    expect(String(target)).toBe(
      'http://127.0.0.1:8000/v0/integrations/connect/start?source=console'
    );
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ canonical_app_slug: 'slack' }),
    });
  });

  it('forwards PATCH body to the matching Orchestra path', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ policies: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const request = new NextRequest(
      'http://localhost/api/integrations/provider/connections/ic_123/tool-policy',
      {
        method: 'PATCH',
        headers: { apiKey: 'test-api-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk_approval_level: 'forbidden' }),
      }
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ path: ['connections', 'ic_123', 'tool-policy'] }),
    });

    expect(response.status).toBe(200);
    const [target, init] = fetchSpy.mock.calls[0];
    expect(String(target)).toBe(
      'http://127.0.0.1:8000/v0/integrations/connections/ic_123/tool-policy'
    );
    expect(init).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ bulk_approval_level: 'forbidden' }),
    });
  });

  it('blocks app detail catalog reads but forwards pending cancel paths', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const detailRequest = new NextRequest(
      'http://localhost/api/integrations/provider/apps/discord?owner_scope=assistant&assistant_id=123',
      { headers: { apiKey: 'test-api-key' } }
    );

    const detailResponse = await GET(detailRequest, {
      params: Promise.resolve({ path: ['apps', 'discord'] }),
    });

    expect(detailResponse.status).toBe(410);
    expect(fetchSpy).not.toHaveBeenCalled();

    const cancelRequest = new NextRequest(
      'http://localhost/api/integrations/provider/connections/ic_pending/cancel',
      { method: 'POST', headers: { apiKey: 'test-api-key' } }
    );

    await POST(cancelRequest, {
      params: Promise.resolve({ path: ['connections', 'ic_pending', 'cancel'] }),
    });

    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      'http://127.0.0.1:8000/v0/integrations/connections/ic_pending/cancel'
    );
  });

  it('forwards admin provider setup requests with the Orchestra admin key', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ apps_upserted: 1, tools_upserted: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const request = new NextRequest('http://localhost/api/integrations/provider-admin/sync', {
      method: 'POST',
      headers: { apiKey: 'admin-api-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ backend_id: 'pipedream', apps: [], tools: [] }),
    });

    const response = await ADMIN_POST(request, { params: Promise.resolve({ path: ['sync'] }) });

    expect(response.status).toBe(200);
    const [target, init] = fetchSpy.mock.calls[0];
    expect(String(target)).toBe('http://127.0.0.1:8000/v0/admin/integrations/sync');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer orchestra-admin-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ backend_id: 'pipedream', apps: [], tools: [] }),
    });
  });

  it('forwards live catalog sync through the admin proxy', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ apps_upserted: 20, tools_upserted: 40 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const request = new NextRequest('http://localhost/api/integrations/provider-admin/sync', {
      method: 'POST',
      headers: { apiKey: 'caller-api-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backend_id: 'composio',
        app_slugs: ['DISCORD'],
        tool_limit_per_app: 10,
      }),
    });

    const response = await ADMIN_POST(request, { params: Promise.resolve({ path: ['sync'] }) });

    expect(response.status).toBe(200);
    const [target, init] = fetchSpy.mock.calls[0];
    expect(String(target)).toBe('http://127.0.0.1:8000/v0/admin/integrations/sync');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer orchestra-admin-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        backend_id: 'composio',
        app_slugs: ['DISCORD'],
        tool_limit_per_app: 10,
      }),
    });
  });

  it('forwards backend PATCH and Pipedream sync through the admin proxy', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ status: 'enabled' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    const patchRequest = new NextRequest(
      'http://localhost/api/integrations/provider-admin/backends/pipedream',
      {
        method: 'PATCH',
        headers: { apiKey: 'caller-api-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'enabled' }),
      }
    );

    const patchResponse = await ADMIN_PATCH(patchRequest, {
      params: Promise.resolve({ path: ['backends', 'pipedream'] }),
    });

    expect(patchResponse.status).toBe(200);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      'http://127.0.0.1:8000/v0/admin/integrations/backends/pipedream'
    );
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ status: 'enabled' }),
    });

    const syncRequest = new NextRequest('http://localhost/api/integrations/provider-admin/sync', {
      method: 'POST',
      headers: { apiKey: 'caller-api-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backend_id: 'pipedream',
        app_slugs: ['slack'],
        component_limit_per_app: 10,
      }),
    });

    await ADMIN_POST(syncRequest, { params: Promise.resolve({ path: ['sync'] }) });

    expect(String(fetchSpy.mock.calls[1][0])).toBe(
      'http://127.0.0.1:8000/v0/admin/integrations/sync'
    );
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        backend_id: 'pipedream',
        app_slugs: ['slack'],
        component_limit_per_app: 10,
      }),
    });
  });
});
