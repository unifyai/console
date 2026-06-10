import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/assistant/[assistantId]/system-event/route';

const getApiKeyFromRequestMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/_utils/auth', () => {
  const jsonResponse = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  return {
    getApiKeyFromRequest: getApiKeyFromRequestMock,
    unauthorized: (message = 'Unauthorized - no API key') => jsonResponse({ error: message }, 401),
    badRequest: (message: string) => jsonResponse({ error: message }, 400),
    internalError: (message = 'Internal server error') => jsonResponse({ error: message }, 500),
  };
});

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/assistant/123/system-event', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('assistant system-event route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getApiKeyFromRequestMock.mockResolvedValue('user-api-key');
    process.env.ORCHESTRA_ADMIN_KEY = 'admin-key';
    process.env.ORCHESTRA_URL = 'http://127.0.0.1:8000/v0';
    process.env.LOCAL_ADAPTERS_URL = 'http://127.0.0.1:8081';
  });

  it('rejects unauthenticated requests', async () => {
    getApiKeyFromRequestMock.mockResolvedValue(null);

    const response = await POST(request({ eventType: 'integration_tools_sync_requested' }), {
      params: { assistantId: '123' },
    });

    expect(response.status).toBe(401);
  });

  it('validates eventType', async () => {
    const response = await POST(request({ message: 'missing event type' }), {
      params: { assistantId: '123' },
    });

    expect(response.status).toBe(400);
  });

  it('forwards system events with extra_event_fields through local adapters', async () => {
    const fetchSpy = vi.fn(async () => {
      return new Response(JSON.stringify({ accepted: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const response = await POST(
      request({
        eventType: 'integration_tools_sync_requested',
        message: 'Slack connected',
        extraEventFields: {
          appSlug: 'slack',
          connectionId: 'conn-slack',
        },
      }),
      { params: { assistantId: '123' } }
    );

    expect(response.status).toBe(202);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:8081/unity/system-event',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          assistant_id: 123,
          event_type: 'integration_tools_sync_requested',
          message: 'Slack connected',
          extra_event_fields: {
            app_slug: 'slack',
            connection_id: 'conn-slack',
          },
        }),
      })
    );
  });

  it('returns a gateway error when adapters reject the event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('adapter unavailable', { status: 503 }))
    );

    const response = await POST(request({ eventType: 'integration_tools_sync_requested' }), {
      params: { assistantId: '123' },
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.detail).toBe('adapter unavailable');
  });
});
