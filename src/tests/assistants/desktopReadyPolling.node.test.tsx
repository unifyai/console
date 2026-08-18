/**
 * The fallback poll's off switch in `useDesktopReady`.
 *
 * The regression covered here: `pollIntervalMs` used to carry a 15s default, so
 * a caller passing `undefined` to mean "do not poll" silently selected that
 * default instead. Both the Desktop pane and the shared-liveview hook did
 * exactly that, which left every assistant the user opened polling
 * `getLiveviewUrl` for the rest of the session — whether or not the Desktop tab
 * had ever been opened, and whether or not the assistant had a managed desktop
 * at all (for one that does not, `isDesktopReady` never flips, so the poll never
 * stops on its own).
 *
 * `null` is now the way to say "no poll", and there is no default to fall back
 * to.
 */
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesktopReady } from '@/hooks/Assistants/useDesktopReady';

const ASSISTANT_ID = '42';

/**
 * Never resolves to a URL, so `isDesktopReady` stays false and the poll is only
 * ever stopped by the caller — which is what these tests are measuring.
 */
const getLiveviewUrl = vi.fn(async () => ({ detail: 'Liveview URL not yet available.' }));

function renderPoll(interval: number | null, allowUnscopedFallback = true) {
  return renderHook(
    ({ pollIntervalMs }: { pollIntervalMs: number | null }) =>
      useDesktopReady(
        ASSISTANT_ID,
        getLiveviewUrl,
        false,
        pollIntervalMs,
        0,
        undefined,
        undefined,
        allowUnscopedFallback
      ),
    { initialProps: { pollIntervalMs: interval } }
  );
}

describe('useDesktopReady — fallback poll off switch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('never asks for a liveview URL when the interval is null', async () => {
    renderPoll(null);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(getLiveviewUrl).not.toHaveBeenCalled();
  });

  it('polls on the given cadence when an interval is supplied', async () => {
    renderPoll(3_000);

    // The effect checks once up front rather than waiting out the first tick.
    expect(getLiveviewUrl).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });

    expect(getLiveviewUrl).toHaveBeenCalledTimes(4);
  });

  it('stops polling when the caller switches the interval to null', async () => {
    const { rerender } = renderPoll(3_000);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    const callsWhilePolling = getLiveviewUrl.mock.calls.length;
    expect(callsWhilePolling).toBeGreaterThan(1);

    rerender({ pollIntervalMs: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(getLiveviewUrl).toHaveBeenCalledTimes(callsWhilePolling);
  });

  it('stays silent without a scope when the unscoped fallback is not opted into', async () => {
    renderPoll(3_000, false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(getLiveviewUrl).not.toHaveBeenCalled();
  });
});
