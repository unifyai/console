/**
 * Resolution of the Canvas runtime origin.
 *
 * Canvas renders assistant-authored code, so it is served from an origin
 * separate from console and framed with `sandbox="allow-scripts"`. Two
 * independent isolation layers result: a different origin with its own CSP, and
 * an opaque origin from the sandbox. Neither is useful if the hostname is
 * hardcoded, so it is configuration in every environment:
 *
 * | Environment       | Console                                          | Canvas origin                              |
 * | ----------------- | ------------------------------------------------ | ------------------------------------------ |
 * | production        | `console.unify.ai`                               | `canvas.unify.ai`                          |
 * | staging           | `internal.example.com`| `internal.example.com`    |
 * | self-host / local | `localhost:3000`                                 | `localhost:3100`                           |
 *
 * A port is part of an origin, so `localhost:3100` is genuinely separate from
 * `localhost:3000` — local development gets the same isolation guarantee as
 * production with no hosts file or TLS setup.
 *
 * This module is the single place the origin is read. `next.config.js` reads the
 * same `CANVAS_ORIGIN` variable to add the origin to the global CSP `frame-src`,
 * and the host deployment reads `CANVAS_ALLOWED_CONSOLE_ORIGINS` to build its
 * matching `frame-ancestors`. All three must name the same pair or the frame
 * will not load.
 */

/** Fallback used when `NEXT_PUBLIC_CANVAS_ORIGIN` is unset. */
const LOCAL_CANVAS_ORIGIN = 'http://localhost:3100';

/**
 * Origin serving the Canvas runtime host.
 *
 * Returns the configured origin with any trailing slash removed, so callers can
 * concatenate paths without producing a double slash.
 */
export function getCanvasOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_CANVAS_ORIGIN?.trim();
  return (configured && configured.length > 0 ? configured : LOCAL_CANVAS_ORIGIN).replace(
    /\/+$/,
    ''
  );
}

/**
 * URL of the versioned host document.
 *
 * The version is part of the path rather than a query parameter so a kit
 * upgrade can publish `host/v2` alongside `host/v1`, leaving existing canvases
 * rendering against the runtime they were built and reviewed against.
 */
export function getCanvasHostUrl(version = 'v1'): string {
  return `${getCanvasOrigin()}/host/${version}/index.html`;
}
