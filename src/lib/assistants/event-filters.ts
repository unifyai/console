/**
 * Event Filtering — single source of truth for hiding irrelevant events
 * from the Actions panel.
 *
 * Two layers, applied in order:
 *
 * 1. **Manager exclusion** — entire event trees rooted in certain managers
 *    (e.g. MemoryManager) are dropped at the Orchestra query level and
 *    the SSE delivery layer.
 *
 * 2. **ToolLoop noise** — events whose `kind` (from ToolLoopKind on the
 *    backend) is in the noise set. A legacy fallback infers kind from the
 *    raw message for historic data that predates the `kind` field.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// =============================================================================
// Manager exclusion
// =============================================================================

export const EXCLUDED_MANAGERS: readonly string[] = ['MemoryManager'];

const excludedSet = new Set<string>(EXCLUDED_MANAGERS);

export function isManagerExcluded(managerName: string | null | undefined): boolean {
  return !!managerName && excludedSet.has(managerName);
}

export function buildExcludedManagerFilters(): string[] {
  const filters: string[] = [];
  for (const m of EXCLUDED_MANAGERS) {
    filters.push(`manager != "${m}"`);
    filters.push(`not hierarchy_label.startswith('${m}.')`);
  }
  return filters;
}

// =============================================================================
// ToolLoop kind resolution
// =============================================================================

/**
 * Resolves the canonical `kind` for a ToolLoop log entry.
 *
 * Returns `entries.kind` when the backend has tagged it. For historic data
 * without `kind`, infers it from the raw message — mirroring the backend
 * `classify_tool_loop_message` logic.
 */
export function resolveToolLoopKind(entries: Record<string, any>): string {
  if (entries.kind) return entries.kind;

  const msg = entries.message;
  if (!msg || typeof msg !== 'object') return 'response';
  const raw = msg as Record<string, any>;
  const role: string = raw.role ?? '';

  if (role === 'system') {
    if (raw._steering || raw._steeringAction || raw._steering_action) {
      const action = String(raw._steeringAction || raw._steering_action || 'pause').toLowerCase();
      return `steering_${action}`;
    }
    if (raw._visibilityGuidance || raw._visibility_guidance) return 'visibility_guidance';
    if (raw._timeExplanation || raw._time_explanation) return 'time_explanation';
    if (raw._runtimeContext || raw._runtime_context) return 'runtime_context';
    return 'system_notice';
  }

  if (role === 'user') {
    if (raw._interjection || raw._Interjection) return 'interjection';
    if (raw._ctxHeader || raw._ctx_header) return 'context_continuation';
    return 'request';
  }

  if (role === 'tool') {
    const name: string = raw.name ?? '';
    if (typeof name === 'string' && name.startsWith('check_status_')) return 'status_check';
    if (name === 'wait') return 'wait_noop';
    if (name === 'send_notification') return 'notification_ack';
    if (typeof raw.content === 'string') {
      try {
        const parsed = JSON.parse(raw.content);
        if (typeof parsed === 'object' && parsed !== null && '_placeholder' in parsed)
          return 'placeholder';
      } catch {
        /* not JSON */
      }
    }
    return 'tool_result';
  }

  if (role === 'assistant') {
    if (raw._thinkingInFlight || raw._thinking_in_flight) return 'thinking_sentinel';
    const psf = (raw.providerSpecificFields || raw.provider_specific_fields) as
      | Record<string, unknown>
      | undefined;
    if (
      raw.thinkingBlocks ||
      raw.thinking_blocks ||
      raw.reasoningContent ||
      raw.reasoning_content ||
      psf?.thinkingBlocks ||
      psf?.thinking_blocks
    )
      return 'thought';
    const toolCalls: any[] = raw.toolCalls ?? raw.tool_calls ?? [];
    if (toolCalls.length > 0) {
      if (
        toolCalls.every((tc: any) =>
          (tc?.function?.name ?? tc?.name ?? '').startsWith('check_status_')
        )
      )
        return 'status_check';
      return 'tool_call';
    }
    return 'response';
  }

  return 'response';
}

// =============================================================================
// ToolLoop noise (kind-based)
// =============================================================================

/**
 * Kinds that are internal bookkeeping and should be hidden from the UI.
 *
 * `status_check` is included for display filtering (hidden from the
 * timeline) but the events still reach the frontend so
 * `resolvedToolCallIds` can resolve pending tool calls.
 */
const NOISE_KINDS = new Set([
  'placeholder',
  'runtime_context',
  'time_explanation',
  'visibility_guidance',
  'context_continuation',
  'status_check',
  'wait_noop',
  'notification_ack',
  'system_notice',
  'early_exit',
]);

/**
 * Returns true if a ToolLoop log entry is internal noise that should be
 * hidden from the UI.
 *
 * Accepts the full `entries` object (which carries `kind`) rather than
 * just the raw message. For historic data without `kind`, the kind is
 * inferred from the message via `resolveToolLoopKind`.
 */
