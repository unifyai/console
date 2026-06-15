'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
/**
 * Server actions for user spending limits and cumulative spend tracking.
 *
 * These actions follow the pattern established in lib/organizations/spending.ts:
 * - Curried functions that take apiKey and return async server actions
 * - Consistent error handling with ResponseProps
 * - Snake_case to camelCase transformation handled by API routes
 *
 * Note: These actions are for the user's personal workspace spending,
 * not organization spending. The user ID is derived from the authenticated
 * session, not passed as a parameter.
 */

import { ResponseProps } from '@/types/common';
import {
  UserSpend,
  UserSpendingLimitResponse,
  UserSpendingLimitRequest,
  isUserSpendData,
  isUserSpendingLimitData,
  getCurrentMonth,
} from '@/types/user/spending';

/**
 * Fetch the user's cumulative spend for a given month (personal workspace).
 *
 * @param apiKey - User's API key
 * @returns Async function that fetches spend data
 *
 * @example
 * const getSpend = await getUserSpend(apiKey);
 * const result = await getSpend('2026-01');
 * if (isUserSpendData(result)) {
 *   console.log(`You spent: $${result.cumulativeSpend}`);
 * }
 */
export async function getUserSpend(month?: string): Promise<UserSpend | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const targetMonth = month || getCurrentMonth();
  const requestUrl = `${process.env.NEXTAUTH_URL}/api/user/spending?month=${targetMonth}`;

  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: { apiKey: apiKey },
    });

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        console.error(
          `[user/spending.ts getUserSpend] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(`[user/spending.ts getUserSpend] Failed to parse JSON response ${parseError}`);
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      // 404 means no spend data yet - return zero spend
      if (response.status === 404) {
        return {
          userId: '',
          month: targetMonth,
          cumulativeSpend: 0,
          limit: null,
          percentUsed: 0,
        } as UserSpend;
      }
      const errorMessage =
        data.detail || data.error || `Failed to fetch user spending data: ${response.statusText}`;
      return { detail: errorMessage };
    }

    return data as UserSpend;
  } catch (error) {
    console.error(`[user/spending.ts getUserSpend] Error fetching spend:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}
/**
 * Fetch the user's spending limit configuration (personal workspace).
 *
 * @param apiKey - User's API key
 * @returns Async function that fetches spending limit
 *
 * @example
 * const getLimit = await getUserSpendingLimit(apiKey);
 * const result = await getLimit();
 * if (isUserSpendingLimitData(result)) {
 *   console.log(`Limit: $${result.monthlySpendingCap}`);
 * }
 */
export async function getUserSpendingLimit(): Promise<UserSpendingLimitResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/user/spending-limit`, {
      method: 'GET',
      headers: { apiKey: apiKey },
    });

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        console.error(
          `[user/spending.ts getUserSpendingLimit] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(
        `[user/spending.ts getUserSpendingLimit] Failed to parse JSON response ${parseError}`
      );
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      const errorMessage =
        data.detail || data.error || `Failed to fetch user spending limit: ${response.statusText}`;
      return { detail: errorMessage };
    }

    return data as UserSpendingLimitResponse;
  } catch (error) {
    console.error(`[user/spending.ts getUserSpendingLimit] Error fetching limit:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}
/**
 * Update the user's spending limit (personal workspace).
 *
 * @param apiKey - User's API key
 * @returns Async function that updates spending limit
 *
 * @example
 * const setLimit = await setUserSpendingLimit(apiKey);
 * const result = await setLimit({ monthlySpendingCap: 200 });
 * if (result.info) {
 *   console.log('User limit updated successfully');
 * }
 */
export async function setUserSpendingLimit(
  payload: UserSpendingLimitRequest
): Promise<(UserSpendingLimitResponse & ResponseProps) | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const requestUrl = `${process.env.NEXTAUTH_URL}/api/user/spending-limit`;

  try {
    const response = await fetch(requestUrl, {
      method: 'PUT',
      headers: {
        apiKey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        console.error(
          `[user/spending.ts setUserSpendingLimit] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(
        `[user/spending.ts setUserSpendingLimit] Failed to parse JSON response ${parseError}`
      );
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      const errorMessage =
        data.detail || data.error || `Failed to set user spending limit: ${response.statusText}`;
      return { detail: errorMessage };
    }

    return {
      ...data,
      info: 'User spending limit updated successfully.',
    } as UserSpendingLimitResponse & ResponseProps;
  } catch (error) {
    console.error(`[user/spending.ts setUserSpendingLimit] Error setting limit:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}
/**
 * Remove the user's spending limit (set to unlimited).
 *
 * @param apiKey - User's API key
 * @returns Async function that removes spending limit
 *
 * @example
 * const removeLimit = await removeUserSpendingLimit(apiKey);
 * const result = await removeLimit();
 * if (result.info) {
 *   console.log('User limit removed successfully');
 * }
 */
export async function removeUserSpendingLimit(): Promise<
  (UserSpendingLimitResponse & ResponseProps) | ResponseProps
> {
  return setUserSpendingLimit({ monthlySpendingCap: null });
}

// Re-export type guards for convenience
export { isUserSpendData, isUserSpendingLimitData };
