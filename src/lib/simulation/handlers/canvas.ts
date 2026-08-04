/**
 * Canvas endpoints under mock simulation.
 *
 * Canvas reads do not all go through the Orchestra client: the token plane is a set
 * of admin endpoints the canvas routes call directly, because they act as the
 * platform rather than as the viewer. Those calls are routed here through the same
 * `simulationFetch` seam, so mock mode exercises the real route logic — viewer
 * authorization, the sha check, the alias-only query contract — against fixtures.
 *
 * The one thing deliberately *not* faked is the runtime host. The frame still loads
 * the real host from the canvas origin and still renders a real bundle through it,
 * because the frame protocol and the isolation are most of what there is to look at.
 * Mock mode therefore needs the host served on the canvas origin; nothing else.
 */

import type { SimContext, SimHandler, SimResult } from '../dispatch';
import {
  MOCK_CANVAS_ACTION,
  MOCK_CANVAS_ACTION_DESCRIPTOR,
  MOCK_CANVAS_ALIAS,
  MOCK_CANVAS_ROWS,
  MOCK_CANVAS_TOKEN,
  mockCanvasInvocationRows,
  mockCanvasViewRow,
} from '../fixtures/canvas';

/** The seeded owner, matching the shape `authorizeCanvasRead` expects. */
function resolution(ctx: SimContext) {
  const user = ctx.scenario.user;
  const assistant = ctx.scenario.assistants[0];
  return {
    entityType: 'canvas',
    contextName: `${user.id}/${assistant?.agentId ?? 1001}/Canvas/Views`,
    userId: user.id,
    organizationId: ctx.workspaceId === 'personal' ? null : Number(ctx.workspaceId),
    projectId: 1,
    projectName: 'Assistants',
    visibility: 'private',
    status: 'published',
  };
}

/** `/v0/admin/canvas/tokens/{token}` — resolve a token to its owner. */
const tokenResolution: SimHandler = {
  match: (method, pathname) =>
    method === 'GET' && /^\/v0\/admin\/canvas\/tokens\/[^/]+$/.test(pathname),
  handle: (ctx: SimContext): SimResult => {
    const token = ctx.pathname.split('/').pop();
    if (token !== MOCK_CANVAS_TOKEN) {
      return { status: 404, json: { detail: 'Token not found' } };
    }
    return { json: resolution(ctx) };
  },
};

/**
 * `POST /v0/admin/canvas/{token}/queries` — run stored bindings as a batch.
 *
 * Only a declared alias resolves; an undeclared one carries a per-alias error
 * naming it, matching the real plane, so the frame's refusal path is what mock
 * mode shows too.
 */
const bindingQueries: SimHandler = {
  match: (method, pathname) =>
    method === 'POST' && /^\/v0\/admin\/canvas\/[^/]+\/queries$/.test(pathname),
  handle: (ctx: SimContext): SimResult => {
    const aliases = (ctx.body as { aliases?: string[] } | undefined)?.aliases ?? [];
    const results: Record<string, unknown> = {};
    for (const alias of aliases) {
      results[alias] =
        alias === MOCK_CANVAS_ALIAS
          ? { rows: MOCK_CANVAS_ROWS, truncated: false, error: null }
          : { rows: [], truncated: false, error: `Canvas declares no binding named '${alias}'` };
    }
    return { json: { results } };
  },
};

/** `GET /v0/admin/canvas/{token}/actions` — descriptors, targets stripped. */
const actionDescriptors: SimHandler = {
  match: (method, pathname) =>
    method === 'GET' && /^\/v0\/admin\/canvas\/[^/]+\/actions$/.test(pathname),
  handle: (): SimResult => ({ json: { actions: [MOCK_CANVAS_ACTION_DESCRIPTOR] } }),
};

/**
 * `POST /v0/admin/canvas/{token}/action` — record a run.
 *
 * Appends to the session's invocation rows and settles immediately as succeeded.
 * There is no assistant in mock mode to execute anything, and a run left pending
 * would leave the control stuck in the one state the whole reporting path exists to
 * get it out of.
 */
