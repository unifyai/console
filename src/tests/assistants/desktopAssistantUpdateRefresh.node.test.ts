/**
 * A desktop link created after an assistant's pod has booted is invisible to
 * the running session until it restarts (`user_desktops` is only absorbed
 * from `StartupEvent`/`AssistantUpdateEvent`). `linkDesktop` must therefore
 * also poke adapters' `/assistant/update` webhook so a running session picks
 * up the fresh Orchestra link immediately, and a webhook failure must never
 * fail the link itself — the Orchestra mutation is authoritative.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-action-session', () => ({
  requireUserApiKey: vi.fn().mockResolvedValue('test-api-key'),
}));

vi.mock('@/lib/user/user', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

vi.mock('@/lib/assistants/system-event', () => ({
  dispatchUnitySystemEvent: vi.fn().mockResolvedValue({ ok: true, status: 202 }),
}));

describe('linkDesktop assistant-update refresh', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('ORCHESTRA_URL', 'http://orchestra.test');
    vi.stubEnv('ORCHESTRA_ADMIN_KEY', 'admin-key');
    vi.stubEnv('UNIFY_ADAPTERS_URL', 'http://adapters.test');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('pokes the adapters assistant-update webhook after a successful link', async () => {
    const calls: string[] = [];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      });
    }) as unknown as typeof fetch;

    const { linkDesktop } = await import('@/lib/assistants/desktop');
    const result = await linkDesktop('123', 7, true);

    expect(result).toEqual({ info: 'Desktop linked successfully' });
    expect(calls).toContain('http://orchestra.test/v0/desktop/link');
    expect(calls).toContain('http://adapters.test/assistant/update');
  });

  it('still reports the link as successful when the refresh webhook fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === 'http://adapters.test/assistant/update') {
        return Promise.reject(new Error('adapters unreachable'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
      });
    }) as unknown as typeof fetch;

    const { linkDesktop } = await import('@/lib/assistants/desktop');
    const result = await linkDesktop('123', 7, true);

    expect(result).toEqual({ info: 'Desktop linked successfully' });
  });
});
