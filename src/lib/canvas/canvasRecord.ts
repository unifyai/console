/**
 * Server-side read of one canvas record.
 *
 * Orchestra deliberately exposes no bundle endpoint. The compiled module lives on
 * the canvas row with its sha256, so the bytes are read here through the ordinary
 * logs API as the canvas *owner*, and the hash is verified before they are handed
 * to the frame. That is a stronger guarantee than subresource integrity, because
 * we enforce it rather than asking the browser to, and it holds however the row
 * was stored.
 *
 * The owner's identity comes from a resolution that `authorizeCanvasRead` already
 * produced, so this module never decides who may read what — by the time it runs,
 * that question is settled.
 *
 * Server-only: reads `ORCHESTRA_ADMIN_KEY` and must never enter a client bundle.
 */

import { createHash } from 'node:crypto';

import { snakeToCamelObject } from '@/utils/casing';

import type { CanvasDenial, CanvasResolution } from '@/lib/canvas/canvasAccess';

const ORCHESTRA_URL = process.env.ORCHESTRA_URL || 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Row fields the surfaces need.
 *
 * Named explicitly rather than excluded, so a field added to the row later is not
 * silently pulled into every page load. `tsx_source` and `build_json` are the two
 * this deliberately leaves behind: the authored source and the build report are
 * both sizeable and neither is needed to render.
 */
const RECORD_FIELDS = [
  'token',
  'title',
  'description',
  'bundle_code',
  'bundle_sha',
  'props_json',
  'bindings_json',
  'kit_version',
  'updated_at',
];

/**
 * Fields for a caption.
 *
 * A preview card needs a title and nothing else, and the bundle is three orders of
 * magnitude larger than the string being displayed. Reading only these keeps a
 * collapsed embed from paying for a canvas it has not rendered.
 */
const SUMMARY_FIELDS = ['token', 'title', 'description', 'updated_at'];

/**
 * The log query joins a field list on `&`, not `,`.
 *
 * A comma-joined `from_fields` matches no field and returns **zero rows** without
 * raising, which reads exactly like a missing canvas. `URLSearchParams` percent-
 * encodes the separator, so the value survives the round trip intact — building
 * the query string by hand does not.
 */
const FIELD_SEPARATOR = '&';

/** One canvas, in the shape a surface hands to `CanvasFrame`. */
export interface CanvasRecord {
  token: string;
  title: string;
  description: string | null;
  /** Compiled ES module, verified against the sha stored beside it. */
  source: string;
  /** Values materialised at author time. */
  props: Record<string, unknown>;
  /** Binding aliases this canvas may request. */
  aliases: string[];
  kitVersion: string;
  updatedAt: string | null;
}

export type FetchCanvasRecordResult =
  | { ok: true; record: CanvasRecord }
  | { ok: false; denial: CanvasDenial };

