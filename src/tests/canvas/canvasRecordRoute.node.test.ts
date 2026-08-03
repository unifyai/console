/**
 * Canvas record route — the bundle read and its integrity check.
 *
 * Orchestra serves no bundle endpoint, so this is the only path by which compiled
 * assistant-authored code reaches a browser. Three of these tests exist because the
 * failure they describe is silent:
 *
 * - a comma-joined `from_fields` returns **zero rows** without raising, which reads
 *   exactly like a deleted canvas;
 * - the casing pass that turns `bundle_code` into `bundleCode` would rename
 *   author-declared prop keys too, if props were parsed before it ran;
 * - a bundle whose bytes no longer match the sha recorded at review time is code
 *   nobody approved, and rendering it anyway would look completely normal.
 */

import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
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

import { GET } from '@/app/api/canvas/[token]/route';

const TOKEN = 'canvas_tok01';
const OWNER = 'user-owner';
const SOURCE = 'export default function C(){return null}';
const SOURCE_SHA = createHash('sha256').update(SOURCE, 'utf8').digest('hex');

const OWNER_RESOLUTION = {
  context_name: 'Canvas/Views',
  user_id: OWNER,
  organization_id: null,
  project_id: 1,
  project_name: 'proj',
  visibility: 'private',
  status: 'published',
};

/**
 * Author-declared prop and binding names, deliberately mixing casing styles.
 *
 * `dealName` and `total_rows` must both survive verbatim: they are the keys the
 * authored TSX reads, and renaming either one silently empties the canvas.
 */
const PROPS = { dealName: 'Acme', total_rows: 5 };
const BINDINGS = [{ alias: 'tasks' }, { alias: 'openDeals' }];

function entries(overrides: Record<string, unknown> = {}) {
  return {
    token: TOKEN,
    title: 'Task tracker',
    description: 'Pending work',
    bundle_code: SOURCE,
    bundle_sha: SOURCE_SHA,
    props_json: JSON.stringify(PROPS),
    bindings_json: JSON.stringify(BINDINGS),
    kit_version: '0.1.0',
    updated_at: '2026-07-29T00:00:00Z',
    ...overrides,
  };
}

function get(token = TOKEN) {
  return {
    request: new NextRequest(`http://localhost/api/canvas/${token}`),
    params: Promise.resolve({ token }),
  };
}

/**
 * Stub Orchestra across all four calls the route makes.
 *
 * Each branch builds a fresh `Response`, because a body can only be read once and a
 * shared instance hands the second caller a consumed stream — which looks exactly
 * like a bug in the code under test.
 */
