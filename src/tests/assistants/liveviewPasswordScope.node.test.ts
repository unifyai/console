/**
 * The liveview password must never be the owner's Orchestra API key when the
 * caller is not the owner.
 *
 * `buildLiveviewUrl` stamps a password onto a URL the *client* supplies, so an
 * owner-key fallback there would hand the owner's credential to whoever chose
 * the URL. With a session password supplied there is no secret to lose — the
 * caller already had it — so only the keyless path is owner-only.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUserMock = vi.fn();
const resolveOwnerApiKeyMock = vi.fn();

vi.mock('@/lib/user/user', () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

vi.mock('@/lib/assistants/owner', () => ({
  resolveOwnerApiKeyForAssistant: (...args: unknown[]) => resolveOwnerApiKeyMock(...args),
}));

vi.mock('@/lib/server-action-session', () => ({
  requireUserApiKey: vi.fn().mockResolvedValue('caller-key'),
}));

vi.mock('@/lib/assistants/system-event', () => ({
  dispatchUnitySystemEvent: vi.fn().mockResolvedValue({ ok: true, status: 202 }),
}));

const OWNER = 'owner-1';
const LIVEVIEW = 'https://vm.example.test/desktop/custom.html';

describe('buildLiveviewUrl password scope', () => {
  beforeEach(() => {
    vi.stubEnv('ORCHESTRA_URL', 'http://orchestra.test');
    getCurrentUserMock.mockReset();
    resolveOwnerApiKeyMock.mockReset();
    resolveOwnerApiKeyMock.mockResolvedValue('OWNER-ORCHESTRA-KEY');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('stamps a supplied session password for anyone on the call', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user-2', apiKey: 'user-2-key' });

    const { buildLiveviewUrl } = await import('@/lib/assistants/desktop');
    const { liveviewUrl } = await buildLiveviewUrl(LIVEVIEW, OWNER, 7, 'session-password');

    expect(new URL(liveviewUrl).searchParams.get('password')).toBe('session-password');
    expect(resolveOwnerApiKeyMock).not.toHaveBeenCalled();
  });

  it("refuses a non-owner with no session password rather than using the owner's key", async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user-2', apiKey: 'user-2-key' });

    const { buildLiveviewUrl } = await import('@/lib/assistants/desktop');

    await expect(buildLiveviewUrl(LIVEVIEW, OWNER, 7, null)).rejects.toThrow(/session password/i);
    expect(resolveOwnerApiKeyMock).not.toHaveBeenCalled();
  });

  it('still falls back to the owner key for the owner themselves', async () => {
    getCurrentUserMock.mockResolvedValue({ id: OWNER, apiKey: 'owner-key' });

    const { buildLiveviewUrl } = await import('@/lib/assistants/desktop');
    const { liveviewUrl } = await buildLiveviewUrl(LIVEVIEW, OWNER, 7, null);

    expect(new URL(liveviewUrl).searchParams.get('password')).toBe('OWNER-ORCHESTRA-KEY');
  });
});
