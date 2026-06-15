import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { requestAssistantPresenceWake } from '@/lib/client/assistant-presence';
import {
  ASSISTANT_PRESENCE_KEEP_WARM_INTERVAL_MS,
  useAssistantPresenceWake,
} from '@/hooks/Assistants/useAssistantPresenceWake';

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
}

describe('requestAssistantPresenceWake', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the presence system event through the assistant route', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 202 }));
    vi.stubGlobal('fetch', fetchSpy);

    await requestAssistantPresenceWake({
      assistantId: '123',
      source: 'assistant_profile',
      reason: 'selection',
      pageVisibility: 'visible',
      occurredAt: '2026-06-15T21:00:00.000Z',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/assistant/123/system-event',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      eventType: 'assistant_presence_observed',
      message: 'User presence observed in Console.',
      extraEventFields: {
        source: 'assistant_profile',
        reason: 'selection',
        pageVisibility: 'visible',
        occurredAt: '2026-06-15T21:00:00.000Z',
      },
    });
  });
});

describe('useAssistantPresenceWake', () => {
  let currentTime: number;
  let requestWake: Mock<typeof requestAssistantPresenceWake>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setVisibility('visible');
    currentTime = Date.UTC(2026, 5, 15, 21, 0, 0);
    requestWake = vi.fn(async () => undefined) as Mock<typeof requestAssistantPresenceWake>;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fires immediately when an assistant profile is selected', async () => {
    renderHook(() =>
      useAssistantPresenceWake('123', {
        requestWake,
        now: () => currentTime,
      })
    );

    await waitFor(() => expect(requestWake).toHaveBeenCalledTimes(1));
    expect(requestWake).toHaveBeenCalledWith(
      expect.objectContaining({
        assistantId: '123',
        source: 'assistant_profile',
        reason: 'selection',
      })
    );
  });

  it('throttles repeated user activity for the selected assistant', async () => {
    renderHook(() =>
      useAssistantPresenceWake('123', {
        requestWake,
        now: () => currentTime,
      })
    );
    await waitFor(() => expect(requestWake).toHaveBeenCalledTimes(1));

    act(() => {
      document.dispatchEvent(new Event('pointermove'));
    });
    await waitFor(() => expect(requestWake).toHaveBeenCalledTimes(2));

    act(() => {
      document.dispatchEvent(new Event('pointerdown'));
      document.dispatchEvent(new Event('keydown'));
    });
    expect(requestWake).toHaveBeenCalledTimes(2);

    currentTime += 60_000;
    act(() => {
      document.dispatchEvent(new Event('mouseover'));
    });
    await waitFor(() => expect(requestWake).toHaveBeenCalledTimes(3));
    expect(requestWake).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: 'assistant_activity',
        reason: 'activity',
      })
    );
  });

  it('fires on tab focus and visible transitions after the throttle window', async () => {
    renderHook(() =>
      useAssistantPresenceWake('123', {
        requestWake,
        now: () => currentTime,
      })
    );
    await waitFor(() => expect(requestWake).toHaveBeenCalledTimes(1));

    currentTime += 60_000;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(requestWake).toHaveBeenCalledTimes(2));

    setVisibility('hidden');
    currentTime += 60_000;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(requestWake).toHaveBeenCalledTimes(2);

    setVisibility('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(requestWake).toHaveBeenCalledTimes(3));
    expect(requestWake).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: 'assistant_profile',
        reason: 'visibility',
      })
    );
  });

  it('keeps the selected assistant warm while the tab is visible', async () => {
    vi.useFakeTimers();
    renderHook(() =>
      useAssistantPresenceWake('123', {
        requestWake,
        now: () => currentTime,
      })
    );
    expect(requestWake).toHaveBeenCalledTimes(1);

    currentTime += ASSISTANT_PRESENCE_KEEP_WARM_INTERVAL_MS;
    act(() => {
      vi.advanceTimersByTime(ASSISTANT_PRESENCE_KEEP_WARM_INTERVAL_MS);
    });

    expect(requestWake).toHaveBeenCalledTimes(2);
    expect(requestWake).toHaveBeenLastCalledWith(
      expect.objectContaining({
        source: 'assistant_profile',
        reason: 'keepwarm',
      })
    );
  });

  it('does nothing when no assistant is selected', () => {
    renderHook(() =>
      useAssistantPresenceWake(null, {
        requestWake,
        now: () => currentTime,
      })
    );

    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('pointerdown'));
    });

    expect(requestWake).not.toHaveBeenCalled();
  });
});
