/**
 * Filter Expression Builders for Assistants Pages
 *
 * Pure functions for building security filter expressions for the Assistants logging API.
 * These are used to filter by _user_id and _assistant_id to prevent data leaks.
 */

/**
 * Escape a string value for use in filter expressions.
 * @param value String value to escape
 * @returns Escaped string safe for filter expressions
 */
export function escapeFilterValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/'/g, "\\'"); // Escape single quotes
}

/**
 * Build a filter expression for a specific user ID.
 * Uses the _user_id field injected by Unity's log_utils.
 *
 * @param userId User ID to filter by
 * @returns Filter expression string
 */
export function buildUserIdFilter(userId: string): string {
  const escaped = escapeFilterValue(userId);
  return `_user_id == '${escaped}'`;
}

/**
 * Build a filter expression for a specific assistant ID.
 * Uses the _assistant_id field injected by Unity's log_utils.
 *
 * @param assistantId Assistant ID (agent_id) to filter by
 * @returns Filter expression string
 */
export function buildAssistantIdFilter(assistantId: string): string {
  const escaped = escapeFilterValue(assistantId);
  return `_assistant_id == '${escaped}'`;
}

/**
 * Combine multiple filter expressions with AND.
 * Filters out empty strings and null values.
 *
 * @param expressions Array of filter expressions
 * @returns Combined filter expression or empty string if no valid expressions
 */
export function combineFilters(expressions: (string | null | undefined)[]): string {
  const validExpressions = expressions.filter(
    (expr): expr is string => typeof expr === 'string' && expr.trim().length > 0
  );

  if (validExpressions.length === 0) {
    return '';
  }

  if (validExpressions.length === 1) {
    return validExpressions[0];
  }

  return validExpressions.map((expr) => `(${expr})`).join(' and ');
}