export function isToolLoopNoise(entries: Record<string, any>): boolean {
  if (NOISE_KINDS.has(resolveToolLoopKind(entries))) return true;
  const msg = entries.message;
  if (msg?.role === 'tool' && msg?.name === 'send_notification') return true;
  return false;
}

// =============================================================================
// Steering target extraction
// =============================================================================

const STEERING_PREFIXES = ['stop_', 'pause_', 'resume_', 'interject_'];
const STEERING_ACTIONS = new Set([
  'stop',
  'pause',
  'resume',
  'interject',
  'clarify',
  'call',
  'ask',
]);
const STEER_TOOL_NAME = 'steer';

/** Shape needed to recognize a steering call: the minted name, or `steer`'s raw JSON arguments. */
export interface SteeringToolCallLike {
  name: string;
  arguments?: string;
}

/**
 * Given a steering tool call, returns the id of the tool call it targets.
 *
 * Two shapes:
 * - Legacy per-call minted helpers (`stop_execute_code_cPPmyQGz`) — returns
 *   the trailing segment (`cPPmyQGz`), which is a *suffix* of the target's
 *   full tool-call id.
 * - The `steer` dispatcher — returns `arguments.call_id` verbatim, which is
 *   the target's *full* tool-call id. Callers that match targets via
 *   `id.endsWith(returned)` (as `getSteeringForToolCall` does) handle both
 *   shapes uniformly: a full id matched with `endsWith` only succeeds on an
 *   exact match, which is exactly what a full id needs.
 *
 * Returns `null` for non-steering tool names or malformed `steer` arguments.
 */
export function extractSteeringTarget(toolCall: SteeringToolCallLike): string | null {
  const name = toolCall?.name;
  if (typeof name !== 'string' || !name) return null;
  const lower = name.toLowerCase();

  if (lower === STEER_TOOL_NAME) {
    if (typeof toolCall.arguments !== 'string') return null;
    try {
      const parsed = JSON.parse(toolCall.arguments);
      const callId = parsed?.call_id;
      return typeof callId === 'string' && callId.length > 0 ? callId : null;
    } catch {
      return null;
    }
  }

  if (!STEERING_PREFIXES.some((p) => lower.startsWith(p))) return null;
  const parts = name.split('_');
  return parts.length >= 3 ? parts[parts.length - 1] : null;
}

/**
 * Given a steering tool call, returns the steering action it performs
 * (`stop`, `pause`, `resume`, `interject`, `clarify`, `call`, `ask`) — used
 * to pick an icon/label for the rendered sub-row. Returns `null` for
 * non-steering tool names or malformed `steer` arguments.
 */
export function extractSteeringAction(toolCall: SteeringToolCallLike): string | null {
  const name = toolCall?.name;
  if (typeof name !== 'string' || !name) return null;
  const lower = name.toLowerCase();

  if (lower === STEER_TOOL_NAME) {
    if (typeof toolCall.arguments !== 'string') return null;
    try {
      const parsed = JSON.parse(toolCall.arguments);
      const action = typeof parsed?.action === 'string' ? parsed.action.toLowerCase() : null;
      return action && STEERING_ACTIONS.has(action) ? action : null;
    } catch {
      return null;
    }
  }

  const prefix = STEERING_PREFIXES.find((p) => lower.startsWith(p));
  return prefix ? prefix.slice(0, -1) : null;
}

// =============================================================================
// Runtime lifecycle announcements
// =============================================================================

const LIFECYCLE_TAGS = ['steerable', 'askable', 'progress', 'clarification'] as const;
export type LifecycleTag = (typeof LIFECYCLE_TAGS)[number];

const LIFECYCLE_ANNOUNCEMENT_RE = new RegExp(
  `^\\[(${LIFECYCLE_TAGS.join('|')})\\s+([^\\]]+)\\]\\s*`
);

export interface LifecycleAnnouncement {
  tag: LifecycleTag;
  callId: string;
  /** Any text following the `[tag id]` marker, e.g. a clarification question. */
  detail: string | null;
}

/**
 * Recognizes the runtime's `[steerable <id>]` / `[askable <id>]` /
 * `[progress <id>]` / `[clarification <id>]` lifecycle markers, which arrive
 * as user-role transcript messages but are status announcements, not user
 * speech. Prefix-sniffing mirrors the runtime's own convention for these.
 * Returns `null` for anything else.
 */
export function extractLifecycleAnnouncement(
  content: string | null | undefined
): LifecycleAnnouncement | null {
  if (typeof content !== 'string') return null;
  const match = LIFECYCLE_ANNOUNCEMENT_RE.exec(content.trimStart());
  if (!match) return null;
  const detail = content.trimStart().slice(match[0].length).trim();
  return { tag: match[1] as LifecycleTag, callId: match[2], detail: detail || null };
}
