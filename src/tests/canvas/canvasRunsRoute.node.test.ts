/**
 * A canvas's run history.
 *
 * The reason this is served from the stored rows and rendered in console chrome,
 * rather than offered to the canvas as a kit component, is that run metadata is the
 * sharpest thing a prompt-injected canvas could misstate — it could omit the history,
 * restyle it, or show one success beside a control that failed nine times. These
 * tests pin the parts that make it trustworthy: it reads the invocation rows, it
 * decodes the arguments that were actually submitted, and it refuses a viewer who
 * may not read the canvas.
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

import { GET } from '@/app/api/canvas/[token]/runs/route';

const TOKEN = 'canvas_tok01';
const OWNER = 'user-owner';

const OWNER_RESOLUTION = {
  context_name: `${OWNER}/42/Canvas/Views`,
  user_id: OWNER,
  organization_id: null,
  project_id: 1,
  project_name: 'Assistants',
  visibility: 'private',
  status: 'published',
};

/**
 * Two runs of one action, deliberately out of id order.
 *
 * `recipient_emails` mixes casing styles on purpose: those keys are the author's
 * declared argument names, and renaming one would misreport what was submitted.
 */
const ROWS = [
  {
    invocation_id: 0,
    canvas_token: TOKEN,
    action_name: 'bulk_send',
    args_json: JSON.stringify({ recipient_emails: ['a@x.com', 'b@x.com'], dryRun: false }),
    status: 'failed',
    error: 'SMTP refused',
    requested_by_user_id: OWNER,
    created_at: '2026-07-29T10:00:00Z',
    finished_at: '2026-07-29T10:00:04Z',
  },
  {
    invocation_id: 1,
    canvas_token: TOKEN,
    action_name: 'bulk_send',
    args_json: JSON.stringify({ recipient_emails: ['a@x.com'], dryRun: true }),
    status: 'succeeded',
    error: null,
    requested_by_user_id: OWNER,
    created_at: '2026-07-29T10:05:00Z',
    finished_at: '2026-07-29T10:05:01Z',
  },
];

function get(token = TOKEN) {
  return {
    request: new NextRequest(`http://localhost/api/canvas/${token}/runs`),
    params: Promise.resolve({ token }),
  };
}

/** A fresh `Response` per branch: a body can only be consumed once. */
function stubOrchestra(rows: Array<Record<string, unknown>> = ROWS) {
  return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/admin/canvas/tokens/')) {
      return new Response(JSON.stringify(OWNER_RESOLUTION), { status: 200 });
    }
    if (url.includes('/admin/user/by-user-id')) {
      return new Response(JSON.stringify({ api_key: 'owner-key' }), { status: 200 });
    }
    if (url.includes('/v0/logs')) {
      return new Response(JSON.stringify({ logs: rows.map((row) => ({ entries: row })) }), {
        status: 200,
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

function logsCall(fetchSpy: ReturnType<typeof stubOrchestra>): URL {
  const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('/v0/logs'));
  return new URL(String(call?.[0]));
}

describe('canvas runs route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getCurrentUser.mockReset();
    getApiKeyFromRequest.mockReset();
    getApiKeyFromRequest.mockResolvedValue('viewer-key');
    getCurrentUser.mockResolvedValue({ id: OWNER, organizations: [] });
    process.env.ORCHESTRA_URL = 'http://127.0.0.1:8000';
    process.env.ORCHESTRA_ADMIN_KEY = 'admin-key';
  });

  it('reads the invocation rows, not the canvas record', async () => {
    // The token records the Views context; the runs live in a sibling. Reading the
    // wrong one returns the canvas itself and no history at all.
    const fetchSpy = stubOrchestra();

    const { request, params } = get();
    await GET(request, { params });

    expect(logsCall(fetchSpy).searchParams.get('context')).toBe(`${OWNER}/42/Canvas/Invocations`);
    expect(logsCall(fetchSpy).searchParams.get('filter')).toBe(`canvas_token == '${TOKEN}'`);
  });

  it('returns newest first', async () => {
    stubOrchestra();

    const { request, params } = get();
    const body = await (await GET(request, { params })).json();

    expect(body.runs.map((run: { invocationId: number }) => run.invocationId)).toEqual([1, 0]);
  });

  it('keeps the very first run of a canvas, whose id is 0', async () => {
    // Auto-counted ids are 0-based, so dropping falsy ids loses a real run.
    stubOrchestra([ROWS[0]]);

    const { request, params } = get();
    const body = await (await GET(request, { params })).json();

    expect(body.runs).toHaveLength(1);
    expect(body.runs[0].invocationId).toBe(0);
  });

  it('reports the arguments that were actually submitted, keys intact', async () => {
    stubOrchestra();

    const { request, params } = get();
    const body = await (await GET(request, { params })).json();

    const failed = body.runs.find((run: { status: string }) => run.status === 'failed');
    expect(failed.args).toEqual({ recipient_emails: ['a@x.com', 'b@x.com'], dryRun: false });
    // Camelising these would rename the author's own declared argument.
    expect(Object.keys(failed.args)).toContain('recipient_emails');
    expect(failed.error).toBe('SMTP refused');
  });

  it('does not read the result or progress payloads', async () => {
    // A history list shows what was asked and how it ended; a result can be any size.
    const fetchSpy = stubOrchestra();

    const { request, params } = get();
    await GET(request, { params });

    const fields = logsCall(fetchSpy).searchParams.get('from_fields') ?? '';
    expect(fields).not.toContain('result_json');
    expect(fields).not.toContain('progress_json');
    expect(fields).toContain('args_json');
    // A comma here matches no field and returns zero rows, silently.
    expect(fields).not.toContain(',');
  });

  it('survives an unreadable arguments column', async () => {
    stubOrchestra([{ ...ROWS[0], args_json: 'not json' }]);

    const { request, params } = get();
    const response = await GET(request, { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.runs[0].args).toEqual({});
  });

  it('refuses a viewer who may not read the canvas', async () => {
    getCurrentUser.mockResolvedValue({ id: 'someone-else', organizations: [] });
    const fetchSpy = stubOrchestra();

    const { request, params } = get();
    const response = await GET(request, { params });

    expect(response.status).toBe(403);
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('/v0/logs'))).toHaveLength(0);
  });

  it('refuses an unauthenticated caller', async () => {
    getApiKeyFromRequest.mockResolvedValue(null);
    const fetchSpy = stubOrchestra();

    const { request, params } = get();
    const response = await GET(request, { params });

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
