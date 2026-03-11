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
    if (toolCalls.length > 0) return 'tool_call';
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
  return NOISE_KINDS.has(resolveToolLoopKind(entries));
}
