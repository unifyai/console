'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
/**
 * Server actions for assistant spending limits and cumulative spend tracking.
 *
 * These actions follow the pattern established in assistant.ts:
 * - Curried functions that take apiKey and return async server actions
 * - Consistent error handling with ResponseProps
 * - Snake_case to camelCase transformation handled by API routes
 */

import { ResponseProps } from '@/types/common';
import {
  AssistantSpend,
  SpendingLimitResponse,
  SpendingLimitRequest,
  isSpendingData,
  isSpendingLimitData,
  getCurrentMonth,
} from '@/types/assistants/spending';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';

/**
 * Fetch the assistant's cumulative spend for a given month.
 *
 * @param apiKey - User's API key
 * @returns Async function that fetches spend data
 *
 * @example
 * const getSpend = await getAssistantSpend(apiKey);
 * const result = await getSpend('assistant-123', '2026-01');
 * if (isSpendingData(result)) {
 *   console.log(`Spent: $${result.cumulativeSpend}`);
 * }
 */
export async function getAssistantSpend(
  assistantId: string,
  month?: string
): Promise<AssistantSpend | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const targetMonth = month || getCurrentMonth();

  try {
    const response = await fetch(
      `${getInternalApiBaseUrl()}/api/assistant/${assistantId}/spending?month=${targetMonth}`,
      {
        method: 'GET',
        headers: { apiKey: apiKey },
      }
    );

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        console.error(
          `[spending.ts getAssistantSpend] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(`[spending.ts getAssistantSpend] Failed to parse JSON response ${parseError}`);
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      // 404 means no spend data yet - return zero spend
      if (response.status === 404) {
        return {
          agentId: assistantId,
          month: targetMonth,
          cumulativeSpend: 0,
          limit: null,
          percentUsed: 0,
        } as AssistantSpend;
      }
      const errorMessage =
        data.detail || data.error || `Failed to fetch spending data: ${response.statusText}`;
      return { detail: errorMessage };
    }

    return data as AssistantSpend;
  } catch (error) {
    console.error(
      `[spending.ts getAssistantSpend] Error fetching spend for assistant ${assistantId}:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}
/**
 * Fetch the assistant's spending limit configuration.
 *
 * @param apiKey - User's API key
 * @returns Async function that fetches spending limit
 *
 * @example
 * const getLimit = await getAssistantSpendingLimit(apiKey);
 * const result = await getLimit('assistant-123');
 * if (isSpendingLimitData(result)) {
 *   console.log(`Limit: $${result.monthlySpendingCap}`);
 * }
 */
export async function getAssistantSpendingLimit(
  assistantId: string
): Promise<SpendingLimitResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(
      `${getInternalApiBaseUrl()}/api/assistant/${assistantId}/spending-limit`,
      {
        method: 'GET',
        headers: { apiKey: apiKey },
      }
    );

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        console.error(
          `[spending.ts getAssistantSpendingLimit] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(
        `[spending.ts getAssistantSpendingLimit] Failed to parse JSON response ${parseError}`
      );
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      const errorMessage =
        data.detail || data.error || `Failed to fetch spending limit: ${response.statusText}`;
      return { detail: errorMessage };
    }

    return data as SpendingLimitResponse;
  } catch (error) {
    console.error(
      `[spending.ts getAssistantSpendingLimit] Error fetching limit for assistant ${assistantId}:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}
/**
 * Update the assistant's spending limit.
 *
 * @param apiKey - User's API key
 * @returns Async function that updates spending limit
 *
 * @example
 * const setLimit = await setAssistantSpendingLimit(apiKey);
 * const result = await setLimit('assistant-123', { monthlySpendingCap: 100 });
 * if (result.info) {
 *   console.log('Limit updated successfully');
 * }
 */
export async function setAssistantSpendingLimit(
  assistantId: string,
  payload: SpendingLimitRequest
): Promise<(SpendingLimitResponse & ResponseProps) | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(
      `${getInternalApiBaseUrl()}/api/assistant/${assistantId}/spending-limit`,
      {
        method: 'PUT',
        headers: {
          apiKey: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        console.error(
          `[spending.ts setAssistantSpendingLimit] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(
        `[spending.ts setAssistantSpendingLimit] Failed to parse JSON response ${parseError}`
      );
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      const errorMessage =
        data.detail || data.error || `Failed to set spending limit: ${response.statusText}`;
      return { detail: errorMessage };
    }

    return {
      ...data,
      info: 'Spending limit updated successfully.',
    } as SpendingLimitResponse & ResponseProps;
  } catch (error) {
    console.error(
      `[spending.ts setAssistantSpendingLimit] Error setting limit for assistant ${assistantId}:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}
/**
 * Remove the assistant's spending limit (set to unlimited).
 *
 * @param apiKey - User's API key
 * @returns Async function that removes spending limit
 *
 * @example
 * const removeLimit = await removeAssistantSpendingLimit(apiKey);
 * const result = await removeLimit('assistant-123');
 * if (result.info) {
 *   console.log('Limit removed successfully');
 * }
 */
export async function removeAssistantSpendingLimit(
  assistantId: string
): Promise<(SpendingLimitResponse & ResponseProps) | ResponseProps> {
  return setAssistantSpendingLimit(assistantId, { monthlySpendingCap: null });
}

// Re-export type guards for convenience
export { isSpendingData, isSpendingLimitData };