const invokeAction: SimHandler = {
  match: (method, pathname) =>
    method === 'POST' && /^\/v0\/admin\/canvas\/[^/]+\/action$/.test(pathname),
  handle: (ctx: SimContext): SimResult => {
    // Read by index: the route converts its envelope to Orchestra's wire casing
    // before sending, so the key really is snake_case on the way in.
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    if (body['action_name'] !== MOCK_CANVAS_ACTION) {
      return { status: 404, json: { detail: 'Action not declared on this canvas' } };
    }

    const rows = sessionInvocations(ctx.scenario.id);
    const invocationId = rows.length;
    rows.push({
      invocationId: invocationId,
      canvasToken: MOCK_CANVAS_TOKEN,
      actionName: MOCK_CANVAS_ACTION,
      argsJson: JSON.stringify(body.args ?? {}),
      status: 'succeeded',
      error: null,
      runKey: `mock-run-${invocationId}`,
      createdAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });

    return {
      json: {
        invocationId: invocationId,
        actionName: MOCK_CANVAS_ACTION,
        status: 'succeeded',
        runKey: `mock-run-${invocationId}`,
        deduplicated: false,
      },
    };
  },
};

/** `GET /v0/admin/canvas/{token}/invocations/{id}` — the polling fallback. */
const invocationStatus: SimHandler = {
  match: (method, pathname) =>
    method === 'GET' && /^\/v0\/admin\/canvas\/[^/]+\/invocations\/\d+$/.test(pathname),
  handle: (ctx: SimContext): SimResult => {
    const id = Number(ctx.pathname.split('/').pop());
    const row = sessionInvocations(ctx.scenario.id).find((entry) => entry.invocationId === id);
    if (!row) return { status: 404, json: { detail: 'Invocation not found' } };
    return { json: row };
  },
};

/**
 * Per-scenario invocation rows, so a run started in the session shows up in the
 * history panel afterwards rather than resetting on the next read.
 */
const invocationsByScenario = new Map<string, Array<Record<string, unknown>>>();

function sessionInvocations(scenarioId: string): Array<Record<string, unknown>> {
  const existing = invocationsByScenario.get(scenarioId);
  if (existing) return existing;
  const seeded = mockCanvasInvocationRows();
  invocationsByScenario.set(scenarioId, seeded);
  return seeded;
}

/**
 * `/v0/logs` for the `Canvas/*` contexts.
 *
 * Registered ahead of the generic context handler, which reads from the fixture
 * table store. The canvas rows are kept here instead because the bundle and its
 * content address belong together — splitting them risks a fixture whose sha does
 * not match its own bytes, which would fail the integrity check for real.
 */
const canvasLogs: SimHandler = {
  // Discriminated in `match`, not in `handle`: the dispatcher commits to the first
  // handler whose match succeeds, so claiming `/v0/logs` outright would swallow
  // every other context-backed table's reads.
  match: (method, pathname, ctx) =>
    method === 'GET' &&
    pathname === '/v0/logs' &&
    /Canvas\/[A-Za-z]+$/.test(ctx.searchParams.get('context') ?? ''),
  handle: (ctx: SimContext): SimResult => {
    const context = ctx.searchParams.get('context') ?? '';

    const rows = context.endsWith('Canvas/Invocations')
      ? sessionInvocations(ctx.scenario.id)
      : context.endsWith('Canvas/Views')
        ? [mockCanvasViewRow()]
        : [];

    // The route projects fields itself only in the sense of asking for them; the
    // real logs API narrows the payload, and returning the whole row here is
    // harmless because every consumer reads by name.
    return {
      json: {
        logs: rows.map((entries, index) => ({ id: index, ts: entries.createdAt, entries })),
        count: rows.length,
      },
    };
  },
};

/** `/v0/admin/user/by-user-id` — the owner key the record read presents to `/logs`. */
const ownerKey: SimHandler = {
  match: (method, pathname) => method === 'GET' && pathname === '/v0/admin/user/by-user-id',
  handle: (ctx: SimContext): SimResult => ({
    json: { apiKey: `mock-sim-key:${ctx.scenario.id}::${ctx.workspaceId}`, organizations: [] },
  }),
};

export const canvasHandlers: SimHandler[] = [
  tokenResolution,
  bindingQueries,
  actionDescriptors,
  invokeAction,
  invocationStatus,
  canvasLogs,
  ownerKey,
];
