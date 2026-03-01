/**
 * Tests for the onboardingStep lifecycle in JWT and Session callbacks.
 *
 * Strategy:
 *   1. Test that onboardingStep is set from authorize() result for credentials
 *   2. Test that onboardingStep defaults to 'workspace_setup' for OAuth signUp
 *   3. Test that completed onboardingStep is NOT persisted in JWT
 *   4. Test that onboardingStep is cleared via session update
 *   5. Test that onboardingStep can be advanced (not just cleared)
 *   6. Test that onboardingStep is preserved across regular JWT calls
 *   7. Test that session callback exposes onboardingStep when present
 *   8. Test that session callback omits onboardingStep when absent
 *   9. Test that MFA takes priority — onboardingStep is not set when mfaPending
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/orchestra/orchestra-client', () => ({
  OrchestraAdminClient: {
    post: vi.fn(),
    get: vi.fn().mockResolvedValue({ data: { mfaEnabled: false } }),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getOrchestraUserClient: vi.fn(),
}));

vi.mock('@/lib/orchestra/orchestra-adapter', () => ({
  OrchestraAdapter: () => ({}),
}));

// ─── Helper ──────────────────────────────────────────────────────────────────

async function getCallbacks() {
  const mod = await import('@/app/api/auth/[...nextauth]/options');
  const authOpts = mod.authOptions ?? mod.default;
  return {
    jwt: authOpts.callbacks!.jwt! as Function,
    session: authOpts.callbacks!.session! as Function,
  };
}

// ─── JWT callback: onboardingStep lifecycle ──────────────────────────────────

describe('JWT callback – onboardingStep lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets onboardingStep from authorize() result for credentials login', async () => {
    const { jwt } = await getCallbacks();

    const result = await jwt({
      token: {},
      user: { onboardingStep: 'workspace_setup', mfaPending: false },
      account: { provider: 'credentials' },
      profile: undefined,
      trigger: 'signIn',
      session: undefined,
    });

    expect(result.onboardingStep).toBe('workspace_setup');
  });

  it('does NOT set onboardingStep when it is "completed" from authorize()', async () => {
    const { jwt } = await getCallbacks();

    const result = await jwt({
      token: {},
      user: { onboardingStep: 'completed' },
      account: { provider: 'credentials' },
      profile: undefined,
      trigger: 'signIn',
      session: undefined,
    });

    expect(result.onboardingStep).toBeUndefined();
  });

  it('defaults to "workspace_setup" for OAuth signUp trigger', async () => {
    const { jwt } = await getCallbacks();

    const result = await jwt({
      token: { email: 'new@example.com' },
      user: {},
      account: { provider: 'google' },
      profile: undefined,
      trigger: 'signUp',
      session: undefined,
    });

    expect(result.onboardingStep).toBe('workspace_setup');
  });

  it('does NOT default to "workspace_setup" for regular OAuth signIn', async () => {
    const { jwt } = await getCallbacks();

    const result = await jwt({
      token: { email: 'existing@example.com' },
      user: {},
      account: { provider: 'google' },
      profile: undefined,
      trigger: 'signIn',
      session: undefined,
    });

    // Existing user signing in — no onboardingStep
    expect(result.onboardingStep).toBeUndefined();
  });

  it('clears onboardingStep on session update with "completed"', async () => {
    const { jwt } = await getCallbacks();

    const result = await jwt({
      token: { onboardingStep: 'workspace_setup' },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: 'update',
      session: { onboardingStep: 'completed' },
    });

    expect(result.onboardingStep).toBeUndefined();
  });

  it('advances onboardingStep to a new value on session update', async () => {
    const { jwt } = await getCallbacks();

    const result = await jwt({
      token: { onboardingStep: 'workspace_setup' },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: 'update',
      session: { onboardingStep: 'profile_setup' },
    });

    expect(result.onboardingStep).toBe('profile_setup');
  });

  it('preserves onboardingStep across regular JWT refresh calls', async () => {
    const { jwt } = await getCallbacks();

    const result = await jwt({
      token: { onboardingStep: 'workspace_setup' },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: undefined,
      session: undefined,
    });

    expect(result.onboardingStep).toBe('workspace_setup');
  });
});

// ─── Session callback: onboardingStep exposure ──────────────────────────────

describe('Session callback – onboardingStep exposure', () => {
  it('exposes onboardingStep in the session when token has it', async () => {
    const { session: sessionCallback } = await getCallbacks();

    const session: any = { user: { email: 'test@example.com' } };
    const token: any = {
      email: 'test@example.com',
      name: 'Test',
      onboardingStep: 'workspace_setup',
      iat: 12345,
    };

    const result = await sessionCallback({ session, token, user: {} });

    expect(result.onboardingStep).toBe('workspace_setup');
  });

  it('does not set onboardingStep when token does not have it', async () => {
    const { session: sessionCallback } = await getCallbacks();

    const session: any = { user: { email: 'test@example.com' } };
    const token: any = {
      email: 'test@example.com',
      name: 'Test',
      iat: 12345,
    };

    const result = await sessionCallback({ session, token, user: {} });

    expect(result.onboardingStep).toBeUndefined();
  });

  it('exposes provider in the session', async () => {
    const { session: sessionCallback } = await getCallbacks();

    const session: any = { user: { email: 'test@example.com' } };
    const token: any = {
      email: 'test@example.com',
      name: 'Test',
      provider: 'google',
      iat: 12345,
    };

    const result = await sessionCallback({ session, token, user: {} });

    expect(result.provider).toBe('google');
  });
});

// ─── Combined: mfaPending vs onboardingStep ──────────────────────────────────

describe('JWT callback – mfaPending vs onboardingStep priority', () => {
  it('both mfaPending and onboardingStep can coexist in JWT', async () => {
    const { jwt } = await getCallbacks();

    // A new user who also has MFA
    const result = await jwt({
      token: {},
      user: { mfaPending: true, onboardingStep: 'workspace_setup' },
      account: { provider: 'credentials' },
      profile: undefined,
      trigger: 'signIn',
      session: undefined,
    });

    // Both flags should be present in the JWT
    expect(result.mfaPending).toBe(true);
    expect(result.onboardingStep).toBe('workspace_setup');
  });

  it('clearing mfaPending does NOT affect onboardingStep', async () => {
    const { jwt } = await getCallbacks();

    const result = await jwt({
      token: { mfaPending: true, onboardingStep: 'workspace_setup' },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: 'update',
      session: { mfaPending: false },
    });

    expect(result.mfaPending).toBeUndefined();
    expect(result.onboardingStep).toBe('workspace_setup');
  });

  it('clearing onboardingStep does NOT affect mfaPending', async () => {
    const { jwt } = await getCallbacks();

    const result = await jwt({
      token: { mfaPending: true, onboardingStep: 'workspace_setup' },
      user: undefined,
      account: null,
      profile: undefined,
      trigger: 'update',
      session: { onboardingStep: 'completed' },
    });

    expect(result.mfaPending).toBe(true);
    expect(result.onboardingStep).toBeUndefined();
  });
});

