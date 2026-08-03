import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/assistant/[assistantId]/console-presence/route';
import { buildConsoleGuidance } from '@/lib/agent-guidance/consoleGuidance';

const getApiKeyFromRequestMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/lib/assistants/system-event', () => ({
  dispatchUnitySystemEvent: dispatchMock,
}));

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/assistant/123/console-presence', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = { params: Promise.resolve({ assistantId: '123' }) };

/** The extraEventFields of the single dispatch this route performed. */
function dispatchedFields(): Record<string, unknown> {
  return dispatchMock.mock.calls[0][0].extraEventFields as Record<string, unknown>;
}

describe('console presence route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApiKeyFromRequestMock.mockResolvedValue('user-api-key');
    dispatchMock.mockResolvedValue({ ok: true, status: 202 });
  });

  it('rejects unauthenticated requests', async () => {
    getApiKeyFromRequestMock.mockResolvedValue(null);
    const response = await POST(request({ reason: 'selection' }), params);
    expect(response.status).toBe(401);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('requires a reason', async () => {
    const response = await POST(request({}), params);
    expect(response.status).toBe(400);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric assistant id', async () => {
    const response = await POST(request({ reason: 'selection' }), {
      params: Promise.resolve({ assistantId: 'abc' }),
    });
    expect(response.status).toBe(400);
  });

  it('dispatches a presence event carrying the guidance version', async () => {
    const { version } = buildConsoleGuidance();
    const response = await POST(
      request({ reason: 'activity', source: 'assistant_activity' }),
      params
    );

    expect(response.status).toBe(202);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock.mock.calls[0][0]).toMatchObject({
      assistantId: 123,
      eventType: 'assistant_presence_observed',
    });
    expect(dispatchedFields().consoleGuidanceVersion).toBe(version);
  });

  it.each(['selection', 'keepwarm'])('carries the full text on %s', async (reason) => {
    const guidance = buildConsoleGuidance();
    await POST(request({ reason }), params);

    const fields = dispatchedFields();
    expect(fields.consoleGuidanceBrief).toBe(guidance.brief);
    expect(fields.consoleGuidanceFull).toBe(guidance.full);
  });

  it.each(['activity', 'focus', 'visibility'])(
    'sends version only on %s, keeping heartbeats small',
    async (reason) => {
      await POST(request({ reason }), params);

      const fields = dispatchedFields();
      expect(fields.consoleGuidanceBrief).toBe('');
      expect(fields.consoleGuidanceFull).toBe('');
      expect(fields.consoleGuidanceVersion).not.toBe('');
    }
  );

  it('surfaces a dispatch failure as a bad gateway', async () => {
    dispatchMock.mockResolvedValue({ ok: false, status: 503, detail: 'adapters down' });
    const response = await POST(request({ reason: 'selection' }), params);
    expect(response.status).toBe(502);
  });
});
