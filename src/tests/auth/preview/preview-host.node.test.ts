/**
 * Unit tests for the preview-environment host detection helpers.
 *
 * Locks the validation regex that protects the OAuth bounce flow from
 * open-redirect attacks: only Cloud Run tagged revisions of the canonical
 * staging console service may be accepted as legitimate ``return_to``
 * targets.
 */

import { describe, expect, it } from 'vitest';

import {
  PREVIEW_BASE_HOST,
  PREVIEW_HANDOFF_URL,
  isPreviewHost,
  isValidSlug,
  previewSlugFromHost,
  validatePreviewOrigin,
} from '@/lib/auth/preview-host';

const VALID_SLUGS = ['verify', 'preview-oauth-redirect', 'a', 'feature-1', 'a1b2'];
const INVALID_SLUGS = [
  '',
  '-leading-hyphen',
  'trailing-hyphen-',
  'has_underscore',
  'UPPERCASE',
  'a'.repeat(31),
  'has space',
];

describe('isValidSlug', () => {
  it.each(VALID_SLUGS)('accepts %s', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(INVALID_SLUGS)('rejects %s', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});

describe('isPreviewHost', () => {
  it('accepts a slug-tagged Cloud Run revision of the canonical service', () => {
    expect(isPreviewHost(`verify---${PREVIEW_BASE_HOST}`)).toBe(true);
  });

  it('rejects the bare canonical Cloud Run host', () => {
    expect(isPreviewHost(PREVIEW_BASE_HOST)).toBe(false);
  });

  it('rejects the canonical custom domain', () => {
    expect(isPreviewHost('internal.example.com')).toBe(false);
  });

  it('rejects tags of unrelated Cloud Run services', () => {
    expect(isPreviewHost('verify---some-other-service-abc12-uc.a.run.app')).toBe(false);
  });

  it('rejects malformed slugs', () => {
    expect(isPreviewHost(`UPPERCASE---${PREVIEW_BASE_HOST}`)).toBe(false);
    expect(isPreviewHost(`-leading---${PREVIEW_BASE_HOST}`)).toBe(false);
    expect(isPreviewHost(`---${PREVIEW_BASE_HOST}`)).toBe(false);
  });
});

describe('previewSlugFromHost', () => {
  it('extracts the slug from a valid preview host', () => {
    expect(previewSlugFromHost(`verify---${PREVIEW_BASE_HOST}`)).toBe('verify');
    expect(previewSlugFromHost(`feature-x---${PREVIEW_BASE_HOST}`)).toBe('feature-x');
  });

  it('returns null for non-preview hosts', () => {
    expect(previewSlugFromHost(PREVIEW_BASE_HOST)).toBeNull();
    expect(previewSlugFromHost('internal.example.com')).toBeNull();
  });
});

describe('validatePreviewOrigin', () => {
  it('normalizes a valid HTTPS preview origin', () => {
    const origin = `https://verify---${PREVIEW_BASE_HOST}`;
    expect(validatePreviewOrigin(origin)).toBe(origin);
  });

  it('strips trailing path/search components from the input', () => {
    expect(validatePreviewOrigin(`https://verify---${PREVIEW_BASE_HOST}/some/path?x=1`)).toBe(
      `https://verify---${PREVIEW_BASE_HOST}`
    );
  });

  it('rejects HTTP origins', () => {
    expect(validatePreviewOrigin(`http://verify---${PREVIEW_BASE_HOST}`)).toBeNull();
  });

  it('rejects unrelated hosts', () => {
    expect(validatePreviewOrigin('https://evil.example.com')).toBeNull();
    expect(validatePreviewOrigin('https://api.unify.ai')).toBeNull();
  });

  it('rejects null, empty, and malformed inputs', () => {
    expect(validatePreviewOrigin(null)).toBeNull();
    expect(validatePreviewOrigin(undefined)).toBeNull();
    expect(validatePreviewOrigin('')).toBeNull();
    expect(validatePreviewOrigin('not a url')).toBeNull();
  });
});

describe('PREVIEW_HANDOFF_URL', () => {
  it('points at the canonical Cloud Run host', () => {
    expect(PREVIEW_HANDOFF_URL).toBe(`https://${PREVIEW_BASE_HOST}/api/auth/preview-handoff`);
  });
});
