import { describe, expect, it } from 'vitest';
import { isPreviewHost } from '@/lib/auth/preview-host';

const BASE = 'service.a.run.app';

describe('isPreviewHost', () => {
  it('matches slug-tagged preview hosts', () => {
    expect(isPreviewHost(`abc---${BASE}`)).toBe(true);
    expect(isPreviewHost(`feature-1---${BASE}`)).toBe(true);
    expect(isPreviewHost(`a---${BASE}`)).toBe(true);
  });

  it('does not match the bare staging host', () => {
    expect(isPreviewHost(BASE)).toBe(false);
  });

  it('does not match the canonical custom domain', () => {
    expect(isPreviewHost('internal.example.com')).toBe(false);
  });

  it('does not match production hosts', () => {
    expect(isPreviewHost('console.unify.ai')).toBe(false);
    expect(isPreviewHost('unify.ai')).toBe(false);
  });

  it('rejects malformed slugs and missing input', () => {
    expect(isPreviewHost(null)).toBe(false);
    expect(isPreviewHost(undefined)).toBe(false);
    expect(isPreviewHost('')).toBe(false);
    expect(isPreviewHost(`-bad---${BASE}`)).toBe(false);
    expect(isPreviewHost(`bad----${BASE}`)).toBe(false);
  });
});
