/**
 * Server-side access control for a canvas.
 *
 * Every canvas route resolves a token here before it touches Orchestra's admin
 * API. The order matters and is the whole point:
 *
 *   1. authenticate the **viewer** from their session,
 *   2. resolve the token to its **owner** and access state,
 *   3. decide whether that viewer may read that canvas,
 *   4. only then use the admin key.
 *
 * A route that checks only that an admin key is configured — as the retired
 * dashboard tile bridges did — lets the admin key do the reading with nobody
 * establishing who asked. Doing that here would make the whole visibility
 * model decorative.
 *
 * Server-only: this module reads `ORCHESTRA_ADMIN_KEY` and must never be imported
 * into a client bundle.
 */

import type { NextRequest } from 'next/server';

import { canvasFetch } from '@/lib/canvas/canvasFetch';

import { getApiKeyFromRequest } from '@/app/api/_utils/auth';
import { getCurrentUser } from '@/lib/user/user';
import { camelToSnakeObject, snakeToCamelObject } from '@/utils/casing';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';

/** Who may read a canvas. Mirrors the constraint on Orchestra's canvas_token. */
export type CanvasVisibility = 'private' | 'team' | 'public_link';

/** Lifecycle of a canvas. Only `published` is servable. */
export type CanvasStatus = 'draft' | 'published' | 'quarantined';

export interface CanvasResolution {
  contextName: string;
  userId: string;
  organizationId: number | null;
  projectId: number;
  projectName: string;
  visibility: CanvasVisibility;
  status: CanvasStatus;
}

/** A refusal, shaped so a route can return it directly. */
export interface CanvasDenial {
  error: string;
  status: number;
}

export type CanvasAccess =
  | { ok: true; resolution: CanvasResolution }
  | { ok: false; denial: CanvasDenial };

/**
 * Tokens are twelve URL-safe characters from `secrets.token_urlsafe`.
 *
 * Checked before the token reaches a URL we build, so a malformed one is a 400
 * here rather than a confusing failure deeper in.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,12}$/;

function adminHeaders(): HeadersInit | null {
  const key = process.env.ORCHESTRA_ADMIN_KEY;
  return key ? { Authorization: `Bearer ${key}` } : null;
}

/** Resolve a canvas token to its owner and access state, as the platform. */
async function resolveToken(token: string): Promise<CanvasAccess> {
  const headers = adminHeaders();
  if (!headers) {
    return { ok: false, denial: { error: 'Server configuration error', status: 500 } };
  }

  const response = await canvasFetch(`${ORCHESTRA_URL}/v0/admin/canvas/tokens/${token}`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    // A missing token and an unreadable one are both "no such canvas" from here;
    // distinguishing them would leak whether a token exists.
    return {
      ok: false,
      denial: { error: 'Canvas not found', status: 404 },
    };
  }

  return {
    ok: true,
    resolution: snakeToCamelObject<CanvasResolution>(await response.json()),
  };
}

/**
 * Resolve a canvas the requesting viewer is allowed to read.
 *
 * Returns the resolution only when all four steps above pass. Callers may then
 * use the admin key on this token's behalf and no other.
 */
export async function authorizeCanvasRead(
  request: NextRequest,
  token: string
): Promise<CanvasAccess> {
  if (!TOKEN_PATTERN.test(token)) {
    return { ok: false, denial: { error: 'Malformed canvas token', status: 400 } };
  }

  // Step 1 — the viewer must be signed in at all. Checked before the token is
  // resolved so an unauthenticated caller cannot use this route to discover
  // whether a token exists.
  const viewerKey = await getApiKeyFromRequest(request);
  if (!viewerKey) {
    return { ok: false, denial: { error: 'Unauthorized', status: 401 } };
  }

  const resolved = await resolveToken(token);
  if (!resolved.ok) {
    return resolved;
  }
  const { resolution } = resolved;

  // Step 3a — lifecycle. Quarantine is the kill switch and it has to stop reads
  // as well as the bundle: a canvas pulled for leaking data would otherwise keep
  // answering for every frame already open.
  if (resolution.status !== 'published') {
    return { ok: false, denial: { error: 'Canvas is not available', status: 404 } };
  }

  // Step 3b — visibility, against the viewer's own identity.
  if (resolution.visibility === 'public_link') {
    return resolved;
  }

  const viewer = await getCurrentUser();
  if (!viewer) {
    return { ok: false, denial: { error: 'Unauthorized', status: 401 } };
  }

  if (viewer.id === resolution.userId) {
    return resolved;
  }

  if (resolution.visibility === 'team' && resolution.organizationId !== null) {
    const shared = viewer.organizations?.some((org) => org.id === resolution.organizationId);
    if (shared) {
      return resolved;
    }
  }

  // 403 rather than 404: the viewer demonstrably holds the token, so pretending
  // the canvas does not exist hides nothing and makes a permission problem look
  // like a broken link.
  return { ok: false, denial: { error: 'Forbidden', status: 403 } };
}

/**
 * Run one of a canvas's own declared bindings.
 *
 * The alias is all that is sent. Orchestra loads the canvas record and executes
 * the binding stored there, so neither this route nor the frame can name a
 * context, a filter or a row limit.
 */
/** One alias's outcome inside a batch query. */
export interface CanvasAliasResult {
  rows: unknown[];
  truncated: boolean;
  error?: string;
}

export async function queryCanvasAliases(
  token: string,
  aliases: string[]
): Promise<
  { ok: true; results: Record<string, CanvasAliasResult> } | { ok: false; denial: CanvasDenial }
