/**
 * Filter Expression Builders for Usage Page
 *
 * Pure functions for building filter expressions for the Orchestra API.
 */

/**
 * Build a filter expression for a date range.
 * Uses event_timestamp field for filtering.
 *
 * @param startDate Start date in ISO format (YYYY-MM-DD)
 * @param endDate End date in ISO format (YYYY-MM-DD)
 * @returns Filter expression string
 */
export function buildDateRangeFilter(startDate: string, endDate: string): string {
  // Add one day to end date to include the entire end date
  // The API uses < for the end comparison
  const endDatePlusOne = addOneDay(endDate);

  return `event_timestamp >= '${startDate}' and event_timestamp < '${endDatePlusOne}'`;
}

/**
 * Add one day to an ISO date string.
 * @param isoDate ISO date string (YYYY-MM-DD)
 * @returns ISO date string of the next day
 */
function addOneDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);

  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');

  return `${newYear}-${newMonth}-${newDay}`;
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

/**
 * Build a filter expression for a specific model.
 * @param model Model name to filter by
 * @returns Filter expression string
 */
export function buildModelFilter(model: string): string {
  // Escape single quotes in model name
  const escapedModel = model.replace(/'/g, "\\'");
  return `model == '${escapedModel}'`;
}

/**
 * Build a filter expression for a specific provider.
 * @param provider Provider name to filter by
 * @returns Filter expression string
 */
export function buildProviderFilter(provider: string): string {
  // Escape single quotes in provider name
  const escapedProvider = provider.replace(/'/g, "\\'");
  return `provider == '${escapedProvider}'`;
}

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
 * Build a complete filter expression from usage filter state.
 * This is the main function used by the usage page.
 *
 * @param startDate Start date in ISO format
 * @param endDate End date in ISO format
 * @param userId Optional user ID to filter by (uses _user_id field)
 * @param assistantId Optional assistant ID to filter by (uses _assistant_id field)
 * @returns Complete filter expression string
 */
export function buildUsageFilterExpression(
  startDate: string,
  endDate: string,
  userId?: string,
  assistantId?: string
): string {
  const filters: string[] = [buildDateRangeFilter(startDate, endDate)];

  // Add user ID filter if provided
  if (userId) {
    filters.push(buildUserIdFilter(userId));
  }

  // Add assistant ID filter if provided and not "all"
  if (assistantId && assistantId !== 'all') {
    filters.push(buildAssistantIdFilter(assistantId));
  }

  return combineFilters(filters);
}
