/**
 * Signup provenance — the browser's origin, carried to Orchestra by hand.
 *
 * Orchestra cannot read this for itself. Every signup reaches it through
 * this server on an admin-key endpoint, so the request it sees is ours:
 * a constant HTTP client user agent, and this service's egress IP. Left
 * to itself it recorded exactly that, which collected every hosted
 * account into one shared origin — an abuse sweep read it as a ring of
 * strangers and came within one signup of suspending five of them.
 *
 * So these tests are mostly about what must never be sent: our own
 * identity dressed as somebody else's.
 */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import { signupProvenanceFrom, signupProvenanceFromContext } from '@/lib/server/signupProvenance';

function requestWith(headers: Record<string, string>): NextRequest {
  return new NextRequest('https://console.unify.ai/api/auth/email/verify', {
    method: 'POST',
    headers,
  });
}

describe('signupProvenanceFrom', () => {
  it('carries the browser user agent, not this service’s HTTP client', () => {
    const browser = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120';

    const provenance = signupProvenanceFrom(
      requestWith({ 'user-agent': browser, 'x-forwarded-for': '198.51.100.7' })
    );

    expect(provenance.signupUserAgent).toBe(browser);
    expect(provenance.signupUserAgent).not.toMatch(/axios/);
  });

  it('takes the forwarded client hop rather than the proxy', () => {
    const provenance = signupProvenanceFrom(
      requestWith({ 'x-forwarded-for': '198.51.100.7, 10.0.0.1' })
    );

    expect(provenance.signupIp).toBe('198.51.100.7');
  });

  it('prefers an edge-supplied address over the forwarded chain', () => {
    const provenance = signupProvenanceFrom(
      requestWith({
        'cf-connecting-ip': '203.0.113.9',
        'x-forwarded-for': '198.51.100.7',
      })
    );

    expect(provenance.signupIp).toBe('203.0.113.9');
  });

  it('reports nothing rather than a placeholder when it cannot tell', () => {
    const provenance = signupProvenanceFrom(requestWith({}));

    expect(provenance.signupIp).toBeNull();
  });

  it('discards loopback, which every local signup would otherwise share', () => {
    const provenance = signupProvenanceFrom(requestWith({ 'x-forwarded-for': '127.0.0.1' }));

    expect(provenance.signupIp).toBeNull();
  });
});

describe('signupProvenanceFromContext', () => {
  it('reads the request the adapter is running inside', async () => {
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      headers: async () =>
        new Headers({
          'user-agent': 'Mozilla/5.0 Firefox/121',
          'x-forwarded-for': '198.51.100.42',
        }),
    }));
    const { signupProvenanceFromContext: scoped } = await import('@/lib/server/signupProvenance');

    await expect(scoped()).resolves.toEqual({
      signupIp: '198.51.100.42',
      signupUserAgent: 'Mozilla/5.0 Firefox/121',
    });
    vi.doUnmock('next/headers');
  });

  it('yields nulls outside a request rather than throwing', async () => {
    // next-auth's adapter is reachable from contexts with no request;
    // failing the signup over provenance would be the wrong trade.
    await expect(signupProvenanceFromContext()).resolves.toEqual({
      signupIp: null,
      signupUserAgent: null,
    });
  });
});
