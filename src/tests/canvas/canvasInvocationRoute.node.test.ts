/**
 * Canvas invocation status: the route, and the merge that feeds the frame.
 *
 * This is the path that moves a control out of "working". It polls rather than
 * relying on the assistant event stream because a `team` canvas can be read by
 * someone who is not permitted to see the assistant — for those viewers a
 * stream-only design reports nothing, and the button never settles.
 *
 * The merge is tested because two sources observe the same run: the poller, because
 * this client started it, and the stream, because the assistant announced it
 * finishing. `CanvasFrame` posts whatever it is handed, so a duplicate transition
 * would reach the canvas twice.
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

import { GET } from '@/app/api/canvas/[token]/invocations/[id]/route';
import { mergeInvocationEvents } from '@/lib/client/canvasInvocations';

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

function get(id = '0', token = TOKEN) {
  return {
    request: new NextRequest(`http://localhost/api/canvas/${token}/invocations/${id}`),
    params: Promise.resolve({ token, id }),
  };
}

/** A fresh `Response` per branch: a body can only be consumed once. */
function stubOrchestra(
  invocation: Record<string, unknown> | null = {
    invocation_id: 0,
    action_name: 'bulk_send',
    status: 'succeeded',
    run_key: 'k',
  }
) {
  return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/admin/canvas/tokens/')) {
      return new Response(JSON.stringify(OWNER_RESOLUTION), { status: 200 });
    }
    if (url.includes('/invocations/')) {
      return invocation
        ? new Response(JSON.stringify(invocation), { status: 200 })
        : new Response(JSON.stringify({ detail: 'Invocation not found' }), { status: 404 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe('canvas invocation route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getCurrentUser.mockReset();
    getApiKeyFromRequest.mockReset();
    getApiKeyFromRequest.mockResolvedValue('viewer-key');
    getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
    process.env.ORCHESTRA_URL = 'http://127.0.0.1:8000';
    process.env.ORCHESTRA_ADMIN_KEY = 'admin-key';
  });

  it('reports a finished run', async () => {
    stubOrchestra();

    const { request, params } = get('0');
    const response = await GET(request, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('succeeded');
    expect(body.actionName).toBe('bulk_send');
  });

  it('polls the very first run of a canvas, whose id is 0', async () => {
    // Auto-counted ids are 0-based; a truthiness check here would make the first
    // run of every canvas unpollable and hang its control.
    const fetchSpy = stubOrchestra();

    const { request, params } = get('0');
    const response = await GET(request, { params });

    expect(response.status).toBe(200);
    const polled = fetchSpy.mock.calls.find(([url]) => String(url).includes('/invocations/'));
    expect(String(polled?.[0])).toContain('/invocations/0');
  });

  it('rejects a non-numeric invocation id before calling Orchestra', async () => {
    const fetchSpy = stubOrchestra();

    const { request, params } = get('../actions');
    const response = await GET(request, { params });

    expect(response.status).toBe(400);
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('/invocations/'))).toHaveLength(
      0
    );
  });

  it('refuses a viewer who may not read the canvas', async () => {
    getCurrentUser.mockResolvedValue({ id: 'someone-else', organizations: [] });
    const fetchSpy = stubOrchestra();

    const { request, params } = get('0');
    const response = await GET(request, { params });

    expect(response.status).toBe(403);
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('/invocations/'))).toHaveLength(
      0
    );
  });

  it('refuses an unauthenticated caller', async () => {
    getApiKeyFromRequest.mockResolvedValue(null);
    const fetchSpy = stubOrchestra();

    const { request, params } = get('0');
    const response = await GET(request, { params });

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('merging invocation reports', () => {
  it('keeps one report per transition when both sources see it', () => {
    const polled = [{ invocationId: 0, status: 'succeeded' }];
    const streamed = [{ invocationId: 0, status: 'succeeded' }];

    expect(mergeInvocationEvents(polled, streamed)).toEqual([
      { invocationId: 0, status: 'succeeded' },
    ]);
  });

  it('keeps distinct transitions of the same run', () => {
    // running → succeeded is two reports about one run, not a duplicate.
    const merged = mergeInvocationEvents(
      [{ invocationId: 1, status: 'running' }],
      [{ invocationId: 1, status: 'succeeded' }]
    );

    expect(merged.map((event) => event.status)).toEqual(['running', 'succeeded']);
  });

  it('does not collapse the same status across different runs', () => {
    const merged = mergeInvocationEvents([
      { invocationId: 0, status: 'succeeded' },
      { invocationId: 1, status: 'succeeded' },
    ]);

    expect(merged).toHaveLength(2);
  });

  it('preserves the order transitions were observed in', () => {
    const merged = mergeInvocationEvents(
      [{ invocationId: 0, status: 'running' }],
      [{ invocationId: 0, status: 'failed', error: 'SMTP refused' }]
    );

    expect(merged[1].error).toBe('SMTP refused');
  });
});
