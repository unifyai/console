/**
 * Who may resolve an assistant's desktop liveview.
 *
 * Opening the desktop to a room call means non-owners need the URL, so the
 * resolver stopped handing it to any caller that asks. Two properties matter
 * enough to pin down: entitlement is decided from the caller's *own* Orchestra
 * scope rather than anything the client passes, and the owner's API key (the
 * fallback password) never leaves the owner.
 *
 * Entitlement has three sources — owner, live call, roster access — and the
 * order they are tried in is itself load-bearing: everyone on a call resolves
 * the desktop for themselves every few seconds, so that path must stay a single
 * live membership check and must not start depending on the roster lookup.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUserMock = vi.fn();
const readableAssistantRowMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/user/user', () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

// `assistantField` stays real so the owner cross-check is genuinely exercised.
vi.mock('@/lib/assistants/assistantAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/assistants/assistantAccess')>()),
  readableAssistantRow: readableAssistantRowMock,
}));

const OWNER = 'owner-1';
const ASSISTANT = '42';

function activeCallsResponse(calls: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ calls }),
  } as Response;
}

function callPayload(overrides: Record<string, unknown> = {}) {
  return {
    call_id: 'sess-1',
    room_name: 'unity_call_sess-1',
    status: 'active',
    scope: 'group',
    created_by_user_id: OWNER,
    user_ids: [OWNER, 'user-2'],
    assistant_ids: [42],
    participants: [],
    roster: [],
    ...overrides,
  };
}

describe('resolveDesktopViewerGrant', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv('ORCHESTRA_URL', 'http://orchestra.test');
    getCurrentUserMock.mockReset();
    readableAssistantRowMock.mockReset();
    readableAssistantRowMock.mockResolvedValue(null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('grants the owner without consulting Orchestra', async () => {
    getCurrentUserMock.mockResolvedValue({ id: OWNER, apiKey: 'owner-key' });
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const { resolveDesktopViewerGrant } = await import('@/lib/assistants/desktopAccess');
    const grant = await resolveDesktopViewerGrant(ASSISTANT, OWNER);

    expect(grant).toEqual({ allowed: true, isOwner: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readableAssistantRowMock).not.toHaveBeenCalled();
  });

  it('grants a participant sharing a live call, using their own key to check', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user-2', apiKey: 'user-2-key' });
    const fetchMock = vi.fn(async () => activeCallsResponse([callPayload()]));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { resolveDesktopViewerGrant } = await import('@/lib/assistants/desktopAccess');
    const grant = await resolveDesktopViewerGrant(ASSISTANT, OWNER);

    expect(grant).toEqual({ allowed: true, isOwner: false });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://orchestra.test/v0/calls/active');
    // The caller's own key: Orchestra then reports the caller's real
    // membership, which is what makes this unspoofable from the client.
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer user-2-key');
    // A call participant settles on membership alone. Adding a roster lookup
    // here would put a second round trip on every participant's poll.
    expect(readableAssistantRowMock).not.toHaveBeenCalled();
  });

  it('grants an org member Orchestra will show the assistant to', async () => {
    // The desktop tab involves no call at all, so this is the path that carries
    // every non-owner who simply has access to the teammate.
    getCurrentUserMock.mockResolvedValue({ id: 'user-2', apiKey: 'user-2-key' });
    global.fetch = vi.fn(async () => activeCallsResponse([])) as unknown as typeof fetch;
    readableAssistantRowMock.mockResolvedValue({ agent_id: 42, user_id: OWNER });

    const { resolveDesktopViewerGrant } = await import('@/lib/assistants/desktopAccess');
    const grant = await resolveDesktopViewerGrant(ASSISTANT, OWNER);

    expect(grant).toEqual({ allowed: true, isOwner: false });
    // Asked with the caller's own key, so Orchestra scopes the answer to them.
    expect(readableAssistantRowMock).toHaveBeenCalledWith('user-2-key', ASSISTANT);
  });

  it('refuses when the roster row names a different owner', async () => {
    // `assistantId` and `ownerId` arrive as independent client-supplied values,
    // and `ownerId` goes on to address a startup row and resolve an owner key.
    getCurrentUserMock.mockResolvedValue({ id: 'user-2', apiKey: 'user-2-key' });
    global.fetch = vi.fn(async () => activeCallsResponse([])) as unknown as typeof fetch;
    readableAssistantRowMock.mockResolvedValue({ agent_id: 42, user_id: 'someone-else' });

    const { resolveDesktopViewerGrant } = await import('@/lib/assistants/desktopAccess');
    const grant = await resolveDesktopViewerGrant(ASSISTANT, OWNER);

    expect(grant.allowed).toBe(false);
  });

  it('never spends the owner key on a non-owner the roster admits', async () => {
    // The published session password is safe to share; the owner's own API key
    // is not, and `isOwner` is what the resolvers gate that fallback on.
    getCurrentUserMock.mockResolvedValue({ id: 'user-2', apiKey: 'user-2-key' });
    global.fetch = vi.fn(async () => activeCallsResponse([])) as unknown as typeof fetch;
    readableAssistantRowMock.mockResolvedValue({ agentId: '42', userId: OWNER });

    const { resolveDesktopViewerGrant } = await import('@/lib/assistants/desktopAccess');
    const grant = await resolveDesktopViewerGrant(ASSISTANT, OWNER);

    expect(grant).toEqual({ allowed: true, isOwner: false });
  });

  it('refuses a non-owner whose live calls do not include this assistant', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user-2', apiKey: 'user-2-key' });
    global.fetch = vi.fn(async () =>
      activeCallsResponse([callPayload({ assistant_ids: [99] })])
    ) as unknown as typeof fetch;

    const { resolveDesktopViewerGrant } = await import('@/lib/assistants/desktopAccess');
    const grant = await resolveDesktopViewerGrant(ASSISTANT, OWNER);

    expect(grant.allowed).toBe(false);
  });

  it('refuses a non-owner when the shared call has already ended', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user-2', apiKey: 'user-2-key' });
    global.fetch = vi.fn(async () =>
      activeCallsResponse([callPayload({ status: 'ended' })])
    ) as unknown as typeof fetch;

    const { resolveDesktopViewerGrant } = await import('@/lib/assistants/desktopAccess');
    const grant = await resolveDesktopViewerGrant(ASSISTANT, OWNER);

    expect(grant.allowed).toBe(false);
  });

  it('refuses when nobody is signed in', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const { resolveDesktopViewerGrant } = await import('@/lib/assistants/desktopAccess');
    const grant = await resolveDesktopViewerGrant(ASSISTANT, OWNER);

    expect(grant.allowed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses rather than opens up when the membership check itself fails', async () => {
    getCurrentUserMock.mockResolvedValue({ id: 'user-2', apiKey: 'user-2-key' });
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const { resolveDesktopViewerGrant } = await import('@/lib/assistants/desktopAccess');
    const grant = await resolveDesktopViewerGrant(ASSISTANT, OWNER);

    expect(grant.allowed).toBe(false);
  });
});
