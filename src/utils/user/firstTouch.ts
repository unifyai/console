/**
 * First-touch marketing context.
 *
 * The campaign parameters and referrer on the first page a visitor lands
 * on, remembered in the browser until the account-onboarding
 * "how did you hear about us?" step sends them to Orchestra next to the
 * self-reported answer — observed attribution beside the claimed one.
 *
 * First touch wins: a later visit with different parameters never
 * overwrites the stored record. It lives in localStorage so it survives
 * the OAuth round-trip and the email-verification redirects between
 * landing and onboarding. No cookies, and nothing leaves the browser
 * until onboarding sends it.
 */

import { camelToSnake } from '@/utils/casing';

const STORAGE_KEY = 'unify_first_touch';
const MAX_FIELD_LENGTH = 500;

const UTM_KEYS = ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm'] as const;
type UtmKey = (typeof UTM_KEYS)[number];

/**
 * The fields the heard-about step sends. Keys are camelCase here and reach
 * Orchestra as `utm_source`, `landing_url`, ... via the client's boundary
 * conversion.
 */
export interface FirstTouchAttribution extends Partial<Record<UtmKey, string>> {
  referrer?: string;
  landingUrl: string;
}

export interface FirstTouch extends FirstTouchAttribution {
  capturedAt: string;
}

function clip(value: string): string {
  return value.slice(0, MAX_FIELD_LENGTH);
}

/**
 * The first-touch record for a page, or `null` when the page carries
 * nothing worth remembering: no `utm_*` parameter and no referrer from
 * outside this origin.
 */
export function firstTouchFromPage(location: Location, referrer: string): FirstTouch | null {
  const params = new URLSearchParams(location.search);
  const utm: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const value = params.get(camelToSnake(key));
    if (value) utm[key] = clip(value);
  }
  const external = referrer !== '' && new URL(referrer).origin !== location.origin;
  if (Object.keys(utm).length === 0 && !external) return null;
  return {
    ...utm,
    ...(external ? { referrer: clip(referrer) } : {}),
    landingUrl: clip(location.pathname + location.search),
    capturedAt: new Date().toISOString(),
  };
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage access can be blocked (Safari private browsing, etc.);
    // attribution is best-effort and must never break the page.
    return null;
  }
}

/** Stores the current page as the first touch unless one is already remembered. */
export function rememberFirstTouch(): void {
  if (readStored() !== null) return;
  const touch = firstTouchFromPage(window.location, document.referrer);
  if (!touch) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(touch));
  } catch {
    // Best-effort; nothing to do if storage is locked.
  }
}

export function readFirstTouch(): FirstTouch | null {
  const raw = readStored();
  return raw ? (JSON.parse(raw) as FirstTouch) : null;
}

export function clearFirstTouch(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort; nothing to do if storage is locked.
  }
}

/** The attribution fields of a first touch; `capturedAt` stays in the browser. */
export function firstTouchAttribution({
  capturedAt: _capturedAt,
  ...attribution
}: FirstTouch): FirstTouchAttribution {
  return attribution;
}
