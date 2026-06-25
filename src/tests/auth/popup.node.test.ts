import { describe, expect, it } from 'vitest';
import {
  allowedAuthPopupOpenerOrigin,
  isAuthPopupProvider,
  safeAuthPopupCallbackUrl,
  safeAuthPopupRedirectUrl,
} from '@/lib/auth/popup';

describe('auth popup helpers', () => {
  it('allows only supported OAuth providers', () => {
    expect(isAuthPopupProvider('google')).toBe(true);
    expect(isAuthPopupProvider('azure-ad')).toBe(true);
    expect(isAuthPopupProvider('github')).toBe(false);
    expect(isAuthPopupProvider(null)).toBe(false);
  });

  it('accepts configured and static landing opener origins', () => {
    expect(allowedAuthPopupOpenerOrigin('https://useunitys.ai/some/path')).toBe(
      'https://useunitys.ai'
    );
    expect(allowedAuthPopupOpenerOrigin('https://www.useunitys.ai/some/path')).toBe(
      'https://www.useunitys.ai'
    );
    expect(allowedAuthPopupOpenerOrigin('https://unify.ai/some/path')).toBe('https://unify.ai');
    expect(
      allowedAuthPopupOpenerOrigin('https://custom.example.com/path', 'https://custom.example.com')
    ).toBe('https://custom.example.com');
  });

  it('rejects malformed and untrusted opener origins', () => {
    expect(allowedAuthPopupOpenerOrigin('not a url')).toBeNull();
    expect(allowedAuthPopupOpenerOrigin('https://evil.example.com')).toBeNull();
  });

  it('normalizes popup completion callbacks to same-origin relative URLs', () => {
    expect(
      safeAuthPopupCallbackUrl(
        'https://console.unify.ai/auth/popup-complete?redirectTo=%2Fassistants',
        'https://console.unify.ai'
      )
    ).toBe('/auth/popup-complete?redirectTo=%2Fassistants');
    expect(safeAuthPopupCallbackUrl(null, 'https://console.unify.ai')).toBe('/auth/popup-complete');
  });

  it('rejects callbacks outside the popup completion route', () => {
    expect(
      safeAuthPopupCallbackUrl(
        'https://evil.example.com/auth/popup-complete',
        'https://console.unify.ai'
      )
    ).toBeNull();
    expect(safeAuthPopupCallbackUrl('/assistants', 'https://console.unify.ai')).toBeNull();
  });

  it('keeps final redirects on the console origin', () => {
    expect(safeAuthPopupRedirectUrl('/assistants?token=abc', 'https://console.unify.ai')).toBe(
      'https://console.unify.ai/assistants?token=abc'
    );
    expect(
      safeAuthPopupRedirectUrl('https://evil.example.com/phish', 'https://console.unify.ai')
    ).toBe('https://console.unify.ai/assistants');
  });
});
