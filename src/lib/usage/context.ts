/**
 * Context Path Utilities for Usage Page
 *
 * Simplified context paths for usage analytics.
 *
 * The usage page now uses a single context path (All/Events/LLM) and
 * filters by _user_id and _assistant_id in the filter expression.
 * This avoids issues with name collisions.
 */

/** Base context for all LLM events */
export const LLM_EVENTS_CONTEXT = 'All/Events/LLM';

/**
 * Get the standard LLM events context path.
 *
 * The usage page uses this single context for all queries,
 * with filtering done via filter expressions using _user_id and _assistant_id.
 *
 * @returns Context path string "All/Events/LLM"
 */
export function getLLMEventsContext(): string {
  return LLM_EVENTS_CONTEXT;
}

/**
 * Validate that a context path is well-formed.
 *
 * @param contextPath Context path to validate
 * @returns True if valid
 */
export function isValidContextPath(contextPath: string): boolean {
  if (!contextPath || contextPath.trim().length === 0) {
    return false;
  }

  // Must contain the LLM events suffix
  if (!contextPath.endsWith('Events/LLM')) {
    return false;
  }

  // Must not have empty segments
  const segments = contextPath.split('/');
  if (segments.some((s) => s.trim().length === 0)) {
    return false;
  }

  return true;
}
