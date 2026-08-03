import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_TAB_CLAIM_TTL_MS,
  ACTIVE_TAB_STORAGE_KEY,
  claimActiveConsoleTab,
  consoleTabId,
  isActiveConsoleTab,
  useActiveTabClaim,
} from '@/hooks/Assistants/useActiveTabClaim';

/** Pose as a different tab holding the claim. */
function otherTabHolds(agoMs = 0): void {
  window.localStorage.setItem(
    ACTIVE_TAB_STORAGE_KEY,
    JSON.stringify({ tabId: 'some-other-tab', at: Date.now() - agoMs })
  );
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
}

beforeEach(() => {
  window.localStorage.clear();
  setVisibility('visible');
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

/**
 * The event stream reaches every open tab. Without an owner a script runs in
 * all of them, which does not fail — it succeeds where nobody asked, yanking a
 * tab the user was reading somewhere else behind their back.
 */
describe('choosing which tab acts', () => {
  it('acts when nothing else has claimed', () => {
    expect(isActiveConsoleTab()).toBe(true);
  });

  it('stands down while another tab holds the claim', () => {
    otherTabHolds();
    expect(isActiveConsoleTab()).toBe(false);
  });

  it('acts again once it takes the claim back', () => {
    otherTabHolds();
    expect(isActiveConsoleTab()).toBe(false);

    claimActiveConsoleTab();

    expect(isActiveConsoleTab()).toBe(true);
  });

  it('takes over a claim left behind by a tab that closed', () => {
    // Otherwise one closed tab strands the feature for every other one.
    otherTabHolds(ACTIVE_TAB_CLAIM_TTL_MS + 1000);

    expect(isActiveConsoleTab()).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)!).tabId).toBe(
      consoleTabId()
    );
  });

  it('defers to a claim that is merely idle, not stale', () => {
    otherTabHolds(ACTIVE_TAB_CLAIM_TTL_MS / 2);
    expect(isActiveConsoleTab()).toBe(false);
  });

  it('acts rather than freezing when storage cannot be read', () => {
    // Refusing everywhere is worse than acting in the only place there is.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(isActiveConsoleTab()).toBe(true);
  });

  it('ignores a corrupt claim rather than deferring to it forever', () => {
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, 'not json');
    expect(isActiveConsoleTab()).toBe(true);
  });
});

/**
 * Renewed on the signals that mean "the user is in this tab" — the same ones
 * presence already watches.
 */
describe('holding the claim', () => {
  it('claims on mount', () => {
    otherTabHolds();
    renderHook(() => useActiveTabClaim());
    expect(isActiveConsoleTab()).toBe(true);
  });

  it('takes the claim back when the tab is focused', () => {
    renderHook(() => useActiveTabClaim());
    otherTabHolds();
    expect(isActiveConsoleTab()).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(isActiveConsoleTab()).toBe(true);
  });

  it('takes it back on becoming visible, without needing a click', () => {
    // Switching to a tab is enough to mean you are looking at it.
    renderHook(() => useActiveTabClaim());
    otherTabHolds();

    act(() => {
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(isActiveConsoleTab()).toBe(true);
  });

  it('takes it back on interaction', () => {
    renderHook(() => useActiveTabClaim());
    otherTabHolds();

    act(() => {
      document.dispatchEvent(new Event('pointerdown'));
    });

    expect(isActiveConsoleTab()).toBe(true);
  });

  it('does not steal the claim while hidden', () => {
    // A background tab must not take the driver seat from the visible one.
    renderHook(() => useActiveTabClaim());
    otherTabHolds();
    setVisibility('hidden');

    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('pointerdown'));
    });

    expect(isActiveConsoleTab()).toBe(false);
  });

  it('keeps the claim alive while the tab sits idle', () => {
    vi.useFakeTimers();
    renderHook(() => useActiveTabClaim());
    const before = JSON.parse(window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)!).at;

    act(() => {
      vi.advanceTimersByTime(ACTIVE_TAB_CLAIM_TTL_MS);
    });

    const after = JSON.parse(window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)!).at;
    expect(after).toBeGreaterThanOrEqual(before);
    vi.useRealTimers();
  });

  it('keeps the claim when the browser loses focus entirely', () => {
    // Someone on a phone call has the console behind their other windows. That
    // is a case this feature exists for; standing down would disable it there.
    renderHook(() => useActiveTabClaim());
    expect(isActiveConsoleTab()).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(isActiveConsoleTab()).toBe(true);
  });

  it('stops renewing once unmounted', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useActiveTabClaim());
    unmount();
    const at = JSON.parse(window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)!).at;

    act(() => {
      vi.advanceTimersByTime(ACTIVE_TAB_CLAIM_TTL_MS * 2);
    });

    expect(JSON.parse(window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)!).at).toBe(at);
    vi.useRealTimers();
  });
});
