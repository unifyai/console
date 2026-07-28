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
 * The dashboard tile bridge routes check only that an admin key is configured on
 * the server, with no session check at all — so the admin key does the reading
 * and nobody establishes who asked. Doing that here would make the whole
 * visibility model decorative.
 *
 * Server-only: this module reads `ORCHESTRA_ADMIN_KEY` and must never be imported
 * into a client bundle.
 */

import type { NextRequest } from 'next/server';

import { getApiKeyFromRequest } from '@/app/api/_utils/auth';
import { getCurrentUser } from '@/lib/user/user';
import { snakeToCamelObject } from '@/utils/casing';

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

  const response = await fetch(`${ORCHESTRA_URL}/v0/admin/canvas/tokens/${token}`, {
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
export async function queryCanvasAlias(
  token: string,
  alias: string
): Promise<
  { ok: true; rows: unknown[]; truncated: boolean } | { ok: false; denial: CanvasDenial }
> {
  const headers = adminHeaders();
  if (!headers) {
    return { ok: false, denial: { error: 'Server configuration error', status: 500 } };
  }

  const response = await fetch(`${ORCHESTRA_URL}/v0/admin/canvas/${token}/query`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ alias }),
    cache: 'no-store',
  });

  if (!response.ok) {
    // Orchestra's own reason is more useful than a generic one: an undeclared
    // alias is a 404 naming the alias, which is what tells an author their
    // binding name and their TSX disagree.
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

  const body = (await response.json()) as { rows?: unknown[]; truncated?: boolean };
  return { ok: true, rows: body.rows ?? [], truncated: Boolean(body.truncated) };
}