function stubOrchestra(
  options: {
    resolution?: Record<string, unknown> | null;
    row?: Record<string, unknown> | null;
    logsStatus?: number;
    actions?: unknown[];
  } = {}
) {
  const {
    resolution = OWNER_RESOLUTION,
    row = entries(),
    logsStatus = 200,
    actions = [],
  } = options;

  return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/admin/canvas/tokens/')) {
      return resolution
        ? new Response(JSON.stringify(resolution), { status: 200 })
        : new Response(JSON.stringify({ detail: 'Token not found' }), { status: 404 });
    }
    if (url.includes('/admin/user/by-user-id')) {
      return new Response(JSON.stringify({ api_key: 'owner-key' }), { status: 200 });
    }
    if (url.includes('/v0/logs')) {
      return new Response(JSON.stringify({ logs: row ? [{ entries: row }] : [] }), {
        status: logsStatus,
      });
    }
    if (url.includes('/actions')) {
      return new Response(JSON.stringify({ actions }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

function logsCall(fetchSpy: ReturnType<typeof stubOrchestra>): URL | null {
  const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('/v0/logs'));
  return call ? new URL(String(call[0])) : null;
}

describe('canvas record route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getCurrentUser.mockReset();
    getApiKeyFromRequest.mockReset();
    getApiKeyFromRequest.mockResolvedValue('viewer-key');
    getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
    process.env.ORCHESTRA_URL = 'http://127.0.0.1:8000';
    process.env.ORCHESTRA_ADMIN_KEY = 'admin-key';
  });

  describe('the bundle', () => {
    it('serves a canvas whose bundle matches its recorded sha', async () => {
      stubOrchestra();

      const { request, params } = get();
      const response = await GET(request, { params });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.source).toBe(SOURCE);
      expect(body.title).toBe('Task tracker');
      expect(body.kitVersion).toBe('0.1.0');
    });

    it('refuses a bundle that does not match its recorded sha', async () => {
      // The sha was computed when the canvas was rendered and reviewed. Bytes that
      // no longer hash to it are code that passed no gate.
      stubOrchestra({ row: entries({ bundle_code: `${SOURCE}/*tampered*/` }) });

      const { request, params } = get();
      const response = await GET(request, { params });
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.error).toMatch(/integrity/i);
      expect(body.source).toBeUndefined();
    });

    it('refuses a row with no compiled bundle', async () => {
      // Only the authoring pipeline writes bundle_code; a row without one would
      // otherwise be served with the integrity check skipped entirely.
      stubOrchestra({ row: entries({ bundle_code: '', bundle_sha: '' }) });

      const { request, params } = get();
      const response = await GET(request, { params });

      expect(response.status).toBe(404);
    });
  });

  describe('the row query', () => {
    it('joins the requested fields with & so the projection matches something', async () => {
      // A comma here returns zero rows and no error.
      const fetchSpy = stubOrchestra();

      const { request, params } = get();
      await GET(request, { params });

      const fields = logsCall(fetchSpy)?.searchParams.get('from_fields');
      expect(fields).toContain('bundle_code&bundle_sha');
      expect(fields).not.toContain(',');
    });

    it('does not read the authored source or the build report', async () => {
      // Both are sizeable and neither is needed to render, so paying for them on
      // every view would be a per-viewer cost for nothing.
      const fetchSpy = stubOrchestra();

      const { request, params } = get();
      await GET(request, { params });

      const fields = logsCall(fetchSpy)?.searchParams.get('from_fields') ?? '';
      expect(fields).not.toContain('tsx_source');
      expect(fields).not.toContain('build_json');
    });

    it('reads as the owner, not with the admin key', async () => {
      // Orchestra's data endpoints authenticate a user key and have no admin
      // bypass, so the admin key here would be a 401 rather than a wider read.
      const fetchSpy = stubOrchestra();

      const { request, params } = get();
      await GET(request, { params });

      const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('/v0/logs'));
      const headers = new Headers((call?.[1] as RequestInit)?.headers);
      expect(headers.get('Authorization')).toBe('Bearer owner-key');
    });
  });

  describe('what the frame is handed', () => {
    it('preserves author-declared prop keys exactly', async () => {
      stubOrchestra();

      const { request, params } = get();
      const response = await GET(request, { params });
      const body = await response.json();

      expect(body.props).toEqual(PROPS);
      expect(Object.keys(body.props)).toContain('total_rows');
      expect(Object.keys(body.props)).not.toContain('totalRows');
    });

    it('derives the alias allowlist from the stored bindings', async () => {
      // CanvasFrame refuses any alias absent from this list, so it has to come
      // from the record rather than from the frame.
      stubOrchestra();

      const { request, params } = get();
      const response = await GET(request, { params });
      const body = await response.json();

      expect(body.aliases).toEqual(['tasks', 'openDeals']);
    });

    it('reports no aliases when the bindings column is unreadable', async () => {
      stubOrchestra({ row: entries({ bindings_json: 'not json' }) });

      const { request, params } = get();
      const response = await GET(request, { params });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.aliases).toEqual([]);
    });
  });

  describe('authorization comes first', () => {
    it('refuses an unauthenticated caller without touching Orchestra', async () => {
      getApiKeyFromRequest.mockResolvedValue(null);
      const fetchSpy = stubOrchestra();

      const { request, params } = get();
      const response = await GET(request, { params });

      expect(response.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('never reads the row for a viewer it rejected', async () => {
      getCurrentUser.mockResolvedValue({ id: 'someone-else', organizations: [] });
      const fetchSpy = stubOrchestra();

      const { request, params } = get();
      const response = await GET(request, { params });

      expect(response.status).toBe(403);
      expect(logsCall(fetchSpy)).toBeNull();
    });

    it('refuses a quarantined canvas', async () => {
      // Quarantine is the kill switch, and it has to stop the bundle as well as
      // the data reads.
      const fetchSpy = stubOrchestra({
        resolution: { ...OWNER_RESOLUTION, status: 'quarantined' },
      });

      const { request, params } = get();
      const response = await GET(request, { params });

      expect(response.status).toBe(404);
      expect(logsCall(fetchSpy)).toBeNull();
    });
  });
});