interface AdminUserResponse {
  apiKey?: string;
  organizations?: Array<{ id: number; apiKey?: string }>;
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The owner's own API key, for reading the owner's own context.
 *
 * The admin key cannot do this read: Orchestra's data endpoints authenticate a
 * *user* key and have no admin bypass, so presenting the admin key to `/logs`
 * returns 401 rather than a widened result. The organization key is preferred
 * when the canvas was written to a team, since that is the identity the bindings
 * were resolved against.
 */
async function ownerApiKey(resolution: CanvasResolution, adminKey: string): Promise<string | null> {
  const response = await fetchWithTimeout(
    `${ORCHESTRA_URL}/v0/admin/user/by-user-id?user_id=${encodeURIComponent(resolution.userId)}`,
    { headers: { Authorization: `Bearer ${adminKey}` } }
  );
  if (!response.ok) return null;

  const user = snakeToCamelObject<AdminUserResponse>(await response.json());
  if (resolution.organizationId !== null && user.organizations) {
    const org = user.organizations.find((entry) => entry.id === resolution.organizationId);
    if (org?.apiKey) return org.apiKey;
  }
  return user.apiKey ?? null;
}

/** Parse a stored JSON column, treating unreadable content as absent. */
function parseJsonColumn(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Aliases the canvas is permitted to request, read from its stored bindings.
 *
 * `CanvasFrame` refuses any alias absent from this list, so it is the allowlist
 * rather than a hint — which is why it comes from the record and never from the
 * frame.
 */
function aliasesFrom(bindingsJson: unknown): string[] {
  const declared = parseJsonColumn(bindingsJson);
  if (!Array.isArray(declared)) return [];
  return declared
    .map((binding) => (binding as { alias?: unknown })?.alias)
    .filter((alias): alias is string => typeof alias === 'string' && alias.length > 0);
}

/** One canvas row, projected to the requested fields. */
type CanvasRow = Record<string, unknown>;

/**
 * Read one canvas row as its owner.
 *
 * `resolution` must come from `authorizeCanvasRead`: this performs no access check
 * of its own.
 */
async function readCanvasRow(
  resolution: CanvasResolution,
  token: string,
  fields: string[]
): Promise<{ ok: true; row: CanvasRow } | { ok: false; denial: CanvasDenial }> {
  const adminKey = process.env.ORCHESTRA_ADMIN_KEY;
  if (!adminKey) {
    return { ok: false, denial: { error: 'Server configuration error', status: 500 } };
  }

  const apiKey = await ownerApiKey(resolution, adminKey);
  if (!apiKey) {
    return { ok: false, denial: { error: 'Could not resolve the canvas owner', status: 500 } };
  }

  const url = new URL(`${ORCHESTRA_URL}/v0/logs`);
  url.searchParams.set('project_name', resolution.projectName);
  url.searchParams.set('context', resolution.contextName);
  url.searchParams.set('filter', `token == '${token}'`);
  url.searchParams.set('from_fields', fields.join(FIELD_SEPARATOR));
  url.searchParams.set('limit', '1');

  const response = await fetchWithTimeout(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    return { ok: false, denial: { error: 'Failed to load canvas', status: response.status } };
  }

  // Entry keys are camelised along with the envelope, so the row reads
  // `bundleCode` here. `propsJson` and `bindingsJson` are still strings at this
  // point, which is what keeps author-declared prop names intact: they are only
  // revealed by `JSON.parse`, after the casing pass has run.
  const body = snakeToCamelObject<{
    logs?: Array<{ entries?: Record<string, unknown>; derivedEntries?: Record<string, unknown> }>;
  }>(await response.json());

  const log = body.logs?.[0];
  if (!log) {
    return { ok: false, denial: { error: 'Canvas not found', status: 404 } };
  }
  return { ok: true, row: { ...log.entries, ...log.derivedEntries } };
}

/** Title and description for chrome that captions a canvas before rendering it. */
export interface CanvasSummary {
  title: string;
  description: string | null;
  updatedAt: string | null;
}

/** Read just enough of a canvas to caption it. */
export async function fetchCanvasSummary(
  resolution: CanvasResolution,
  token: string
): Promise<{ ok: true; summary: CanvasSummary } | { ok: false; denial: CanvasDenial }> {
  const read = await readCanvasRow(resolution, token, SUMMARY_FIELDS);
  if (!read.ok) return read;

  const { row } = read;
  return {
    ok: true,
    summary: {
      title: typeof row.title === 'string' && row.title ? row.title : 'Canvas',
      description: typeof row.description === 'string' ? row.description : null,
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
    },
  };
}

/** Read a canvas row and verify its bundle. */
export async function fetchCanvasRecord(
  resolution: CanvasResolution,
  token: string
): Promise<FetchCanvasRecordResult> {
  const read = await readCanvasRow(resolution, token, RECORD_FIELDS);
  if (!read.ok) return read;

  const { row } = read;

  const source = typeof row.bundleCode === 'string' ? row.bundleCode : '';
  const declaredSha = typeof row.bundleSha === 'string' ? row.bundleSha : '';
  if (!source || !declaredSha) {
    // A published canvas always has both. Missing either means the row was
    // written by something other than the authoring pipeline, and rendering it
    // would skip the integrity check entirely.
    return { ok: false, denial: { error: 'Canvas has no compiled bundle', status: 404 } };
  }

  const actualSha = createHash('sha256').update(source, 'utf8').digest('hex');
  if (actualSha !== declaredSha) {
    // Refusing rather than rendering: a bundle that does not match the hash
    // recorded when it was reviewed is code nobody approved.
    return {
      ok: false,
      denial: { error: 'Canvas bundle failed its integrity check', status: 502 },
    };
  }

  const props = parseJsonColumn(row.propsJson);

  return {
    ok: true,
    record: {
      token,
      title: typeof row.title === 'string' && row.title ? row.title : 'Canvas',
      description: typeof row.description === 'string' ? row.description : null,
      source,
      props: props && typeof props === 'object' ? (props as Record<string, unknown>) : {},
      aliases: aliasesFrom(row.bindingsJson),
      kitVersion: typeof row.kitVersion === 'string' ? row.kitVersion : '',
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
    },
  };
}
