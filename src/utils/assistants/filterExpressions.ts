/**
 * Filter Expression Utilities for Assistants Pages
 *
 * Pure functions for building and combining filter expressions
 * for the Assistants logging API.
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
