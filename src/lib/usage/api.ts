/**
 * Usage API Layer
 *
 * Client-side functions for fetching usage metrics via the Next.js API route.
 */

import { ResponseProps } from '@/types/common';
import { UsageMetricsResponse, UsageApiError, TimeGranularity } from '@/types/usage';

/**
 * Fetch usage metrics for billed_cost.
 *
 * This function calls the Next.js API route at /api/logs/sum,
 * which proxies to the Orchestra metrics endpoint.
 *
 * @param apiKey User's API key
 * @param context Context path for the logs
 * @param groupBy Time granularity for grouping
 * @param filterExpr Filter expression for date range
 * @returns Metrics response or error
 */
export async function getUsageMetrics(
  apiKey: string,
  context: string,
  groupBy: TimeGranularity,
  filterExpr: string
): Promise<UsageMetricsResponse | UsageApiError> {
  try {
    const params = new URLSearchParams({
      projectName: 'Assistants',
      context,
      key: 'billed_cost',
      groupBy,
      filterExpr,
    });

    // Use relative URL for client-side fetch
    const url = `/api/logs/sum?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        detail: data.detail || `Failed to fetch usage metrics: ${response.statusText}`,
      };
    }

    return data as UsageMetricsResponse;
  } catch (error) {
    console.error('[usage/api] Error fetching usage metrics:', error);
    return {
      detail: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Create bound server actions for usage API calls.
 * This pattern follows the existing codebase convention.
 *
 * @param apiKey User's API key
 * @returns Object with bound server actions
 */
export function createUsageActions(apiKey: string) {
  return {
    /**
     * Fetch usage metrics with bound API key.
     */
    getMetrics: async (
      context: string,
      groupBy: TimeGranularity,
      filterExpr: string
    ): Promise<UsageMetricsResponse | UsageApiError> => {
      return getUsageMetrics(apiKey, context, groupBy, filterExpr);
    },
  };
}

/**
 * Type for the usage actions object
 */
export type UsageActions = ReturnType<typeof createUsageActions>;

/**
 * Type guard to check if a response is an error.
 */
export function isUsageError(
  response: UsageMetricsResponse | UsageApiError | ResponseProps
): response is UsageApiError {
  return (
    response !== null &&
    typeof response === 'object' &&
    'detail' in response &&
    typeof (response as UsageApiError).detail === 'string'
  );
}

/**
 * Fetch usage metrics with retry logic.
 *
 * @param apiKey User's API key
 * @param context Context path
 * @param groupBy Time granularity
 * @param filterExpr Filter expression
 * @param maxRetries Maximum number of retries (default: 2)
 * @returns Metrics response or error
 */
export async function getUsageMetricsWithRetry(
  apiKey: string,
  context: string,
  groupBy: TimeGranularity,
  filterExpr: string,
  maxRetries: number = 2
): Promise<UsageMetricsResponse | UsageApiError> {
  let lastError: UsageApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await getUsageMetrics(apiKey, context, groupBy, filterExpr);

    if (!isUsageError(result)) {
      return result;
    }

    lastError = result;

    // Don't retry on client errors (4xx)
    if (
      result.detail.includes('400') ||
      result.detail.includes('401') ||
      result.detail.includes('403') ||
      result.detail.includes('404')
    ) {
      return result;
    }

    // Wait before retrying (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
    }
  }

  return lastError || { detail: 'Failed after retries' };
}
