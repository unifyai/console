'use client';

/**
 * LandingEventBeacon — first-party outbound campaign attribution.
 *
 * Mirrors the beacon shipped in the unifyai/landing-page repo so that
 * outbound campaign links pointing to Console destinations (e.g.
 * console.unify.ai/login or .../signup with our UTM identifiers)
 * close the funnel-attribution loop. When a visitor arrives with our
 * outbound UTM identifiers in the URL (utm_source / utm_medium /
 * utm_campaign / utm_content appended by the r.unify.ai redirect
 * service), this component POSTs a single small JSON beacon to the
 * brain link-tracker service.
 *
 * It is also where the browser remembers the visitor's first touch
 * (`@/utils/user/firstTouch`): the `utm_*` parameters and any external
 * referrer on the first page seen, kept in localStorage until the
 * account-onboarding heard-about step sends them to Orchestra beside the
 * self-reported answer. That memory is wider than the beacon — a bare
 * external referrer with no UTMs is still a first touch — but nothing
 * leaves the browser for it until onboarding.
 *
 * Privacy posture
 *  - The beacon ONLY fires when `utm_source` is present in the URL.
 *    Organic / direct traffic is never reported.
 *  - It is "first-party attribution of an explicit click": the visitor
 *    already self-identified by clicking the outbound campaign link
 *    that carried our UTMs.
 *  - The brain link-tracker hashes the IP before persisting; the
 *    LandingEvents row stores the hashed IP, UA, referrer, and the
 *    raw query for downstream attribution. No cookies set.
 *  - Within a session we dedupe by the UTM tuple so a single landing
 *    can't fan out into multiple LandingEvents rows if the component
 *    remounts (e.g. soft client-side navigation that re-runs effects).
 *  - Console does not currently expose a cookie-consent UI. If/when
 *    one is added (mirroring landing-page's `marketing` category),
 *    wire its `granted` state into the effect below the same way the
 *    landing-page component does.
 *
 * Configuration
 *  - `NEXT_PUBLIC_LINK_TRACKER_URL` overrides the beacon target
 *    (defaults to `https://r.unify.ai` — matches
 *    `brain.outbound.evergreen.link_tracking.DEFAULT_REDIRECT_HOST`).
 *  - No external deps; pure `fetch` with `keepalive: true` so the
 *    beacon survives the very next click.
 */

import { useEffect } from 'react';
import { rememberFirstTouch } from '@/utils/user/firstTouch';

const DEFAULT_TRACKER_URL = 'https://r.unify.ai';
const SESSION_KEY_PREFIX = 'unify_landing_event_';

function readTrackerUrl(): string {
  const raw = process.env.NEXT_PUBLIC_LINK_TRACKER_URL;
  if (!raw) return DEFAULT_TRACKER_URL;
  return raw.replace(/\/+$/, '');
}

function queryFromLocation(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.get('utm_source')) return null;
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function sessionDedupeKey(query: Record<string, string>): string {
  const tuple = [
    query.utm_source ?? '',
    query.utm_medium ?? '',
    query.utm_campaign ?? '',
    query.utm_content ?? '',
    window.location.pathname,
  ].join('|');
  return SESSION_KEY_PREFIX + tuple;
}

function alreadyBeaconedThisSession(query: Record<string, string>): boolean {
  try {
    return sessionStorage.getItem(sessionDedupeKey(query)) === '1';
  } catch {
    // Storage access can be blocked (Safari private browsing, etc.);
    // fall through to firing — over-counting is preferable to dropping.
    return false;
  }
}

function markBeaconedThisSession(query: Record<string, string>): void {
  try {
    sessionStorage.setItem(sessionDedupeKey(query), '1');
  } catch {
    // Best-effort; nothing we can do if storage is locked.
  }
}

async function sendBeacon(trackerUrl: string, query: Record<string, string>) {
  // The body keys are snake_case because they are the wire format the
  // brain link-tracker service expects (Pythonic) — not internal TS
  // identifiers — so we exempt this payload from the project-wide
  // camelCase naming convention.
  const payload: Record<string, unknown> = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    landing_url: typeof window !== 'undefined' ? window.location.href : null,
    query,
    referrer: typeof document !== 'undefined' ? document.referrer || null : null,
  };
  try {
    await fetch(`${trackerUrl}/landing-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors',
    });
  } catch {
    // The beacon is best-effort: a failed attribution must never
    // surface to the user. Silently swallow network errors.
  }
}

export function LandingEventBeacon() {
  useEffect(() => {
    rememberFirstTouch();
    const query = queryFromLocation();
    if (!query) return;
    if (alreadyBeaconedThisSession(query)) return;
    markBeaconedThisSession(query);
    void sendBeacon(readTrackerUrl(), query);
  }, []);

  return null;
}
