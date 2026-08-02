import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AGENT_NAVIGATION_ENABLED_STORAGE_KEY,
  readAgentNavigationEnabled,
  useAgentNavigationPermission,
  writeAgentNavigationEnabled,
} from '@/hooks/Assistants/useAgentNavigationPermission';
import { POST } from '@/app/api/assistant/[assistantId]/console-presence/route';
import { NextRequest } from 'next/server';

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
    unauthorized: () => jsonResponse({ error: 'no' }, 401),
    badRequest: (m: string) => jsonResponse({ error: m }, 400),
    internalError: (m: string) => jsonResponse({ error: m }, 500),
  };
});

vi.mock('@/lib/assistants/system-event', () => ({
  dispatchUnitySystemEvent: dispatchMock,
}));

function presenceRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/assistant/123/console-presence', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = { params: Promise.resolve({ assistantId: '123' }) };

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  getApiKeyFromRequestMock.mockResolvedValue('key');
  dispatchMock.mockResolvedValue({ ok: true, status: 202 });
});

afterEach(() => {
  window.localStorage.clear();
});

/**
 * The moves are narrated, reversible and only happen while the user is present,
 * so this is an opt-out. But someone who does not want their page changing
 * under them needs a way to say so short of closing the console.
 */
describe('the navigation permission', () => {
  it('is on until the user says otherwise', () => {
    expect(readAgentNavigationEnabled()).toBe(true);
  });

  it('remembers being turned off', () => {
    writeAgentNavigationEnabled(false);
    expect(readAgentNavigationEnabled()).toBe(false);
    expect(window.localStorage.getItem(AGENT_NAVIGATION_ENABLED_STORAGE_KEY)).toBe('0');
  });

  it('survives storage being unreadable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readAgentNavigationEnabled()).toBe(true);
    getItem.mockRestore();
  });

  it('updates every reader in the tab, not just the one that wrote it', () => {
    // The panel toggle and the executors are different components; a change in
    // one has to reach the others without a reload.
    const { result } = renderHook(() => useAgentNavigationPermission());
    expect(result.current.enabled).toBe(true);

    act(() => writeAgentNavigationEnabled(false));

    expect(result.current.enabled).toBe(false);
  });

  it('follows a change made in another tab', () => {
    const { result } = renderHook(() => useAgentNavigationPermission());
    act(() => {
      window.localStorage.setItem(AGENT_NAVIGATION_ENABLED_STORAGE_KEY, '0');
      window.dispatchEvent(new Event('storage'));
    });
    expect(result.current.enabled).toBe(false);
  });
});

/**
 * Turning it off has to take the tool away, not merely ignore what it produces.
 * An assistant that still believes it can navigate will narrate a move that
 * never happens, which is worse than not offering.
 */
describe('withholding the catalogue', () => {
  function catalogueFrom(call: number): string {
    return dispatchMock.mock.calls[call][0].extraEventFields.consoleActionCatalogue as string;
  }

  it('sends the catalogue while navigation is permitted', async () => {
    await POST(presenceRequest({ reason: 'selection', allowNavigation: true }), params);
    expect(catalogueFrom(0)).toContain('section:');
  });

  it('withholds it once the user opts out', async () => {
    await POST(presenceRequest({ reason: 'selection', allowNavigation: false }), params);
    expect(catalogueFrom(0)).toBe('');
  });

  it('still reports presence when navigation is off', async () => {
    // Presence gates the orientation text too; opting out of being driven is
    // not opting out of the assistant knowing what the console looks like.
    const response = await POST(
      presenceRequest({ reason: 'selection', allowNavigation: false }),
      params
    );
    expect(response.status).toBe(202);
    expect(dispatchMock.mock.calls[0][0].extraEventFields.consoleGuidanceBrief).not.toBe('');
  });

  it('permits navigation when the caller says nothing', async () => {
    // Older callers and the default both mean "allowed"; only an explicit
    // false withdraws it.
    await POST(presenceRequest({ reason: 'selection' }), params);
    expect(catalogueFrom(0)).not.toBe('');
  });
});
