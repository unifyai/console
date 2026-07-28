/**
 * Canvas action proxy route.
 *
 * The write path, so the ordering assertions matter more than anywhere else:
 * authorization has to happen before the admin key is used, and the viewer's
 * identity has to come from the session rather than the body — otherwise one
 * viewer can spend another's rate limit and mislabel the audit row.
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

import { POST } from '@/app/api/canvas/[token]/action/route';

const TOKEN = 'canvas_tok01';
const OWNER = 'user-owner';

const RESOLUTION = {
  context_name: 'u1/7/Canvas/Views',
  user_id: OWNER,
  organization_id: null,
  project_id: 1,
  project_name: 'proj',
  visibility: 'private',
  status: 'published',
};

const INVOCATION = {
  invocation_id: 0,
  action_name: 'bulk_send',
  status: 'pending',
  run_key: 'abc',
  deduplicated: false,
};

function post(body: unknown, token = TOKEN) {
  return {
    request: new NextRequest(`http://localhost/api/canvas/${token}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ token }),
  };
}

function stubOrchestra(
  resolution: Record<string, unknown> | null,
  action: { body: unknown; status?: number } = { body: INVOCATION }
) {
  return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/admin/canvas/tokens/')) {
      return resolution
        ? new Response(JSON.stringify(resolution), { status: 200 })
        : new Response(JSON.stringify({ detail: 'Token not found' }), { status: 404 });
    }
    if (url.includes('/action')) {
      return new Response(JSON.stringify(action.body), { status: action.status ?? 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

function asOwner() {
  getApiKeyFromRequest.mockResolvedValue('viewer-key');
  getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
}

describe('canvas action route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getCurrentUser.mockReset();
    getApiKeyFromRequest.mockReset();
    process.env.ORCHESTRA_URL = 'http://127.0.0.1:8000';
    process.env.ORCHESTRA_ADMIN_KEY = 'admin-key';
  });

  describe('authorization', () => {
    it('refuses an unauthenticated caller without touching Orchestra', async () => {
      getApiKeyFromRequest.mockResolvedValue(null);
      const fetchSpy = stubOrchestra(RESOLUTION);

      const { request, params } = post({ actionName: 'bulk_send', args: {} });
      const response = await POST(request, { params });

      expect(response.status).toBe(401);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('never dispatches for a viewer it rejected', async () => {
      getApiKeyFromRequest.mockResolvedValue('viewer-key');
      getCurrentUser.mockResolvedValue({ id: 'someone-else', organizations: [] });
      const fetchSpy = stubOrchestra(RESOLUTION);

      const { request, params } = post({ actionName: 'bulk_send', args: {} });
      const response = await POST(request, { params });

      expect(response.status).toBe(403);
      const dispatched = fetchSpy.mock.calls.filter(([url]) => String(url).endsWith('/action'));
      expect(dispatched).toHaveLength(0);
    });

    it('refuses a quarantined canvas', async () => {
      // Quarantine has to stop the write path, not just reads — otherwise the most
      // dangerous half of a pulled canvas keeps working.
      asOwner();
      stubOrchestra({ ...RESOLUTION, status: 'quarantined' });

      const { request, params } = post({ actionName: 'bulk_send', args: {} });

      expect((await POST(request, { params })).status).toBe(404);
    });
  });

  describe('identity', () => {
    it('takes the viewer from the session, not the body', async () => {
      // A client-supplied identity would let one viewer spend another's rate limit
      // and put the wrong name on the audit row.
      asOwner();
      const fetchSpy = stubOrchestra(RESOLUTION);

      const { request, params } = post({
        actionName: 'bulk_send',
        args: {},
        requestedByUserId: 'somebody-else',
      });
      await POST(request, { params });

      const dispatch = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/action'));
      const sent = JSON.parse(String((dispatch?.[1] as RequestInit).body));
      expect(sent.requested_by_user_id).toBe(OWNER);
    });

    it('forwards only the action name, arguments and run key', async () => {
      asOwner();
      const fetchSpy = stubOrchestra(RESOLUTION);

      const { request, params } = post({
        actionName: 'bulk_send',
        args: { recipients: ['a@b.com'] },
        runKey: 'retry-key',
        // An attempt to name a target directly.
        functionId: 42,
        taskId: 7,
      });
      await POST(request, { params });

      const dispatch = fetchSpy.mock.calls.find(([url]) => String(url).endsWith('/action'));
      const sent = JSON.parse(String((dispatch?.[1] as RequestInit).body));
      expect(Object.keys(sent).sort()).toEqual([
        'action_name',
        'args',
        'requested_by_user_id',
        'run_key',
      ]);
      expect(sent.action_name).toBe('bulk_send');
      expect(sent.run_key).toBe('retry-key');
    });
  });

  describe('input validation', () => {
    it.each([
      ['a malformed action name', { actionName: 'Bulk Send!', args: {} }],
      ['a missing action name', { args: {} }],
      ['array arguments', { actionName: 'bulk_send', args: [1, 2] }],
      ['a non-string run key', { actionName: 'bulk_send', args: {}, runKey: 7 }],
    ])('rejects %s', async (_label, body) => {
      asOwner();
      stubOrchestra(RESOLUTION);

      const { request, params } = post(body);

      expect((await POST(request, { params })).status).toBe(400);
    });
  });

  describe('responses', () => {
    it('returns the invocation, including id zero', async () => {
      // Auto-counted ids are 0-based, so a falsy check anywhere on this path drops
      // the very first invocation of a canvas.
      asOwner();
      stubOrchestra(RESOLUTION, { body: { ...INVOCATION, invocation_id: 0 } });

      const { request, params } = post({ actionName: 'bulk_send', args: {} });
      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        invocationId: 0,
        actionName: 'bulk_send',
        status: 'pending',
      });
    });

    it("keeps Orchestra's validation message", async () => {
      asOwner();
      stubOrchestra(RESOLUTION, {
        body: { detail: 'recipients: [1, 2, 3, 4] is too long' },
        status: 400,
      });

      const { request, params } = post({ actionName: 'bulk_send', args: {} });
      const response = await POST(request, { params });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: 'recipients: [1, 2, 3, 4] is too long',
      });
    });

    it('passes a rate limit through as 429', async () => {
      asOwner();
      stubOrchestra(RESOLUTION, {
        body: { detail: 'This action is limited to 20 runs an hour.' },
        status: 429,
      });

      const { request, params } = post({ actionName: 'bulk_send', args: {} });

      expect((await POST(request, { params })).status).toBe(429);
    });
  });
});
