/**
 * Canvas data proxy route.
 *
 * The tile bridge this replaces checks only that an admin key is configured on
 * the server — no session check at all, so the admin key does the reading and
 * nobody establishes who asked. Most of these tests exist to keep that from
 * happening again, which is why the ordering assertions matter as much as the
 * status codes: authorization has to come *before* the admin key is used.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

const getCurrentUser = vi.fn();
vi.mock('@/lib/user/user', () => ({
  getCurrentUser: () => getCurrentUser(),
}));

const getApiKeyFromRequest = vi.fn();
vi.mock('@/app/api/_utils/auth', () => ({
  getApiKeyFromRequest: (request: unknown) => getApiKeyFromRequest(request),
}));

import { POST } from '@/app/api/canvas/[token]/query/route';

const TOKEN = 'canvas_tok01';
const OWNER = 'user-owner';

const OWNER_RESOLUTION = {
  context_name: 'Canvas/Views',
  user_id: OWNER,
  organization_id: null,
  project_id: 1,
  project_name: 'proj',
  visibility: 'private',
  status: 'published',
};

function post(body: unknown = { alias: 'tasks' }, token = TOKEN) {
  return {
    request: new NextRequest(`http://localhost/api/canvas/${token}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ token }),
  };
}

/** Stub Orchestra: token resolution first, then the query. */
function stubOrchestra(
  resolution: Record<string, unknown> | null,
  query: { body: unknown; status?: number } = { body: { rows: [{ a: 1 }], truncated: false } }
) {
  return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/admin/canvas/tokens/')) {
      return resolution
        ? new Response(JSON.stringify(resolution), { status: 200 })
        : new Response(JSON.stringify({ detail: 'Token not found' }), { status: 404 });
    }
    if (url.includes('/query')) {
      return new Response(JSON.stringify(query.body), { status: query.status ?? 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe('canvas query route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getCurrentUser.mockReset();
    getApiKeyFromRequest.mockReset();
    process.env.ORCHESTRA_URL = 'http://127.0.0.1:8000';
    process.env.ORCHESTRA_ADMIN_KEY = 'admin-key';
  });

  describe('authentication comes first', () => {
    it('refuses an unauthenticated caller without touching Orchestra', async () => {
      // Resolving the token first would let anyone probe which tokens exist.
      getApiKeyFromRequest.mockResolvedValue(null);
      const fetchSpy = stubOrchestra(OWNER_RESOLUTION);

      const { request, params } = post();
      const response = await POST(request, { params });

      expect(response.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('never uses the admin key for a viewer it rejected', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: 'someone-else', organizations: [] });
      const fetchSpy = stubOrchestra(OWNER_RESOLUTION);

      const { request, params } = post();
      const response = await POST(request, { params });

      expect(response.status).toBe(403);
      // Exactly one call: the resolution. The query must not have been made.
      const queried = fetchSpy.mock.calls.filter(([url]) => String(url).includes('/query'));
      expect(queried).toHaveLength(0);
    });
  });

  describe('visibility', () => {
    it('serves the owner', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
      stubOrchestra(OWNER_RESOLUTION);

      const { request, params } = post();
      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        alias: 'tasks',
        rows: [{ a: 1 }],
        truncated: false,
      });
    });

    it('serves a team member of a team canvas', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: 'colleague', organizations: [{ id: 7 }] });
      stubOrchestra({ ...OWNER_RESOLUTION, visibility: 'team', organization_id: 7 });

      const { request, params } = post();

      expect((await POST(request, { params })).status).toBe(200);
    });

    it('refuses a non-member of a team canvas', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: 'outsider', organizations: [{ id: 99 }] });
      stubOrchestra({ ...OWNER_RESOLUTION, visibility: 'team', organization_id: 7 });

      const { request, params } = post();

      expect((await POST(request, { params })).status).toBe(403);
    });

    it('serves any signed-in viewer for a public_link canvas', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      // Deliberately not stubbed: a public_link canvas must not need the viewer's
      // full profile, and requiring it would add an Orchestra round trip per view.
      getCurrentUser.mockRejectedValue(new Error('should not be called'));
      stubOrchestra({ ...OWNER_RESOLUTION, visibility: 'public_link' });

      const { request, params } = post();

      expect((await POST(request, { params })).status).toBe(200);
    });
  });

  describe('lifecycle', () => {
    it.each(['draft', 'quarantined'])('refuses a %s canvas even for its owner', async (status) => {
      // Quarantine is the kill switch. If it only stopped the bundle, every frame
      // already open would keep pulling data.
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
      stubOrchestra({ ...OWNER_RESOLUTION, status });

      const { request, params } = post();

      expect((await POST(request, { params })).status).toBe(404);
    });
  });

  describe('what the caller may say', () => {
    it('sends only the alias to Orchestra', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
      const fetchSpy = stubOrchestra(OWNER_RESOLUTION);

      // Everything beyond `alias` is an attempt to redirect the query.
      const { request, params } = post({
        alias: 'tasks',
        context: 'Secrets',
        filter: null,
        limit: 1000,
      });
      await POST(request, { params });

      const queryCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('/query'));
      expect(queryCall).toBeDefined();
      const sent = JSON.parse(String((queryCall?.[1] as RequestInit).body));
      expect(sent).toEqual({ alias: 'tasks' });
    });

    it('rejects an alias that is not an identifier', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
      stubOrchestra(OWNER_RESOLUTION);

      const { request, params } = post({ alias: 'tasks; drop' });

      expect((await POST(request, { params })).status).toBe(400);
    });

    it('rejects a malformed token before resolving it', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      const fetchSpy = stubOrchestra(OWNER_RESOLUTION);

      const { request, params } = post({ alias: 'tasks' }, 'not/a/token');
      const response = await POST(request, { params });

      expect(response.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('error passthrough', () => {
    it("keeps Orchestra's reason for an undeclared alias", async () => {
      // "Canvas declares no binding named 'x'" is what tells an author their
      // binding name and their TSX disagree; a generic 500 would not.
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
      stubOrchestra(OWNER_RESOLUTION, {
        body: { detail: "Canvas declares no binding named 'ghost'" },
        status: 404,
      });

      const { request, params } = post({ alias: 'ghost' });
      const response = await POST(request, { params });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({
        error: "Canvas declares no binding named 'ghost'",
      });
    });

    it('reports an unknown token as not found', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      stubOrchestra(null);

      const { request, params } = post();

      expect((await POST(request, { params })).status).toBe(404);
    });

    it('fails closed when no admin key is configured', async () => {
      delete process.env.ORCHESTRA_ADMIN_KEY;
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      const fetchSpy = stubOrchestra(OWNER_RESOLUTION);

      const { request, params } = post();
      const response = await POST(request, { params });

      expect(response.status).toBe(500);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
