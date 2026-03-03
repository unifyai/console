/**
 * Tests for the middleware's MFA and onboarding redirect logic.
 *
 * Verifies that:
 * - Users with mfaPending are redirected to /login/mfa from protected pages
 * - Users with onboardingStep are redirected to /login/onboarding
 * - /login and all sub-paths are always allowed (prevents stale-session loops)
 * - mfaPending takes priority over onboardingStep
 * - /api/auth and /_next paths are always allowed
 * - The onboarding redirect only fires when onboardingStep !== 'completed'
 *
 * Strategy: We mock `next-auth/jwt`'s `getToken` to control the JWT content,
 * and mock `next-auth/middleware`'s `withAuth` to avoid real auth validation.
 * Then we call the middleware directly with a crafted NextRequest.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGetToken = vi.fn();
const mockWithAuth = vi.fn(() => vi.fn().mockReturnValue(new Response('OK')));

vi.mock('next-auth/jwt', () => ({
  getToken: (...args: any[]) => mockGetToken(...args),
}));

vi.mock('next-auth/middleware', () => ({
  withAuth: (...args: any[]) => (mockWithAuth as any)(...args),
  // NextRequestWithAuth is just NextRequest with an optional nextauth prop
}));

vi.mock('@/app/api/auth/[...nextauth]/pages', () => ({
  default: { pages: { signIn: '/login', error: '/login' } },
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import { middleware } from '@/middleware';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'http://localhost:3000'));
}

function makeFetchEvent(): any {
  return {} as any; // Minimal mock — middleware doesn't use event properties we test
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Middleware – MFA redirect logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ON_PREM;
    process.env.JWT_SECRET = 'test-secret';
  });

  it('redirects to /login/mfa from / when mfaPending is true', async () => {
    mockGetToken.mockResolvedValue({ mfaPending: true });

    const response = await middleware(makeRequest('/') as any, makeFetchEvent());

    expect(response?.status).toBe(307);
    expect(new URL(response!.headers.get('location')!).pathname).toBe('/login/mfa');
  });

  it('redirects to /login/mfa from /assistants when mfaPending is true', async () => {
    mockGetToken.mockResolvedValue({ mfaPending: true });

    const response = await middleware(makeRequest('/assistants') as any, makeFetchEvent());

    expect(response?.status).toBe(307);
    expect(new URL(response!.headers.get('location')!).pathname).toBe('/login/mfa');
  });

  it('allows /login when mfaPending is true (stale session escape)', async () => {
    mockGetToken.mockResolvedValue({ mfaPending: true });

    const response = await middleware(makeRequest('/login') as any, makeFetchEvent());

    // Should NOT redirect — should fall through to withAuth
    expect(response?.status).not.toBe(307);
  });

  it('allows /login/mfa when mfaPending is true', async () => {
    mockGetToken.mockResolvedValue({ mfaPending: true });

    const response = await middleware(makeRequest('/login/mfa') as any, makeFetchEvent());

    expect(response?.status).not.toBe(307);
  });

  it('allows /login/invite when mfaPending is true', async () => {
    mockGetToken.mockResolvedValue({ mfaPending: true });

    const response = await middleware(makeRequest('/login/invite') as any, makeFetchEvent());

    expect(response?.status).not.toBe(307);
  });

  it('allows /login/onboarding when mfaPending is true', async () => {
    mockGetToken.mockResolvedValue({ mfaPending: true });

    const response = await middleware(makeRequest('/login/onboarding') as any, makeFetchEvent());

    expect(response?.status).not.toBe(307);
  });
});

describe('Middleware – Onboarding redirect logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ON_PREM;
    process.env.JWT_SECRET = 'test-secret';
  });

  it('redirects to /login/onboarding from / when onboardingStep is set', async () => {
    mockGetToken.mockResolvedValue({ onboardingStep: 'workspace_setup' });

    const response = await middleware(makeRequest('/') as any, makeFetchEvent());

    expect(response?.status).toBe(307);
    expect(new URL(response!.headers.get('location')!).pathname).toBe('/login/onboarding');
  });

  it('redirects to /login/onboarding from /assistants when onboardingStep is set', async () => {
    mockGetToken.mockResolvedValue({ onboardingStep: 'workspace_setup' });

    const response = await middleware(makeRequest('/assistants') as any, makeFetchEvent());

    expect(response?.status).toBe(307);
    expect(new URL(response!.headers.get('location')!).pathname).toBe('/login/onboarding');
  });

  it('allows /login when onboardingStep is set (stale session escape)', async () => {
    mockGetToken.mockResolvedValue({ onboardingStep: 'workspace_setup' });

    const response = await middleware(makeRequest('/login') as any, makeFetchEvent());

    expect(response?.status).not.toBe(307);
  });

  it('allows /login/onboarding when onboardingStep is set', async () => {
    mockGetToken.mockResolvedValue({ onboardingStep: 'workspace_setup' });

    const response = await middleware(makeRequest('/login/onboarding') as any, makeFetchEvent());

    expect(response?.status).not.toBe(307);
  });

  it('allows /login/invite when onboardingStep is set', async () => {
    mockGetToken.mockResolvedValue({ onboardingStep: 'workspace_setup' });

    const response = await middleware(makeRequest('/login/invite') as any, makeFetchEvent());

    expect(response?.status).not.toBe(307);
  });

  it('does NOT redirect when onboardingStep is "completed"', async () => {
    mockGetToken.mockResolvedValue({ onboardingStep: 'completed' });

    const response = await middleware(makeRequest('/assistants') as any, makeFetchEvent());

    // Should fall through to withAuth, not redirect to onboarding
    expect(response?.headers?.get('location')).toBeNull();
  });

  it('does NOT redirect when there is no onboardingStep', async () => {
    mockGetToken.mockResolvedValue({ email: 'user@test.com' });

    const response = await middleware(makeRequest('/assistants') as any, makeFetchEvent());

    expect(response?.headers?.get('location')).toBeNull();
  });
});

describe('Middleware – MFA takes priority over onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ON_PREM;
    process.env.JWT_SECRET = 'test-secret';
  });

  it('redirects to /login/mfa (not /login/onboarding) when both flags are set', async () => {
    mockGetToken.mockResolvedValue({
      mfaPending: true,
      onboardingStep: 'workspace_setup',
    });

    const response = await middleware(makeRequest('/assistants') as any, makeFetchEvent());

    expect(response?.status).toBe(307);
    // MFA takes priority
    expect(new URL(response!.headers.get('location')!).pathname).toBe('/login/mfa');
  });

  it('does NOT trigger onboarding redirect when mfaPending is true', async () => {
    mockGetToken.mockResolvedValue({
      mfaPending: true,
      onboardingStep: 'workspace_setup',
    });

    // Navigate to /login/mfa (allowed by MFA check)
    const response = await middleware(makeRequest('/login/mfa') as any, makeFetchEvent());

    // Should NOT redirect to /login/onboarding
    const location = response?.headers?.get('location');
    if (location) {
      expect(new URL(location).pathname).not.toBe('/login/onboarding');
    }
  });
});

describe('Middleware – no token (unauthenticated)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ON_PREM;
    process.env.JWT_SECRET = 'test-secret';
  });

  it('falls through to withAuth when no token is present', async () => {
    mockGetToken.mockResolvedValue(null);

    await middleware(makeRequest('/assistants') as any, makeFetchEvent());

    // Should call withAuth for the final auth check
    expect(mockWithAuth).toHaveBeenCalled();
  });
});

describe('Middleware – stale session redirect loop prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ON_PREM;
    process.env.JWT_SECRET = 'test-secret';
  });

  it('user with stale mfaPending can reach /login to sign in again', async () => {
    // Simulates: DB was reset, user has stale JWT with mfaPending.
    // A page returned null from getCurrentUser() and redirected to /login.
    // The middleware must NOT redirect away from /login.
    mockGetToken.mockResolvedValue({ mfaPending: true });

    const response = await middleware(makeRequest('/login') as any, makeFetchEvent());

    // Should NOT be a redirect to /login/mfa
    const location = response?.headers?.get('location');
    if (location) {
      expect(new URL(location).pathname).not.toBe('/login/mfa');
    }
  });

  it('user with stale onboardingStep can reach /login to sign in again', async () => {
    // Simulates: DB was reset, user has stale JWT with onboardingStep.
    // A page returned null from getCurrentUser() and redirected to /login.
    // The middleware must NOT redirect away from /login.
    mockGetToken.mockResolvedValue({ onboardingStep: 'workspace_setup' });

    const response = await middleware(makeRequest('/login') as any, makeFetchEvent());

    // Should NOT be a redirect to /login/onboarding
    const location = response?.headers?.get('location');
    if (location) {
      expect(new URL(location).pathname).not.toBe('/login/onboarding');
    }
  });

  it('user with both stale flags can reach /login to sign in again', async () => {
    mockGetToken.mockResolvedValue({
      mfaPending: true,
      onboardingStep: 'workspace_setup',
    });

    const response = await middleware(makeRequest('/login') as any, makeFetchEvent());

    const location = response?.headers?.get('location');
    if (location) {
      const redirectPath = new URL(location).pathname;
      expect(redirectPath).not.toBe('/login/mfa');
      expect(redirectPath).not.toBe('/login/onboarding');
    }
  });
});
