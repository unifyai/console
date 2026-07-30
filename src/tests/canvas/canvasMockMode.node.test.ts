/**
 * Canvas under mock simulation mode.
 *
 * Mock mode is how the canvas UX gets looked at before a live stack exists, so what
 * matters is that it exercises the *real* route logic against fixtures rather than
 * short-circuiting it. These tests drive the actual handlers with
 * `NEXT_PUBLIC_MOCK_SIM=true` and no Orchestra, and assert the parts that would
 * quietly become theatre if the fixture were sloppy:
 *
 * - the bundle's stored sha is the sha of its own bytes, so `fetchCanvasRecord`
 *   performs the same integrity check it performs in production;
 * - only a declared alias resolves, so the alias-only contract still holds;
 * - an action writes an invocation the history then reports.
 *
 * A fixture that failed any of these would let mock mode show a working canvas while
 * the equivalent production path was broken.
 */

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock-mode identity reads the scenario cookies through `next/headers`, which needs
 * a Next request scope that a bare handler call has no way to provide. Returning an
 * empty store selects the default scenario, which is what a fresh browser does too.
 */
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
  headers: async () => new Headers(),
}));

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn().mockResolvedValue(null),
}));

import { createHash } from 'node:crypto';

import {
  MOCK_CANVAS_ACTION,
  MOCK_CANVAS_ALIAS,
  MOCK_CANVAS_BUNDLE,
  MOCK_CANVAS_BUNDLE_SHA,
  MOCK_CANVAS_TOKEN,
} from '@/lib/simulation/fixtures/canvas';

const REAL_MOCK_FLAG = process.env.NEXT_PUBLIC_MOCK_SIM;

/** Routes are imported after the flag is set: the seam reads it at call time. */
let RECORD: typeof import('@/app/api/canvas/[token]/route');
let QUERY: typeof import('@/app/api/canvas/[token]/query/route');
let ACTION: typeof import('@/app/api/canvas/[token]/action/route');
let RUNS: typeof import('@/app/api/canvas/[token]/runs/route');

beforeAll(async () => {
  process.env.NEXT_PUBLIC_MOCK_SIM = 'true';
  RECORD = await import('@/app/api/canvas/[token]/route');
  QUERY = await import('@/app/api/canvas/[token]/query/route');
  ACTION = await import('@/app/api/canvas/[token]/action/route');
  RUNS = await import('@/app/api/canvas/[token]/runs/route');
});

