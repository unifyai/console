/**
 * First-touch memory — what the browser remembers about the page a visitor
 * first landed on, and what the heard-about step later sends from it.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearFirstTouch,
  firstTouchAttribution,
  firstTouchFromPage,
  readFirstTouch,
  rememberFirstTouch,
} from '@/utils/user/firstTouch';

const ORIGIN = 'https://console.unify.ai';

function pageAt(pathWithSearch: string): Location {
  return new URL(pathWithSearch, ORIGIN) as unknown as Location;
}

describe('firstTouchFromPage', () => {
  it('records the utm parameters, the external referrer and the landing url', () => {
    const touch = firstTouchFromPage(
      pageAt('/login?utm_source=x&utm_medium=social&utm_campaign=kpi&utm_content=a&utm_term=b'),
      'https://x.com/unify_ai/status/1'
    );

    expect(touch).toMatchObject({
      utmSource: 'x',
      utmMedium: 'social',
      utmCampaign: 'kpi',
      utmContent: 'a',
      utmTerm: 'b',
      referrer: 'https://x.com/unify_ai/status/1',
      landingUrl: '/login?utm_source=x&utm_medium=social&utm_campaign=kpi&utm_content=a&utm_term=b',
    });
    expect(touch?.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('remembers a bare external referrer with no utm parameters', () => {
    const touch = firstTouchFromPage(pageAt('/signup'), 'https://news.ycombinator.com/');

    expect(touch).toMatchObject({
      referrer: 'https://news.ycombinator.com/',
      landingUrl: '/signup',
    });
    expect(touch).not.toHaveProperty('utmSource');
  });

  it('remembers nothing for a direct visit or an in-app navigation', () => {
    expect(firstTouchFromPage(pageAt('/login'), '')).toBeNull();
    expect(firstTouchFromPage(pageAt('/login'), `${ORIGIN}/assistants`)).toBeNull();
  });

  it('keeps every field short', () => {
    const long = 'c'.repeat(600);
    const touch = firstTouchFromPage(pageAt(`/login?utm_campaign=${long}`), '');

    expect(touch?.utmCampaign).toHaveLength(500);
    expect(touch?.landingUrl).toHaveLength(500);
  });
});

describe('rememberFirstTouch', () => {
  beforeEach(() => {
    clearFirstTouch();
    window.history.replaceState({}, '', '/login?utm_source=first');
  });

  it('stores the current page once and never overwrites it', () => {
    rememberFirstTouch();
    expect(readFirstTouch()?.utmSource).toBe('first');

    window.history.replaceState({}, '', '/login?utm_source=second');
    rememberFirstTouch();
    expect(readFirstTouch()?.utmSource).toBe('first');
  });

  it('is gone after clearFirstTouch', () => {
    rememberFirstTouch();
    clearFirstTouch();
    expect(readFirstTouch()).toBeNull();
  });
});

describe('firstTouchAttribution', () => {
  it('sends the marketing fields and keeps capturedAt in the browser', () => {
    expect(
      firstTouchAttribution({
        utmSource: 'x',
        referrer: 'https://x.com/',
        landingUrl: '/login?utm_source=x',
        capturedAt: '2026-08-15T00:00:00.000Z',
      })
    ).toEqual({ utmSource: 'x', referrer: 'https://x.com/', landingUrl: '/login?utm_source=x' });
  });
});
