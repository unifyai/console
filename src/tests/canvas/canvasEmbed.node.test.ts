/**
 * Canvas as a chat embed.
 *
 * Registering a new embed type means touching four separate places, and only one of
 * them is type-checked: `EMBED_META` is a `Record<EmbedType, …>` so a missing entry
 * is a compile error, but `EMBED_PATTERNS` and `EMBED_TYPES` are arrays, and
 * omitting a type there fails at runtime by simply not recognising the URL. These
 * tests cover the two untyped halves.
 *
 * The meta route tests cover a different risk: the other embed types treat holding a
 * token as permission to read, and a canvas must not, because its title is exactly
 * the kind of thing a private view should not disclose.
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
  unauthorized: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));

import {
  containsEmbedUrl,
  escapeEmbedTokens,
  getEmbedViewPath,
  parseEmbedUrl,
} from '@/components/Chat/InlineEmbed';
import { GET as META } from '@/app/api/embed/[type]/[token]/meta/route';

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

describe('canvas embed URL recognition', () => {
  it('recognises a canvas view path', () => {
    expect(parseEmbedUrl('/canvas/view/abc123')).toEqual({
      type: 'canvas',
      token: 'abc123',
      url: '/canvas/view/abc123',
    });
  });

  it('recognises a canvas view URL on another host', () => {
    // Chat messages routinely carry a full staging URL; the embed still has to
    // resolve to a same-origin path.
    const url = 'https://console.unify.ai/canvas/view/abc123';
    expect(parseEmbedUrl(url)?.type).toBe('canvas');
    expect(containsEmbedUrl(`see ${url} for details`)).toBe(true);
  });

  it('opens a canvas on this origin rather than the URL in the message', () => {
    expect(getEmbedViewPath({ type: 'canvas', token: 'abc123' })).toBe('/canvas/view/abc123');
  });

  it('percent-encodes underscores in a canvas token', () => {
    // Markdown would otherwise consume the underscore as an emphasis delimiter,
    // which silently corrupts the token. This only works if 'canvas' is in
    // EMBED_TYPES, since the pattern is built from it.
    expect(escapeEmbedTokens('/canvas/view/tok_en_1')).toBe('/canvas/view/tok%5Fen%5F1');
  });

  it('recognises a canvas URL and nothing else at that path shape', () => {
    expect(parseEmbedUrl('/canvas/view/abc123')?.type).toBe('canvas');
    expect(parseEmbedUrl('/dashboard/view/abc123')).toBeNull();
  });
});

describe('canvas embed meta route', () => {
  function meta(token = TOKEN, type = 'canvas') {
    return {
      request: new NextRequest(`http://localhost/api/embed/${type}/${token}/meta`),
      params: Promise.resolve({ type, token }),
    };
  }

  /** A fresh `Response` per branch: a body can only be consumed once. */
  function stubOrchestra(resolution: Record<string, unknown> | null = OWNER_RESOLUTION) {
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
        return new Response(
          JSON.stringify({
            logs: [
              { entries: { token: TOKEN, title: 'Quarterly pipeline', description: 'Deals' } },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    getCurrentUser.mockReset();
    getApiKeyFromRequest.mockReset();
    getApiKeyFromRequest.mockResolvedValue('viewer-key');
    getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
    process.env.ORCHESTRA_URL = 'http://127.0.0.1:8000';
    process.env.ORCHESTRA_ADMIN_KEY = 'admin-key';
  });

  it('captions a canvas the viewer may read', async () => {
    stubOrchestra();

    const { request, params } = meta();
    const response = await META(request, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.title).toBe('Quarterly pipeline');
    expect(body.description).toBe('Deals');
  });

  it('does not disclose the title to a viewer outside the canvas', async () => {
    getCurrentUser.mockResolvedValue({ id: 'someone-else', organizations: [] });
    stubOrchestra();

    const { request, params } = meta();
    const response = await META(request, { params });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(JSON.stringify(body)).not.toContain('Quarterly pipeline');
  });

  it('does not disclose the title of a quarantined canvas', async () => {
    stubOrchestra({ ...OWNER_RESOLUTION, status: 'quarantined' });

    const { request, params } = meta();
    const response = await META(request, { params });

    expect(response.status).toBe(404);
  });

  it('reads only the caption fields, never the bundle', async () => {
    // A collapsed preview card shows a title; pulling the compiled bundle to
    // render one line of text would be three orders of magnitude of waste.
    const fetchSpy = stubOrchestra();

    const { request, params } = meta();
    await META(request, { params });

    const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('/v0/logs'));
    const fields = new URL(String(call?.[0])).searchParams.get('from_fields') ?? '';
    expect(fields).not.toContain('bundle_code');
    expect(fields).toContain('title');
  });
});