afterAll(() => {
  process.env.NEXT_PUBLIC_MOCK_SIM = REAL_MOCK_FLAG;
});

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost/api/canvas/${MOCK_CANVAS_TOKEN}${path}`, init);
}

function params(extra: Record<string, string> = {}) {
  return Promise.resolve({ token: MOCK_CANVAS_TOKEN, ...extra });
}

function post(path: string, body: unknown) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('the seeded bundle', () => {
  it('matches its pinned content address', () => {
    // The sha cannot be computed in the fixture: the simulation handlers are
    // reachable from the client bundle through the Orchestra clients' top-level
    // `simulationFetch` import, and `node:crypto` has no browser resolution, so
    // importing it there fails the build. Pinning it moves the check here, where
    // node builtins are available.
    const actual = createHash('sha256').update(MOCK_CANVAS_BUNDLE, 'utf8').digest('hex');
    expect(actual, `update MOCK_CANVAS_BUNDLE_SHA to '${actual}'`).toBe(MOCK_CANVAS_BUNDLE_SHA);
  });

  it('has no import that the runtime host cannot resolve', () => {
    // The host resolves react and the kit through its import map and nothing else;
    // `connect-src 'none'` means a third import would simply fail to load.
    const imports = [...MOCK_CANVAS_BUNDLE.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(new Set(imports)).toEqual(new Set(['react', '@unity/canvas-kit']));
  });
});

describe('canvas in mock mode', () => {
  beforeEach(() => {
    // No Orchestra is reachable; a real request escaping the seam should be loud.
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      throw new Error(`mock mode leaked a real request to ${String(input)}`);
    });
  });

  it('serves a canvas whose bundle passes the real integrity check', async () => {
    // The sha is computed from the fixture's own bytes, so this is the production
    // check running — not a bypass.
    const response = await RECORD.GET(request(''), { params: params() });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe(MOCK_CANVAS_BUNDLE);
    expect(body.title).toBe('Open task tracker');
  });

  it('hands the frame the alias and the action it needs', async () => {
    const body = await (await RECORD.GET(request(''), { params: params() })).json();

    expect(body.aliases).toEqual([MOCK_CANVAS_ALIAS]);
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].name).toBe(MOCK_CANVAS_ACTION);
    // The confirmation dialog is part of what mock mode is meant to demonstrate.
    expect(body.actions[0].requiresConfirmation).toBe(true);
  });

  it('materialises the props the canvas reads', async () => {
    const body = await (await RECORD.GET(request(''), { params: params() })).json();

    expect(body.props).toEqual({ syncedAt: 'a moment ago' });
  });

  it('resolves the declared binding', async () => {
    const response = await QUERY.POST(post('/query', { alias: MOCK_CANVAS_ALIAS }), {
      params: params(),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rows.length).toBeGreaterThan(0);
    expect(body.rows[0]).toHaveProperty('owner');
  });

  it('refuses an alias the canvas never declared', async () => {
    // The whole security property of the read plane, and it has to hold on
    // fixtures too or mock mode would teach the wrong lesson.
    const response = await QUERY.POST(post('/query', { alias: 'secrets' }), { params: params() });

    expect(response.status).toBe(404);
  });

  it('records a run that the history then reports', async () => {
    const invoked = await ACTION.POST(
      post('/action', { actionName: MOCK_CANVAS_ACTION, args: { recipients: ['Priya'] } }),
      { params: params() }
    );
    const invocation = await invoked.json();

    expect(invoked.status).toBe(200);
    expect(typeof invocation.invocationId).toBe('number');

    const runs = await (await RUNS.GET(request('/runs'), { params: params() })).json();
    const recorded = runs.runs.find(
      (run: { invocationId: number }) => run.invocationId === invocation.invocationId
    );

    expect(recorded).toBeDefined();
    expect(recorded.args).toEqual({ recipients: ['Priya'] });
  });

  it('seeds a failed run, so the history shows more than successes', async () => {
    // A history of nothing but successes would demonstrate none of what the panel
    // is for.
    const runs = await (await RUNS.GET(request('/runs'), { params: params() })).json();

    expect(runs.runs.some((run: { status: string }) => run.status === 'failed')).toBe(true);
    const failed = runs.runs.find((run: { status: string }) => run.status === 'failed');
    expect(failed.error).toContain('no email on file');
  });

  it('serves the tab listing from the Canvas/Views context', async () => {
    // What the Canvas tab reads to build its picker.
    const { simulationFetch } = await import('@/lib/simulation/dispatch');
    const url = new URL('http://mock.local/v0/logs');
    url.searchParams.set('project_name', 'Assistants');
    url.searchParams.set('context', 'mock-user-0001/1001/Canvas/Views');
    url.searchParams.set('from_fields', 'token&title&status&updated_at');

    const body = await (
      await simulationFetch(url.toString(), {
        headers: { Authorization: 'Bearer mock-sim-key:default::personal' },
      })
    ).json();

    expect(body.logs).toHaveLength(1);
    expect(body.logs[0].entries.token).toBe(MOCK_CANVAS_TOKEN);
    expect(body.logs[0].entries.status).toBe('published');
  });

  it('does not swallow another context-backed table', async () => {
    // The canvas handler claims `/v0/logs`, a path the generic brain handler also
    // claims. Discriminating in `match` rather than `handle` is what keeps Contacts,
    // Tasks, Knowledge and the rest reaching their own handler; getting this wrong
    // would empty every other tab in mock mode.
    const { simulationFetch } = await import('@/lib/simulation/dispatch');
    const url = new URL('http://mock.local/v0/logs');
    url.searchParams.set('project_name', 'Assistants');
    url.searchParams.set('context', 'mock-user-0001/1001/Contacts');

    const body = await (
      await simulationFetch(url.toString(), {
        headers: { Authorization: 'Bearer mock-sim-key:default::personal' },
      })
    ).json();

    expect(body.logs.length).toBeGreaterThan(0);
    expect(body.logs[0].entries).not.toHaveProperty('bundleCode');
  });

  it('reaches no real backend at any point', async () => {
    await RECORD.GET(request(''), { params: params() });
    await QUERY.POST(post('/query', { alias: MOCK_CANVAS_ALIAS }), { params: params() });
    await RUNS.GET(request('/runs'), { params: params() });

    // Every branch above went through the simulation seam; the spy throws if not.
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
