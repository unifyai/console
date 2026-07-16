/**
 * Helpers for sending the user through a provider OAuth consent screen
 * in a short-lived popup instead of navigating the current page.
 *
 * Why a separate popup at all: navigating the current tab
 * (``window.location.href = url``) tears down the whole single-page
 * app, which drops anything live on the page — most notably an
 * in-progress assistant call during the Coordinator onboarding flow.
 * A popup keeps the original surface (and its call) intact while
 * the user completes the provider's consent screen.
 *
 * Why this is split into "open" + "navigate": browsers only let
 * ``window.open`` escape the popup blocker when it is called
 * *synchronously inside the user gesture* (the click handler). Our
 * authorize URL isn't known until after an ``await`` (we fetch it from
 * the server first), and calling ``window.open`` after that await is
 * treated as an unsolicited popup → blocked → returns ``null``. The
 * caller would then fall back to a same-tab redirect, which is exactly
 * the SPA teardown we were trying to avoid.
 *
 * The fix: open a blank popup synchronously on click via
 * ``openPendingOAuthTab()``, do the async work, then point that popup at
 * the URL with ``handle.navigate(url)``.
 *
 * Coming back to the original tab: instead of pointing the provider
 * callback straight back at the page the user was on, we point it at a
 * tiny bounce page (``/oauth/complete``). That page broadcasts a
 * "connection done" message to the original tab and then closes itself,
 * so the user lands back where they started without a stray console tab
 * left open. The original tab listens via ``subscribeOAuthComplete`` and
 * refetches, so e.g. the onboarding checklist crosses the step off with
 * no manual refresh. If the popup was blocked and we fell back to a
 * same-tab redirect, the bounce page can't close itself, so it forwards
 * to the original page instead (see ``/oauth/complete``).
 */

/** Same-origin channel name the bounce page and openers agree on. */
export const OAUTH_COMPLETE_CHANNEL = 'unify:oauth-complete';

/** localStorage key used as a BroadcastChannel fallback. */
const OAUTH_COMPLETE_STORAGE_KEY = 'unify:oauth-complete';

/** Payload broadcast by the bounce page once the provider callback returns. */
export interface OAuthCompleteDetail {
  /** The provider callback's result query string (e.g. ``success=true&user_email=…``). */
  readonly query: string;
  /** Best-effort hint about which flow finished, for callers that care. */
  readonly kind: 'workspace' | 'integration' | 'unknown';
  /** Millisecond timestamp, used to dedupe the storage-event fallback. */
  readonly at: number;
}

/**
 * Build the absolute URL of the OAuth bounce page, carrying the page the
 * user should return to (used only for the popup-blocked same-tab
 * fallback). Returns an absolute URL because the provider callback issues
 * a top-level redirect that must not be relative to the callback host.
 */
export function buildOAuthCompleteUrl(returnTo?: string): string {
  if (typeof window === 'undefined') return '/oauth/complete';
  const fallbackReturn = returnTo ?? `${window.location.pathname}${window.location.search}`;
  const url = new URL('/oauth/complete', window.location.origin);
  url.searchParams.set('return', fallbackReturn);
  return url.toString();
}

/**
 * Broadcast (from the bounce page) that an OAuth connection finished, so
 * any open opener tab can refetch. Uses BroadcastChannel where available
 * and falls back to a localStorage write that fires a ``storage`` event
 * in other tabs.
 */
export function broadcastOAuthComplete(detail: Omit<OAuthCompleteDetail, 'at'>): void {
  if (typeof window === 'undefined') return;
  const payload: OAuthCompleteDetail = { ...detail, at: Date.now() };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(OAUTH_COMPLETE_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    }
  } catch {
    // Best-effort — fall through to the storage fallback below.
  }
  try {
    // Each payload carries a unique ``at`` timestamp, so consecutive
    // writes always differ and reliably fire a ``storage`` event in other
    // tabs. (Don't ``removeItem`` right after — a rapid set+remove can be
    // coalesced so the opener only observes the final ``null``.)
    window.localStorage.setItem(OAUTH_COMPLETE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable (private mode quota etc.) — ignore.
  }
}

/**
 * Subscribe (in an opener tab) to OAuth-completion broadcasts. Returns an
 * unsubscribe function. Listens on both the BroadcastChannel and the
 * ``storage`` fallback so it works regardless of which path the bounce
 * page used.
 */
export function subscribeOAuthComplete(handler: (detail: OAuthCompleteDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let channel: BroadcastChannel | null = null;
  const onChannelMessage = (event: MessageEvent) => {
    if (event.data && typeof event.data === 'object') handler(event.data as OAuthCompleteDetail);
  };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(OAUTH_COMPLETE_CHANNEL);
      channel.addEventListener('message', onChannelMessage);
    }
  } catch {
    channel = null;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== OAUTH_COMPLETE_STORAGE_KEY || !event.newValue) return;
    try {
      handler(JSON.parse(event.newValue) as OAuthCompleteDetail);
    } catch {
      // Ignore malformed payloads.
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener('storage', onStorage);
    if (channel) {
      channel.removeEventListener('message', onChannelMessage);
      channel.close();
    }
  };
}

export interface PendingOAuthTab {
  /** Whether the browser actually granted us a popup (false ⇒ popup blocked). */
  readonly opened: boolean;
  /** Point the pre-opened popup at the authorize URL once it's known. */
  navigate(url: string): void;
  /** Close the pre-opened popup (e.g. if the URL fetch failed). */
  close(): void;
}

/**
 * Synchronously open a blank popup within a click gesture, to be
 * navigated to an OAuth authorize URL once it has been fetched.
 *
 * MUST be called synchronously in the event handler — before any
 * ``await`` — otherwise the popup blocker will reject it.
 */
export function openPendingOAuthTab(): PendingOAuthTab {
  const width = 560;
  const height = 720;
  const left =
    typeof window !== 'undefined'
      ? Math.max(0, window.screenX + (window.outerWidth - width) / 2)
      : 0;
  const top =
    typeof window !== 'undefined'
      ? Math.max(0, window.screenY + (window.outerHeight - height) / 2)
      : 0;
  const features = [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${Math.round(left)}`,
    `top=${Math.round(top)}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');
  const tab = typeof window !== 'undefined' ? window.open('', 'unify-oauth-popup', features) : null;
  return {
    opened: !!tab,
    navigate(url: string) {
      if (!tab) return;
      try {
        tab.location.href = url;
      } catch {
        // Fallback for the rare browser that throws on direct href set.
        try {
          tab.location.assign(url);
        } catch {
          // Give up silently; caller handles the same-tab fallback.
        }
      }
    },
    close() {
      try {
        tab?.close();
      } catch {
        // Ignore — the tab may already be gone.
      }
    },
  };
}

/**
 * Copy an authorize URL for a private-window OAuth pass. Browsers cannot open
 * a private window via script, so callers instruct the user to paste the URL
 * into a private/incognito window after this succeeds.
 */
export async function copyAuthorizeUrlForPrivateWindow(url: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(url);
  return true;
}
