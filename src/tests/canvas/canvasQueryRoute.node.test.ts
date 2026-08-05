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

function post(body: unknown = { aliases: ['tasks'] }, token = TOKEN) {
  return {
    request: new NextRequest(`http://localhost/api/canvas/${token}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ token }),
  };
}

/** Stub Orchestra: token resolution first, then the batch query. */
function stubOrchestra(
  resolution: Record<string, unknown> | null,
  query: { body: unknown; status?: number } = {
    body: { results: { tasks: { rows: [{ a: 1 }], truncated: false, error: null } } },
  }
) {
  return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/admin/canvas/tokens/')) {
      return resolution
        ? new Response(JSON.stringify(resolution), { status: 200 })
        : new Response(JSON.stringify({ detail: 'Token not found' }), { status: 404 });
    }
    if (url.includes('/queries')) {
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
      const queried = fetchSpy.mock.calls.filter(([url]) => String(url).includes('/queries'));
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
        results: { tasks: { rows: [{ a: 1 }], truncated: false } },
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
    it('sends only the aliases to Orchestra', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
      const fetchSpy = stubOrchestra(OWNER_RESOLUTION);

      // Everything beyond `aliases` is an attempt to redirect the query.
      const { request, params } = post({
        aliases: ['tasks'],
        context: 'Secrets',
        filter: null,
        limit: 1000,
      });
      await POST(request, { params });

      const queryCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('/queries'));
      expect(queryCall).toBeDefined();
      const sent = JSON.parse(String((queryCall?.[1] as RequestInit).body));
      expect(sent).toEqual({ aliases: ['tasks'] });
    });

    it('rejects an alias that is not an identifier', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
      stubOrchestra(OWNER_RESOLUTION);

      const { request, params } = post({ aliases: ['tasks; drop'] });

      expect((await POST(request, { params })).status).toBe(400);
    });

    it.each([
      ['a bare string', 'tasks'],
      ['an empty list', []],
      ['too many aliases', Array.from({ length: 33 }, (_, i) => `alias_${i}`)],
    ])('rejects %s', async (_label, aliases) => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
      stubOrchestra(OWNER_RESOLUTION);

      const { request, params } = post({ aliases });

      expect((await POST(request, { params })).status).toBe(400);
    });

    it('rejects a malformed token before resolving it', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      const fetchSpy = stubOrchestra(OWNER_RESOLUTION);

      const { request, params } = post({ aliases: ['tasks'] }, 'not/a/token');
      const response = await POST(request, { params });

      expect(response.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('error passthrough', () => {
    it("keeps an undeclared alias's reason on its own entry", async () => {
      // "Canvas declares no binding named 'x'" is what tells an author their
      // binding name and their TSX disagree — and it must not blank the panels
      // whose bindings are fine.
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
      stubOrchestra(OWNER_RESOLUTION, {
        body: {
          results: {
            tasks: { rows: [{ a: 1 }], truncated: false, error: null },
            ghost: {
              rows: [],
              truncated: false,
              error: "Canvas declares no binding named 'ghost'",
            },
          },
        },
      });

      const { request, params } = post({ aliases: ['tasks', 'ghost'] });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        results: {
          tasks: { rows: [{ a: 1 }] },
          ghost: { error: "Canvas declares no binding named 'ghost'" },
        },
      });
    });

    it("keeps Orchestra's reason for a whole-request failure", async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
      stubOrchestra(OWNER_RESOLUTION, {
        body: { detail: 'Canvas is not published' },
        status: 403,
      });

      const { request, params } = post();
      const response = await POST(request, { params });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: 'Canvas is not published',
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
