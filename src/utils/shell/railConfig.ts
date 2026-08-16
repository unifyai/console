import type { RailConfig } from '@/types/shell/rail';

/**
 * Where the rail config lives.
 *
 * A cookie rather than `localStorage` because the first paint depends on it:
 * the rail server-renders, and a store the server cannot read forces it to
 * emit the default rail and correct itself after mount — one frame of the full
 * section list for anyone who has unpinned anything.
 */
export const RAIL_CONFIG_COOKIE = 'console_rail_config';

/** A year. The rail is a standing preference, not session state. */
export const RAIL_CONFIG_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Everything pinned, default order — so an upgrade changes nobody's rail. */
export const DEFAULT_RAIL_CONFIG: RailConfig = { v: 1, unpinned: [], order: {} };

/**
 * Stored config, or the default when there is nothing usable to read. A config
 * written by a different version is discarded rather than migrated: the shape
 * is small enough that re-pinning costs less than a migration path nobody
 * exercises.
 *
 * The value is percent-encoded on write because JSON's separators are not
 * cookie-safe. Reads accept it either way: `document.cookie` hands back what
 * was written, while Next's request cookies have already decoded it, and a
 * config that survives one path but not the other would be a rail that reads
 * correctly on the server and blank in the browser.
 */
export function parseRailConfig(raw: string | undefined | null): RailConfig {
  if (!raw) return DEFAULT_RAIL_CONFIG;
  // Hand-edited or half-written storage is an expected, recoverable input here.
  try {
    const parsed = JSON.parse(raw.startsWith('{') ? raw : decodeURIComponent(raw)) as
      | Partial<RailConfig>
      | undefined;
    if (parsed?.v !== 1) return DEFAULT_RAIL_CONFIG;
    return {
      v: 1,
      unpinned: Array.isArray(parsed.unpinned) ? parsed.unpinned : [],
      order: parsed.order ?? {},
    };
  } catch {
    return DEFAULT_RAIL_CONFIG;
  }
}

export function serializeRailConfig(config: RailConfig): string {
  return encodeURIComponent(JSON.stringify(config));
}
