/**
 * Helpers for parsing Orchestra `context` query params into the table path the
 * store is keyed by, plus a few filter-expression probes the UX depends on.
 */

/**
 * Strips the assistant/team prefix from a full context path, returning the table
 * path the store is keyed by.
 *
 *   `mock-user-0001/1001/Knowledge` → `Knowledge`
 *   `Teams/4242/Contacts`                    → `Contacts`
 */
export function tablePathFromContext(context: string | null): string | null {
  if (!context) return null;
  const segments = context.split('/').filter(Boolean);
  if (segments.length <= 2) return segments[segments.length - 1] ?? null;
  return segments.slice(2).join('/');
}

const SNAKE_RE = /_([a-z0-9])/g;

export function snakeToCamel(value: string): string {
  return value.replace(SNAKE_RE, (_, ch: string) => ch.toUpperCase());
}

/** Extracts the first quoted string literal from a filter expression. */
export function firstQuotedLiteral(filter: string): string | null {
  const match = filter.match(/"([^"]*)"|'([^']*)'/);
  if (!match) return null;
  return match[1] ?? match[2] ?? null;
}

export interface ParsedSorting {
  field: string;
  direction: 'ascending' | 'descending';
}

export function parseSorting(sorting: string | null): ParsedSorting | null {
  if (!sorting) return null;
  try {
    const parsed = JSON.parse(sorting) as Record<string, 'ascending' | 'descending'>;
    const [entry] = Object.entries(parsed);
    if (!entry) return null;
    return { field: snakeToCamel(entry[0]), direction: entry[1] };
  } catch {
    return null;
  }
}
