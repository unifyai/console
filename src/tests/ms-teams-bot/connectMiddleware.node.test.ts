/**
 * Middleware handling of a pending Microsoft Teams bind.
 *
 * The bot's connect link is normally opened in a browser with no console session,
 * so the request is bounced through sign-in and — for a first-time installer —
 * the MFA and account-onboarding gates, whose redirects carry only the params they
 * know about. These tests pin the two halves that keep the handshake alive: the
 * nonce is parked in a cookie on the way in, and the first usable page GET is
 * diverted back to `/connect/ms-teams` to finish it.
 *
 * The divert guards matter as much as the divert: firing it on a server action
 * POST or an RSC prefetch would break the caller instead of completing anything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MS_TEAMS_BOT_BIND_COOKIE } from '@/lib/ms-teams-bot/connectLink';

const getTokenMock = vi.hoisted(() => vi.fn());

vi.mock('next-auth/jwt', () => ({ getToken: getTokenMock }));
vi.mock('next-auth/middleware', () => ({
  // Stand in for next-auth's own gate: unauthenticated requests get the sign-in
  // redirect, everything else falls through to the middleware's own response.
  withAuth: () => async () =>
    (await getTokenMock())
      ? undefined
      : NextResponse.redirect(new URL('https://console.unify.ai/login')),
}));
vi.mock('@/lib/environment/environment', () => ({ resolveAuthMode: () => 'managed' }));
vi.mock('@/lib/simulation/config', () => ({ mockSimulationEnabled: () => false }));

const COMPLETED_SESSION = { onboardingStep: 'completed', mfaPending: false };

function request(
  url: string,
  options?: { method?: string; cookies?: Record<string, string>; headers?: Record<string, string> }
): NextRequest {
  const req = new NextRequest(`https://console.unify.ai${url}`, {
    method: options?.method ?? 'GET',
    headers: options?.headers,
  });
  for (const [name, value] of Object.entries(options?.cookies ?? {})) {
    req.cookies.set(name, value);
  }
  return req;
}

async function runMiddleware(req: NextRequest): Promise<NextResponse> {
  vi.resetModules();
  const { middleware } = await import('@/middleware');
  return (await middleware(
    req as Parameters<typeof middleware>[0],
    {} as Parameters<typeof middleware>[1]
  )) as NextResponse;
}

/** The parked nonce this response asks the browser to store, if any. */
function parkedNonce(response: NextResponse): string | undefined {
  const cookie = response.cookies.get(MS_TEAMS_BOT_BIND_COOKIE);
  return cookie?.value || undefined;
}

function locationOf(response: NextResponse): URL {
  return new URL(response.headers.get('location') ?? '');
}

describe('parking a pending Teams bind through the auth funnel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parks the nonce when an unauthenticated connect-link hit is bounced to sign-in', async () => {
    getTokenMock.mockResolvedValue(null);

    const response = await runMiddleware(request('/connect/ms-teams?nonce=nonce-abc'));

    expect(locationOf(response).pathname).toBe('/login');
    expect(parkedNonce(response)).toBe('nonce-abc');
  });

  it('parks the nonce when the account-onboarding gate diverts the request', async () => {
    getTokenMock.mockResolvedValue({ onboardingStep: 'profile', mfaPending: false });

    const response = await runMiddleware(request('/connect/ms-teams?nonce=nonce-abc'));

    expect(locationOf(response).pathname).toBe('/login/onboarding');
    expect(parkedNonce(response)).toBe('nonce-abc');
  });

  it('parks the nonce when the MFA gate diverts the request', async () => {
    getTokenMock.mockResolvedValue({ mfaPending: true });

    const response = await runMiddleware(request('/connect/ms-teams?nonce=nonce-abc'));

    expect(locationOf(response).pathname).toBe('/login/mfa');
    expect(parkedNonce(response)).toBe('nonce-abc');
  });

  it('parks nothing for ordinary traffic', async () => {
    getTokenMock.mockResolvedValue(COMPLETED_SESSION);

    const response = await runMiddleware(request('/assistants'));

    expect(response.headers.get('location')).toBeNull();
    expect(parkedNonce(response)).toBeUndefined();
  });
});

describe('resuming a parked Teams bind', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTokenMock.mockResolvedValue(COMPLETED_SESSION);
  });

  it('diverts the first page GET back to the handler, preserving where the user was headed', async () => {
    const response = await runMiddleware(
      request('/assistants?profile=42', {
        cookies: { [MS_TEAMS_BOT_BIND_COOKIE]: 'parked-nonce' },
      })
    );

    const target = locationOf(response);
    expect(target.pathname).toBe('/connect/ms-teams');
    expect(target.searchParams.get('return')).toBe('/assistants?profile=42');
  });

  it('does not divert a server action POST', async () => {
    const response = await runMiddleware(
      request('/assistants', {
        method: 'POST',
        cookies: { [MS_TEAMS_BOT_BIND_COOKIE]: 'parked-nonce' },
      })
    );

    expect(response.headers.get('location')).toBeNull();
  });

  it('does not divert an RSC payload fetch or a router prefetch', async () => {
    const rscResponse = await runMiddleware(
      request('/assistants', {
        cookies: { [MS_TEAMS_BOT_BIND_COOKIE]: 'parked-nonce' },
        headers: { rsc: '1' },
      })
    );
    expect(rscResponse.headers.get('location')).toBeNull();

    const prefetchResponse = await runMiddleware(
      request('/assistants', {
        cookies: { [MS_TEAMS_BOT_BIND_COOKIE]: 'parked-nonce' },
        headers: { 'next-router-prefetch': '1' },
      })
    );
    expect(prefetchResponse.headers.get('location')).toBeNull();
  });

  it('does not divert mid-sign-in', async () => {
    const response = await runMiddleware(
      request('/login', { cookies: { [MS_TEAMS_BOT_BIND_COOKIE]: 'parked-nonce' } })
    );

    expect(response.headers.get('location')).toBeNull();
  });

  it('does not divert the handler onto itself', async () => {
    const response = await runMiddleware(
      request('/connect/ms-teams', { cookies: { [MS_TEAMS_BOT_BIND_COOKIE]: 'parked-nonce' } })
    );

    expect(response.headers.get('location')).toBeNull();
  });

  it('waits for the MFA gate before resuming', async () => {
    getTokenMock.mockResolvedValue({ mfaPending: true });

    const response = await runMiddleware(
      request('/assistants', { cookies: { [MS_TEAMS_BOT_BIND_COOKIE]: 'parked-nonce' } })
    );

    expect(locationOf(response).pathname).toBe('/login/mfa');
  });

  it('does not divert when there is nothing parked', async () => {
    const response = await runMiddleware(request('/assistants'));

    expect(response.headers.get('location')).toBeNull();
  });
});
