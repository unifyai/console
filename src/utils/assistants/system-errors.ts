/**
 * System Error Classification
 *
 * Maps raw error messages from Unity's `publish_system_error()` to structured
 * error types with user-friendly copy. Falls back gracefully for unrecognized
 * messages so new Unity error strings don't require a console update.
 *
 * Unity publishes system errors as:
 *   { thread: "system_error", event: { content: "<error message>" } }
 *
 * The content is a free-form string. Classification uses substring matching
 * with a generic fallback for unrecognized messages.
 */

export type SystemErrorType =
  | 'message_failed'
  | 'recovering'
  | 'startup_failed'
  | 'init_failed'
  | 'oom'
  | 'unknown';

export interface SystemError {
  type: SystemErrorType;
  /** Raw error message from Unity */
  rawMessage: string;
  timestamp: Date;
}

interface ErrorPattern {
  type: SystemErrorType;
  /** Substring to match against the raw content (case-insensitive). */
  match: string;
}

const PATTERNS: readonly ErrorPattern[] = [
  { type: 'oom', match: 'ran out of memory' },
  { type: 'startup_failed', match: 'failed to start up' },
  { type: 'init_failed', match: 'failed to initialize' },
  { type: 'message_failed', match: 'error occurred while processing a message' },
  { type: 'recovering', match: 'attempting to recover' },
];

/**
 * Classify a raw error message string into a structured SystemErrorType.
 * Returns 'unknown' if no pattern matches.
 */
export function classifySystemError(content: string): SystemErrorType {
  const lower = content.toLowerCase();
  for (const { type, match } of PATTERNS) {
    if (lower.includes(match)) return type;
  }
  return 'unknown';
}

/**
 * User-friendly error copy keyed by error type.
 * The `{name}` placeholder is replaced with the assistant's display name.
 */
/* eslint-disable @typescript-eslint/naming-convention -- keys match Unity's wire format */
const FRIENDLY_COPY: Record<SystemErrorType, { title: string; detail: string }> = {
  message_failed: {
    title: '{name} may not have received your last message',
    detail: 'Try sending it again.',
  },
  recovering: {
    title: '{name} encountered an issue and is recovering',
    detail: 'This usually resolves on its own in a few moments.',
  },
  startup_failed: {
    title: '{name} is having trouble starting up',
    detail: 'This usually resolves in a few moments.',
  },
  init_failed: {
    title: "{name} didn't start correctly",
    detail: 'Try refreshing in a moment.',
  },
  oom: {
    title: '{name} needs to restart',
    detail: 'Your conversation is saved. This usually resolves in under a minute.',
  },
  unknown: {
    title: '{name} encountered an issue',
    detail: "If it doesn't respond, try refreshing.",
  },
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Get user-friendly error copy for a given error type and assistant name.
 */
export function getFriendlyErrorCopy(
  errorType: SystemErrorType,
  assistantName: string
): { title: string; detail: string } {
  const template = FRIENDLY_COPY[errorType];
  return {
    title: template.title.replace('{name}', assistantName),
    detail: template.detail,
  };
}

/**
 * Debounce window: ignore duplicate error types within this window (ms).
 */
export const DEDUP_WINDOW_MS = 15_000;

/** Valid error_type values from Unity's structured field. */
const VALID_ERROR_TYPES = new Set<SystemErrorType>([
  'message_failed',
  'recovering',
  'startup_failed',
  'init_failed',
  'oom',
  'unknown',
]);

/**
 * Parse a raw Pub/Sub system error payload into a SystemError.
 *
 * Prefers the structured `error_type` field from Unity when available.
 * Falls back to substring-based classification for payloads from older
 * Unity deployments that don't include `error_type`.
 *
 * Returns null if the payload shape is unexpected.
 */
export function parseSystemErrorPayload(payload: Record<string, unknown>): SystemError | null {
  if (payload.thread !== 'system_error') return null;

  const event = payload.event as Record<string, unknown> | undefined;
  const content = (event?.content as string) ?? (payload.content as string) ?? '';
  if (!content) return null;

  const structuredType = event?.error_type as string | undefined;
  const type =
    structuredType && VALID_ERROR_TYPES.has(structuredType as SystemErrorType)
      ? (structuredType as SystemErrorType)
      : classifySystemError(content);

  return {
    type,
    rawMessage: content,
    timestamp: new Date(),
  };
}
