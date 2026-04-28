/**
 * Host-detection helpers for the preview-environment OAuth bounce.
 *
 * Cloud Run "tagged revisions" expose feature-branch deploys at URLs of the
 * form ``<slug>---<service>-<hash>-<region>.a.run.app``. The console runs at
 * a single canonical Cloud Run service whose hash and region are pinned in
 * {@link PREVIEW_BASE_HOST}; every preview branch lives at a tag of that
 * same service.
 *
 * Importing this module is safe from both the browser and the server — it
 * has no secret material and no Node-only dependencies. The matching crypto
 * helpers live in ``./preview-tokens`` and are server-only.
 *
 * Single source of truth for {@link PREVIEW_BASE_HOST} matches the value
 * pinned in ``cloudbuild_preview.yaml`` (substitution ``_PEER_CONSOLE_HOST``).
 */

/** Canonical Cloud Run host of the staging console service. */
export const PREVIEW_BASE_HOST = 'service.a.run.app';

/**
 * Cloud Run tag-name constraints (a-z, 0-9, hyphen; 1–63 chars; no leading or
 * trailing hyphen). The preview pipeline truncates at 30 chars so the
 * generated host stays well under the 63-byte DNS label limit.
 */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

const PREVIEW_HOST_PATTERN = new RegExp(
  `^([a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?)---${PREVIEW_BASE_HOST.replace(/\./g, '\\.')}$`
);

/** True if ``host`` is a slug-tagged revision of the canonical console service. */
export function isPreviewHost(host: string): boolean {
  return PREVIEW_HOST_PATTERN.test(host);
}

/** Extract the slug from a preview host, or null if the host is not a preview. */
export function previewSlugFromHost(host: string): string | null {
  const match = PREVIEW_HOST_PATTERN.exec(host);
  return match ? match[1] : null;
}

/**
 * Validate and normalize a ``return_to`` origin claimed by the slug-side
 * "Sign in" button. Returns the normalized origin string on success or null
 * if the value is not a valid preview origin of this service.
 *
 * The bounce flow uses this both pre-auth (handoff route, validating what
 * the verify host claims) and post-auth (claim route, validating the
 * receiving host matches the transfer-token audience).
 */
export function validatePreviewOrigin(rawOrigin: string | null | undefined): string | null {
  if (!rawOrigin) return null;
  let url: URL;
  try {
    url = new URL(rawOrigin);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!isPreviewHost(url.host)) return null;
  return `https://${url.host}`;
}

/**
 * URL of the canonical-side handoff route for the OAuth bounce.
 *
 * Any canonical hostname serves the same Cloud Run revision, so we always
 * use the bare Cloud Run host: it is structurally derivable from the
 * preview host without runtime configuration, and NextAuth itself rewrites
 * the OAuth callback to whatever ``NEXTAUTH_URL`` is set to (i.e. the
 * registered Google redirect URI), so the user ends up on the custom
 * domain mid-flow regardless of where the bounce started.
 */
export const PREVIEW_HANDOFF_URL = `https://${PREVIEW_BASE_HOST}/api/auth/preview-handoff`;

/** Cloud Run tag pattern check — used by tests; also handy at the call site. */
export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Compute the externally-visible request origin from forwarded headers.
 *
 * On Cloud Run, the container listens on ``0.0.0.0:3000`` and the
 * Google frontend forwards ``Host``/``X-Forwarded-*`` headers carrying
 * the real external URL. ``request.url`` and ``NextRequest.nextUrl``
 * may reflect the listener address instead of the forwarded host
 * depending on how the standalone Next.js server was built, so route
 * handlers that build redirect URLs must read forwarded headers
 * explicitly to avoid producing ``https://0.0.0.0:3000/...`` redirects
 * the browser will reject.
 */
export function forwardedOrigin(headers: Headers, fallback: string): string {
  const proto = headers.get('x-forwarded-proto') ?? 'https';
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (!host) return fallback;
  return `${proto}://${host}`;
}
