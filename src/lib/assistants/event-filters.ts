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
 * 2. **ToolLoop noise** — per-message predicates that mirror the backend's
 *    stream_filters.py rules. Applied client-side to historic polls
 *    (Orchestra returns unfiltered data) and as defense-in-depth on SSE.
 *
 * To hide a new manager, add its name to EXCLUDED_MANAGERS.
 * To add a new noise rule, add a predicate and wire it into isToolLoopNoise.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// =============================================================================
// Manager exclusion
// =============================================================================

/**
 * Manager names to exclude from every surface in the Actions panel.
 *
 * Currently excludes MemoryManager because its payloads carry entire
 * conversation transcripts, which choke Orchestra bandwidth.
 */
export const EXCLUDED_MANAGERS: readonly string[] = ['MemoryManager'];

const excludedSet = new Set<string>(EXCLUDED_MANAGERS);

/**
 * Returns true if a manager should be hidden from the Actions panel.
 * O(1) lookup via Set — safe for hot paths like the SSE pull loop.
 */
export function isManagerExcluded(managerName: string | null | undefined): boolean {
  return !!managerName && excludedSet.has(managerName);
}

/**
 * Builds Orchestra filter clauses that exclude every manager in the list.
 *
 * Returns an array of strings like `manager != "MemoryManager"` plus
 * `not hierarchy_label.startswith('MemoryManager.')` to also exclude
 * nested sub-manager events called from within an excluded manager
 * (e.g. ContactManager.ask invoked by MemoryManager.process_chunk).
 */
export function buildExcludedManagerFilters(): string[] {
  const filters: string[] = [];
  for (const m of EXCLUDED_MANAGERS) {
    filters.push(`manager != "${m}"`);
    filters.push(`not hierarchy_label.startswith('${m}.')`);
  }
  return filters;
}

// =============================================================================
// ToolLoop noise (mirrors unity/events/stream_filters.py)
// =============================================================================

function isSyntheticStatusCheck(msg: Record<string, any>): boolean {
  const toolCalls: any[] = msg.toolCalls ?? [];
  for (const tc of toolCalls) {
    const name: string = tc?.function?.name ?? '';
    if (name.startsWith('check_status_')) return true;
  }
  if (msg.role === 'tool') {
    const name: string = msg.name ?? '';
    if (name.startsWith('check_status_')) return true;
  }
  return false;
}

function isPlaceholderMessage(msg: Record<string, any>): boolean {
  if (msg.role !== 'tool') return false;
  if (typeof msg.content !== 'string') return false;
  try {
    const parsed = JSON.parse(msg.content);
    return typeof parsed === 'object' && parsed !== null && '_placeholder' in parsed;
  } catch {
    return false;
  }
}

function isRuntimeContextHeader(msg: Record<string, any>): boolean {
  return msg._runtimeContext === true || msg._runtime_context === true;
}

function isVisibilityGuidance(msg: Record<string, any>): boolean {
  return msg._visibilityGuidance === true || msg._visibility_guidance === true;
}

function isWaitNoOp(msg: Record<string, any>): boolean {
  const toolCalls: any[] = msg.toolCalls ?? msg.tool_calls ?? [];
  if (msg.role === 'assistant' && toolCalls.length > 0) {
    if (toolCalls.every((tc: any) => (tc?.function?.name ?? tc?.name) === 'wait')) return true;
  }
  if (msg.role === 'tool' && (msg.name === 'wait' || msg.toolName === 'wait')) return true;
  return false;
}

/**
 * Returns true if a ToolLoop message is internal noise that should be
 * hidden from the UI. Mirrors unity/events/stream_filters._STREAM_NOISE_RULES.
 *
 * Note: isSyntheticStatusCheck is kept here even though the backend no longer
 * filters it from Pub/Sub — check_status events must reach the frontend so
 * resolvedToolCallIds can extract original tool_call_ids, but they should
 * still be hidden from the timeline display.
 *
 * Both snake_case and camelCase variants are checked for flag fields because
 * the data passes through snakeToCamelObject on some paths but not all.
 */
export function isToolLoopNoise(msg: Record<string, any>): boolean {
  return (
    isSyntheticStatusCheck(msg) ||
    isPlaceholderMessage(msg) ||
    isRuntimeContextHeader(msg) ||
    isVisibilityGuidance(msg) ||
    isWaitNoOp(msg)
  );
}
