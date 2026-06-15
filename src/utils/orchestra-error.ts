/**
 * Helpers for turning Orchestra/FastAPI error bodies into readable strings.
 *
 * FastAPI returns errors in two shapes:
 *   - Manually raised HTTPException: { detail: "some message" }       (string)
 *   - Pydantic 422 validation error: { detail: [ { loc, msg, ... } ] } (array)
 *
 * The array shape renders as "[object Object]" if passed straight to a toast,
 * so this normalizes it into a single human-readable message.
 */

type ValidationErrorItem = {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
};

const VALUE_ERROR_PREFIX = 'Value error, ';

function cleanMessage(msg: string): string {
  // Pydantic prefixes custom validator messages with "Value error, ".
  return msg.startsWith(VALUE_ERROR_PREFIX) ? msg.slice(VALUE_ERROR_PREFIX.length) : msg;
}

function fieldFromLoc(loc?: Array<string | number>): string | undefined {
  if (!Array.isArray(loc)) return undefined;
  // Skip the leading source segment ("body" / "query" / "path") and numeric indices.
  const parts = loc.filter(
    (segment) =>
      typeof segment === 'string' && !['body', 'query', 'path', 'header'].includes(segment)
  ) as string[];
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

/**
 * Convert a FastAPI `detail` value into a single readable string.
 *
 * @param detail - the `detail` field from an error body (string | array | object | undefined)
 * @returns a readable string, or undefined when no message could be derived
 */
export function formatValidationDetail(detail: unknown): string | undefined {
  if (detail == null) return undefined;

  if (typeof detail === 'string') {
    return detail || undefined;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const entry = item as ValidationErrorItem;
          const msg = typeof entry.msg === 'string' ? cleanMessage(entry.msg) : undefined;
          if (!msg) return undefined;
          const field = fieldFromLoc(entry.loc);
          return field ? `${field}: ${msg}` : msg;
        }
        return undefined;
      })
      .filter((m): m is string => Boolean(m));

    return messages.length > 0 ? messages.join('; ') : undefined;
  }

  if (typeof detail === 'object') {
    const obj = detail as Record<string, unknown>;
    if (typeof obj.msg === 'string') return cleanMessage(obj.msg);
    if (typeof obj.detail !== 'undefined') return formatValidationDetail(obj.detail);
  }

  return undefined;
}

/**
 * Normalize an error body in-place so that `body.detail` is always a string.
 * Returns the same object reference for convenience.
 */
export function normalizeErrorDetail<T extends Record<string, unknown>>(body: T): T {
  if (body && typeof body === 'object' && 'detail' in body) {
    const formatted = formatValidationDetail(body.detail);
    if (formatted !== undefined) {
      (body as Record<string, unknown>).detail = formatted;
    }
  }
  return body;
}
