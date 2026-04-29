/**
 * Preview-environment host helpers.
 *
 * Slug-tagged Cloud Run revisions of the staging console run on hostnames
 * of the form ``<slug>---<base-host>``, where ``<slug>`` is a 1–30 char
 * lowercase Cloud Run tag and ``<base-host>`` is the canonical bare
 * Cloud Run host of the staging service.
 *
 * The login page uses {@link isPreviewHost} to hide the Google/Microsoft
 * OAuth buttons on slug hosts, since their redirect URIs are not (and
 * cannot reasonably be) registered for the dynamically-generated slug
 * hostnames. Sign-in on a preview slug always goes through the standard
 * email + password flow that Orchestra serves on canonical staging.
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
