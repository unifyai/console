/**
 * Preview-environment host helpers.
 *
 * Slug-tagged Cloud Run revisions of the staging console run on hostnames
 * of the form ``<slug>---<base-host>``, where ``<slug>`` is a 1–30 char
 * lowercase Cloud Run tag and ``<base-host>`` is the canonical bare
 * Cloud Run host of the staging service.
 *
 * Preview-only routes use {@link isPreviewHost} as a structural gate to
 * make sure they never activate on the canonical custom domain or in
 * production — a regression here would expose the preview-signin
 * shortcut to non-preview traffic.
 */

const PREVIEW_BASE_HOST = 'service.a.run.app';

const PREVIEW_HOST_PATTERN = new RegExp(
  `^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?---${PREVIEW_BASE_HOST.replace(/\./g, '\\.')}$`
);

/**
 * Returns ``true`` when ``host`` is a slug-tagged preview revision of
 * the staging console (``<slug>---<base-host>``), and ``false`` for the
 * bare staging host, the canonical custom domain, production, or any
 * malformed input.
 */
export function isPreviewHost(host: string | null | undefined): boolean {
  if (!host) return false;
  return PREVIEW_HOST_PATTERN.test(host.toLowerCase());
}
