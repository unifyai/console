/**
 * Microsoft Teams bot connect-link handler.
 *
 * Covers the handshake the bot's welcome DM starts: the nonce arriving on the
 * query (direct hit) or on the cookie the middleware parked when the request was
 * bounced through sign-in / MFA / account onboarding, plus the failure and
 * open-redirect edges. Binding server-side is the point of this route — the
 * previous client-effect version silently lost the nonce whenever the auth funnel
 * rewrote the URL before the assistants surface mounted.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MS_TEAMS_BOT_BIND_COOKIE, safeConnectReturnPath } from '@/lib/ms-teams-bot/connectLink';

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const bindInstallActionMock = vi.hoisted(() => vi.fn());
const resolveOwnerMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/user/user', () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock('@/lib/ms-teams-bot/install', () => ({
  bindInstallAction: bindInstallActionMock,
  resolveMsTeamsBotInstallOwner: resolveOwnerMock,
}));

const OWNER = { kind: 'org' as const, orgId: 11 };
const BOUND_INSTALL = {
  id: 5,
  organizationId: 11,
  userId: null,
  tenantId: 'tenant-abc',
  tenantName: 'Contoso',
  botAppId: 'bot-app-id',
  serviceUrl: 'https://smba.trafficmanager.net/teams/',
  pending: false,
  revoked: false,
  bindNonce: null,
};

function request(url: string, cookies?: Record<string, string>): NextRequest {
  const req = new NextRequest(`https://console.unify.ai${url}`);
  for (const [name, value] of Object.entries(cookies ?? {})) {
    req.cookies.set(name, value);
  }
  return req;
}

async function loadRoute() {
  vi.resetModules();
  return import('@/app/connect/ms-teams/route');
}

/** The `Location` of a redirect response, as a URL. */
function location(response: Response): URL {
  return new URL(response.headers.get('location') ?? '');
}

/** Whether the response tells the browser to drop the parked nonce. */
function clearsBindCookie(response: Response): boolean {
  const setCookie = response.headers.get('set-cookie') ?? '';
  return setCookie.includes(`${MS_TEAMS_BOT_BIND_COOKIE}=`) && /Max-Age=0/i.test(setCookie);
}

describe('ms teams bot connect link handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue({ id: 'user-1', apiKey: 'key', organizations: [] });
    resolveOwnerMock.mockReturnValue(OWNER);
    bindInstallActionMock.mockResolvedValue(BOUND_INSTALL);
  });

  it('binds the nonce from the query and reports success on the assistants surface', async () => {
    const { GET } = await loadRoute();

    const response = await GET(request('/connect/ms-teams?nonce=nonce-abc'));

    expect(bindInstallActionMock).toHaveBeenCalledWith(OWNER, 'nonce-abc');
    const target = location(response);
    expect(target.pathname).toBe('/assistants');
    expect(target.searchParams.get('ms_teams_connected')).toBe('1');
    expect(clearsBindCookie(response)).toBe(true);
  });

  it('binds the nonce parked by the middleware when the auth funnel stripped the query', async () => {
    const { GET } = await loadRoute();

    const response = await GET(
      request('/connect/ms-teams?return=%2Fassistants%3Fprofile%3D42', {
        [MS_TEAMS_BOT_BIND_COOKIE]: 'parked-nonce',
      })
    );

    expect(bindInstallActionMock).toHaveBeenCalledWith(OWNER, 'parked-nonce');
    const target = location(response);
    expect(target.pathname).toBe('/assistants');
    expect(target.searchParams.get('profile')).toBe('42');
    expect(target.searchParams.get('ms_teams_connected')).toBe('1');
  });

  it('reports an expired install code instead of a generic failure', async () => {
    bindInstallActionMock.mockResolvedValue({ detail: 'not recognized', status: 404 });
    const { GET } = await loadRoute();

    const response = await GET(request('/connect/ms-teams?nonce=stale'));

    const target = location(response);
    expect(target.searchParams.get('ms_teams_connect_error')).toBe('expired_code');
    expect(target.searchParams.has('ms_teams_connected')).toBe(false);
  });

  it('reports a permission failure when the signed-in user cannot bind the owner scope', async () => {
    bindInstallActionMock.mockResolvedValue({ detail: 'must be an owner', status: 403 });
    const { GET } = await loadRoute();

    const response = await GET(request('/connect/ms-teams?nonce=nonce-abc'));

    expect(location(response).searchParams.get('ms_teams_connect_error')).toBe('not_permitted');
  });

  it('clears the parked nonce on failure so it cannot divert later page loads', async () => {
    bindInstallActionMock.mockResolvedValue({ detail: 'boom', status: 500 });
    const { GET } = await loadRoute();

    const response = await GET(
      request('/connect/ms-teams', { [MS_TEAMS_BOT_BIND_COOKIE]: 'parked-nonce' })
    );

    expect(location(response).searchParams.get('ms_teams_connect_error')).toBe('bind_failed');
    expect(clearsBindCookie(response)).toBe(true);
  });

  it('returns the user home without a notice when there is no nonce to claim', async () => {
    const { GET } = await loadRoute();

    const response = await GET(request('/connect/ms-teams'));

    expect(bindInstallActionMock).not.toHaveBeenCalled();
    const target = location(response);
    expect(target.pathname).toBe('/assistants');
    expect(target.search).toBe('');
    expect(clearsBindCookie(response)).toBe(true);
  });

  it('bounces to sign-in with the nonce intact when the session cannot be resolved', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const { GET } = await loadRoute();

    const response = await GET(request('/connect/ms-teams?nonce=nonce-abc'));

    expect(bindInstallActionMock).not.toHaveBeenCalled();
    const target = location(response);
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('callbackUrl')).toBe('/connect/ms-teams?nonce=nonce-abc');
    // The retry after sign-in still needs the nonce, so it must survive here.
    expect(clearsBindCookie(response)).toBe(false);
  });
});

describe('safeConnectReturnPath', () => {
  it('keeps a same-origin path and its query', () => {
    expect(safeConnectReturnPath('/assistants?profile=42')).toBe('/assistants?profile=42');
  });

  it('rejects absolute and protocol-relative targets', () => {
    expect(safeConnectReturnPath('https://evil.example/steal')).toBe('/assistants');
    expect(safeConnectReturnPath('//evil.example/steal')).toBe('/assistants');
  });

  it('refuses to return to the handler itself', () => {
    expect(safeConnectReturnPath('/connect/ms-teams?nonce=loop')).toBe('/assistants');
  });

  it('drops stale outcome params so a notice is never reported twice', () => {
    expect(safeConnectReturnPath('/assistants?ms_teams_connected=1&profile=7')).toBe(
      '/assistants?profile=7'
    );
  });

  it('falls back to the assistants surface when there is no target', () => {
    expect(safeConnectReturnPath(null)).toBe('/assistants');
  });
});
