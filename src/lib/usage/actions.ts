'use server';

/**
 * Usage Server Actions
 *
 * These are bound server actions that capture the API key in a closure.
 * The API key is never exposed to the client - only the action function is passed.
 *
 * This follows the same pattern as lib/interfaces/tiles.ts and lib/assistants/task.ts
 */

import { UsageMetricsResponse, UsageApiError, TimeGranularity } from '@/types/usage';

/**
 * Create a bound server action to fetch usage metrics.
 * The API key is captured in the closure and never sent to the client.
 *
 * @param apiKey User's API key (only accessed on server)
 * @returns Bound server action function
 */
export const getUsageMetrics = async (apiKey: string) => {
  return async (
    context: string,
    groupBy: TimeGranularity,
    filterExpr: string
  ): Promise<UsageMetricsResponse | UsageApiError> => {
    'use server';

    try {
      const params = new URLSearchParams({
        projectName: 'Assistants',
        context,
        key: 'billed_cost',
        groupBy,
        filterExpr,
      });

      const url = `${process.env.NEXTAUTH_URL}/api/logs/sum?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          apiKey,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          detail: data.detail || `Failed to fetch usage metrics: ${response.statusText}`,
        };
      }

      return data as UsageMetricsResponse;
    } catch (error) {
      console.error('[usage/actions] Error fetching usage metrics:', error);
      return {
        detail: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  };
};

/**
 * Type for the usage actions object passed to client components
 */
export interface UsageActions {
  getMetrics: (
    context: string,
    groupBy: TimeGranularity,
    filterExpr: string
  ) => Promise<UsageMetricsResponse | UsageApiError>;
}

/**
 * Create a usage actions object with all bound server actions.
 *
 * @param apiKey User's API key
 * @returns Object containing bound server actions
 */
export async function createUsageActions(apiKey: string): Promise<UsageActions> {
  return {
    getMetrics: await getUsageMetrics(apiKey),
  };
}
