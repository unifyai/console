'use client';

import * as React from 'react';

/**
 * Which console tab a teammate should drive.
 *
 * The event stream fans out to every tab the user has open, so without this a
 * script runs everywhere at once. That does not break — a target either routes
 * from anywhere or hops to its own pane first — it does something worse: it
 * succeeds in tabs nobody asked about. The tab where you were reading a contact
 * jumps to Integrations behind your back, and you find out when you return to
 * it.
 *
 * So exactly one tab drives. The claim is last-interacted-with, because
 * visibility cannot separate two windows side by side and "the one I last
 * touched" is the closest thing to "the one I am looking at".
 *
 * The claim deliberately survives the browser losing focus. Someone on a phone
 * call with the console behind their other windows is a case this feature
 * exists for, and standing down when unfocused would silently disable it there.
 * Going away entirely is already handled a level up: presence expires, and the
 * teammate stops being offered the tool at all.
 */
export const ACTIVE_TAB_STORAGE_KEY = 'console:active-tab';

/**
 * How long a claim outlives its last renewal.
 *
 * Only needs to outlast a tab that was closed while holding it, so another can
 * take over. Short enough that a stale claim does not strand the feature,
 * long enough that an idle-but-present tab keeps it.
 */
export const ACTIVE_TAB_CLAIM_TTL_MS = 30_000;

/** Stable for this tab's lifetime; a reload is a new tab, which is fine. */
const TAB_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}`;

interface Claim {
  tabId: string;
  at: number;
}

function readClaim(): Claim | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Claim>;
    if (typeof parsed.tabId !== 'string' || typeof parsed.at !== 'number') return null;
    return { tabId: parsed.tabId, at: parsed.at };
  } catch {
    return null;
  }
}

/** Take the claim for this tab. */
export function claimActiveConsoleTab(): void {
  if (typeof window === 'undefined') return;
  try {
    const claim: Claim = { tabId: TAB_ID, at: Date.now() };
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, JSON.stringify(claim));
  } catch {
    /* ignore */
  }
}

/**
 * Whether this tab should act on a script.
 *
 * An expired claim is taken over rather than deferred to, so a tab closed while
 * holding cannot strand the feature. With no claim at all — first tab, or
 * storage unavailable — this tab acts, because refusing everywhere is worse
 * than acting in the only place there is.
 */
export function isActiveConsoleTab(): boolean {
  if (typeof window === 'undefined') return false;
  const claim = readClaim();
  if (!claim) {
    claimActiveConsoleTab();
    return true;
  }
  if (claim.tabId === TAB_ID) return true;
  if (Date.now() - claim.at > ACTIVE_TAB_CLAIM_TTL_MS) {
    claimActiveConsoleTab();
    return true;
  }
  return false;
}

/** This tab's id, for tests and diagnostics. */
export function consoleTabId(): string {
  return TAB_ID;
}

/**
 * Keep this tab's claim current while the user is using it.
 *
 * Renewed on the same signals presence already watches — focus, becoming
 * visible, and interaction — so switching to a tab makes it the driver without
 * needing a click, which is what "the tab I am looking at" means in practice.
 */
export function useActiveTabClaim(enabled: boolean = true): void {
  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const isVisible = () => document.visibilityState !== 'hidden';
    const renew = () => {
      if (isVisible()) claimActiveConsoleTab();
    };

    renew();

    const onVisibility = () => renew();
    window.addEventListener('focus', renew);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('pointerdown', renew, { passive: true });
    document.addEventListener('keydown', renew);

    // Keeps an idle-but-open tab from letting its claim expire while it is
    // still the one the user is in front of.
    const heartbeat = window.setInterval(renew, ACTIVE_TAB_CLAIM_TTL_MS / 3);

    return () => {
      window.removeEventListener('focus', renew);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', renew);
      document.removeEventListener('keydown', renew);
      window.clearInterval(heartbeat);
    };
  }, [enabled]);
}
