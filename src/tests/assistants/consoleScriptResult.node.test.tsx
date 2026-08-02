import { renderHook, act, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConsoleScriptReporter } from '@/hooks/Assistants/useConsoleScriptReporter';
import type { reportConsoleScriptResult } from '@/lib/client/console-script-result';
import { scriptFailed, isFailure } from '@/lib/agent-guidance/consoleScriptOutcome';
import { POST } from '@/app/api/assistant/[assistantId]/console-script-result/route';

const getApiKeyFromRequestMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/_utils/auth', () => {
  const json = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), { status });
  return {
    getApiKeyFromRequest: getApiKeyFromRequestMock,
    unauthorized: () => json({ error: 'no' }, 401),
    badRequest: (m: string) => json({ error: m }, 400),
    internalError: (m: string) => json({ error: m }, 500),
  };
});

vi.mock('@/lib/assistants/system-event', () => ({
  dispatchUnitySystemEvent: dispatchMock,
}));

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/assistant/123/console-script-result', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = { params: Promise.resolve({ assistantId: '123' }) };

beforeEach(() => {
  vi.clearAllMocks();
  getApiKeyFromRequestMock.mockResolvedValue('key');
  dispatchMock.mockResolvedValue({ ok: true, status: 202 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('classifying an outcome', () => {
  it('treats a move that could not be made as a failure', () => {
    expect(isFailure('not-found')).toBe(true);
    expect(isFailure('not-interactive')).toBe(true);
    expect(isFailure('unknown')).toBe(true);
  });

  it('does not treat a move that correctly did not happen as one', () => {
    // Being interrupted, or told not to navigate, is not a fault to report.
    expect(isFailure('skipped')).toBe(false);
    expect(isFailure('blocked')).toBe(false);
  });

  it('does not treat success as one', () => {
    expect(isFailure('done')).toBe(false);
    expect(isFailure('clicked')).toBe(false);
  });

  it('flags a script where any single move failed', () => {
    expect(
      scriptFailed([
        { target: 'section:integrations', outcome: 'done' },
        { target: 'leaf:contact:42', outcome: 'not-found' },
      ])
    ).toBe(true);
  });
});

/**
 * A script's moves land seconds apart, so reporting each separately would be a
 * stream of near-identical events. One report per script is the shape the
 * assistant would want to talk about.
 */
describe('collecting a script before reporting it', () => {
  it('sends once for a whole script rather than once per move', async () => {
    const send: typeof reportConsoleScriptResult = vi.fn(async () => undefined);
    const { result } = renderHook(() => useConsoleScriptReporter('a1', { send, flushMs: 20 }));

    act(() => {
      result.current.record('s1', 'section:integrations', 'done');
      result.current.record('s1', 'leaf:integration:github', 'clicked');
    });

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(vi.mocked(send).mock.calls[0][0]).toMatchObject({
      assistantId: 'a1',
      scriptId: 's1',
      reports: [
        { target: 'section:integrations', outcome: 'done' },
        { target: 'leaf:integration:github', outcome: 'clicked' },
      ],
    });
  });

  it('does not report until the moves stop arriving', async () => {
    const send: typeof reportConsoleScriptResult = vi.fn(async () => undefined);
    const { result } = renderHook(() => useConsoleScriptReporter('a1', { send, flushMs: 40 }));

    act(() => result.current.record('s1', 'section:chat', 'done'));
    expect(send).not.toHaveBeenCalled();

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });

  it('closes off the previous script when a new one starts', async () => {
    // The old script's moves are over either way; holding them back would
    // attribute them to the line now being spoken.
    const send: typeof reportConsoleScriptResult = vi.fn(async () => undefined);
    const { result } = renderHook(() => useConsoleScriptReporter('a1', { send, flushMs: 5000 }));

    act(() => {
      result.current.record('s1', 'section:chat', 'done');
      result.current.record('s2', 'section:tasks', 'done');
    });

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(vi.mocked(send).mock.calls[0][0]).toMatchObject({ scriptId: 's1' });
  });

  it('reports what it has when the user navigates away mid-script', async () => {
    const send: typeof reportConsoleScriptResult = vi.fn(async () => undefined);
    const { result, unmount } = renderHook(() =>
      useConsoleScriptReporter('a1', { send, flushMs: 5000 })
    );

    act(() => result.current.record('s1', 'section:chat', 'done'));
    unmount();

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  });

  it('says nothing when there is no teammate to tell', async () => {
    const send: typeof reportConsoleScriptResult = vi.fn(async () => undefined);
    const { result } = renderHook(() => useConsoleScriptReporter(null, { send, flushMs: 20 }));

    act(() => result.current.record('s1', 'section:chat', 'done'));

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(send).not.toHaveBeenCalled();
  });
});

/**
 * The body arrives from the browser and ends up in a prompt, so the route
 * validates rather than forwards.
 */
describe('the report route', () => {
  it('forwards a well-formed report', async () => {
    const response = await POST(
      request({
        scriptId: 's1',
        outcomes: [{ target: 'section:integrations', outcome: 'done' }],
      }),
      params
    );

    expect(response.status).toBe(202);
    expect(dispatchMock.mock.calls[0][0]).toMatchObject({
      assistantId: 123,
      eventType: 'console_script_result',
    });
  });

  it('rejects unauthenticated reports', async () => {
    getApiKeyFromRequestMock.mockResolvedValue(null);
    const response = await POST(request({ outcomes: [] }), params);
    expect(response.status).toBe(401);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('drops an outcome this console does not recognise', async () => {
    const response = await POST(
      request({
        scriptId: 's1',
        outcomes: [{ target: 'section:chat', outcome: 'exploded' }],
      }),
      params
    );
    expect(response.status).toBe(400);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('drops a target this console never offered', async () => {
    // A report naming an id we would never act on is not describing anything
    // that happened here, and it would reach a prompt.
    const response = await POST(
      request({
        scriptId: 's1',
        outcomes: [{ target: 'leaf:integration-disconnect:slack', outcome: 'clicked' }],
      }),
      params
    );
    expect(response.status).toBe(400);
  });

  it('keeps an unknown target when that is precisely what is being reported', async () => {
    await POST(
      request({
        scriptId: 's1',
        outcomes: [{ target: 'section:made-up', outcome: 'unknown' }],
      }),
      params
    );
    const fields = dispatchMock.mock.calls[0][0].extraEventFields as Record<string, unknown>;
    expect(fields.outcomes).toEqual([{ target: 'section:made-up', outcome: 'unknown' }]);
  });

  it('caps how much one report can carry into a prompt', async () => {
    await POST(
      request({
        scriptId: 's1',
        outcomes: Array.from({ length: 40 }, () => ({
          target: 'section:chat',
          outcome: 'done',
        })),
      }),
      params
    );
    const fields = dispatchMock.mock.calls[0][0].extraEventFields as {
      outcomes: unknown[];
    };
    expect(fields.outcomes.length).toBeLessThanOrEqual(12);
  });

  it('rejects a body that is not a list of outcomes', async () => {
    const response = await POST(request({ scriptId: 's1', outcomes: 'nope' }), params);
    expect(response.status).toBe(400);
  });
});
