/**
 * The rate-limit address — the one value a caller must not be able to pick.
 *
 * Orchestra reaches every auth endpoint through this server, so the
 * address it sees is ours: one egress address behind every signup on the
 * platform. Keyed on that, the signup velocity limit stopped being a
 * limit on a caller and became a limit on everyone — thirty a day
 * between them, held closed by its own rejected retries.
 *
 * Carrying an address by hand fixes that, and introduces the failure
 * these tests exist for. The left-most forwarded hop is written by the
 * caller, so a limiter keyed on it can be stepped around by anyone who
 * sets a header. The load balancer appends the address it accepted the
 * connection from, and that is the hop we want.
 */

import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { trustedClientIp } from '@/lib/server/clientIp';

function requestWith(headers: Record<string, string>): NextRequest {
  return new NextRequest('https://console.unify.ai/api/auth/email/register', {
    method: 'POST',
    headers,
  });
}

describe('trustedClientIp', () => {
  it('takes the hop the load balancer appended, not the caller’s own', () => {
    const ip = trustedClientIp(requestWith({ 'x-forwarded-for': '198.51.100.7, 203.0.113.9' }));

    expect(ip).toBe('198.51.100.7');
  });

  it('ignores a forged prefix a caller wrote for themselves', () => {
    const forged = '10.10.10.10';

    const ip = trustedClientIp(
      requestWith({ 'x-forwarded-for': `${forged}, 198.51.100.7, 203.0.113.9` })
    );

    expect(ip).toBe('198.51.100.7');
    expect(ip).not.toBe(forged);
  });

  it('declines rather than trusting a lone caller-supplied hop', () => {
    // One hop means nothing was appended, so the only value present is
    // whatever the caller sent. A rate limit keyed on that is no limit.
    expect(trustedClientIp(requestWith({ 'x-forwarded-for': '10.10.10.10' }))).toBeNull();
  });

  it('declines when the header is absent', () => {
    expect(trustedClientIp(requestWith({}))).toBeNull();
  });

  it('declines loopback', () => {
    expect(
      trustedClientIp(requestWith({ 'x-forwarded-for': '127.0.0.1, 203.0.113.9' }))
    ).toBeNull();
  });
});