> {
  const headers = adminHeaders();
  if (!headers) {
    return { ok: false, denial: { error: 'Server configuration error', status: 500 } };
  }

  const response = await canvasFetch(`${ORCHESTRA_URL}/v0/admin/canvas/${token}/queries`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ aliases }),
    cache: 'no-store',
  });

  if (!response.ok) {
    // Whole-request failures are properties of the canvas (unknown token,
    // unpublished record); per-alias failures arrive inside a 200 on their own
    // entries, each naming its reason — an undeclared alias names the alias,
    // which is what tells an author their binding name and their TSX disagree.
    let detail = 'Failed to load data';
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') {
        detail = body.detail;
      }
    } catch {
      // Non-JSON error body; the status alone will have to do.
    }
    return { ok: false, denial: { error: detail, status: response.status } };
  }

  const body = (await response.json()) as {
    results?: Record<string, { rows?: unknown[]; truncated?: boolean; error?: string | null }>;
  };
  const results: Record<string, CanvasAliasResult> = {};
  for (const [alias, result] of Object.entries(body.results ?? {})) {
    results[alias] = {
      rows: result.rows ?? [],
      truncated: Boolean(result.truncated),
      ...(typeof result.error === 'string' && result.error ? { error: result.error } : {}),
    };
  }
  return { ok: true, results };
}

/** One action as the frame is allowed to see it. */
export interface CanvasActionDescriptor {
  name: string;
  label: string;
  icon?: string | null;
  inputSchema?: Record<string, unknown> | null;
  requiresConfirmation: boolean;
  destructive: boolean;
}

/**
 * List a canvas's declared actions.
 *
 * Targets are stripped by Orchestra rather than here, so this cannot leak one by
 * forgetting to.
 */
export async function listCanvasActions(
  token: string
): Promise<{ ok: true; actions: CanvasActionDescriptor[] } | { ok: false; denial: CanvasDenial }> {
  const headers = adminHeaders();
  if (!headers) {
    return { ok: false, denial: { error: 'Server configuration error', status: 500 } };
  }

  const response = await canvasFetch(`${ORCHESTRA_URL}/v0/admin/canvas/${token}/actions`, {
    headers,
    cache: 'no-store',
  });
  if (!response.ok) {
    return { ok: false, denial: { error: 'Failed to load actions', status: response.status } };
  }

  const body = snakeToCamelObject<{ actions?: CanvasActionDescriptor[] }>(await response.json());
  return { ok: true, actions: body.actions ?? [] };
}

/** One invocation, as the caller observes it. */
export interface CanvasInvocation {
  invocationId: number;
  actionName: string;
  status: string;
  result?: Record<string, unknown> | null;
  error?: string | null;
  runKey: string;
  deduplicated: boolean;
}

/**
 * Read one invocation's current state.
 *
 * Orchestra scopes the lookup to the canvas in the path, so an invocation id from
 * one canvas cannot be read through another and this route does not have to
 * re-check the pairing itself.
 */
export async function readCanvasInvocation(
  token: string,
  invocationId: number
): Promise<{ ok: true; invocation: CanvasInvocation } | { ok: false; denial: CanvasDenial }> {
  const headers = adminHeaders();
  if (!headers) {
    return { ok: false, denial: { error: 'Server configuration error', status: 500 } };
  }

  const response = await canvasFetch(
    `${ORCHESTRA_URL}/v0/admin/canvas/${token}/invocations/${invocationId}`,
    { headers, cache: 'no-store' }
  );

  if (!response.ok) {
    return {
      ok: false,
      denial: {
        error: response.status === 404 ? 'Invocation not found' : 'Failed to read invocation',
        status: response.status,
      },
    };
  }

  return {
    ok: true,
    invocation: snakeToCamelObject<CanvasInvocation>(await response.json()),
  };
}

/**
 * Run one of a canvas's declared actions.
 *
 * The action name and the arguments are all that is sent; the target lives on the
 * stored action row and never reaches this process. Orchestra re-validates the
 * arguments against the schema declared at author time, enforces the rate limit,
 * and deduplicates — none of which this route re-implements, because a second
 * copy of a rule is a second thing to drift.
 */
export async function invokeCanvasAction(
  token: string,
  args: {
    actionName: string;
    args: Record<string, unknown>;
    requestedByUserId?: string;
  }
): Promise<{ ok: true; invocation: CanvasInvocation } | { ok: false; denial: CanvasDenial }> {
  const headers = adminHeaders();
  if (!headers) {
    return { ok: false, denial: { error: 'Server configuration error', status: 500 } };
  }

  const response = await canvasFetch(`${ORCHESTRA_URL}/v0/admin/canvas/${token}/action`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // The envelope is converted to Orchestra's wire casing; `args` is spliced in
      // afterwards and never transformed. Its keys are the property names the
      // author declared in `input_schema`, so converting them would rename
      // `dealName` to `deal_name` and fail the very validation they exist for.
      // No run key is sent: Orchestra derives the dedup key itself.
      ...camelToSnakeObject({
        actionName: args.actionName,
        requestedByUserId: args.requestedByUserId,
      }),
      args: args.args,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    // Orchestra's reason, verbatim. "recipients: too long" is what lets the canvas
    // tell the viewer which field to fix; a generic failure sends them to support.
    let detail = 'Action refused';
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') detail = body.detail;
    } catch {
      // Non-JSON error body; the status carries what it can.
    }
    return { ok: false, denial: { error: detail, status: response.status } };
  }

  return {
    ok: true,
    invocation: snakeToCamelObject<CanvasInvocation>(await response.json()),
  };
}
