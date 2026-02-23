/**
 * Server actions for organization spending limits and cumulative spend tracking.
 *
 * These actions follow the pattern established in lib/assistants/spending.ts:
 * - Curried functions that take apiKey and return async server actions
 * - Consistent error handling with ResponseProps
 * - Snake_case to camelCase transformation handled by API routes
 */

import { ResponseProps } from '@/types/common';
import {
  OrgSpend,
  OrgSpendingLimitResponse,
  OrgSpendingLimitRequest,
  isOrgSpendData,
  isOrgSpendingLimitData,
  getCurrentMonth,
} from '@/types/organization';

/**
 * Fetch the organization's cumulative spend for a given month.
 *
 * @param apiKey - User's API key
 * @returns Async function that fetches spend data
 *
 * @example
 * const getSpend = await getOrgSpend(apiKey);
 * const result = await getSpend(123, '2026-01');
 * if (isOrgSpendData(result)) {
 *   console.log(`Org spent: $${result.cumulativeSpend}`);
 * }
 */
export const getOrgSpend = async (apiKey: string) => {
  return async (orgId: number, month?: string): Promise<OrgSpend | ResponseProps> => {
    'use server';

    const targetMonth = month || getCurrentMonth();
    const requestUrl = `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/spending?month=${targetMonth}`;

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
            `[organizations/spending.ts getOrgSpend] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[organizations/spending.ts getOrgSpend] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        // 404 means no spend data yet - return zero spend
        if (response.status === 404) {
          return {
            orgId: orgId,
            month: targetMonth,
            cumulativeSpend: 0,
            limit: null,
            percentUsed: 0,
          } as OrgSpend;
        }
        const errorMessage =
          data.detail ||
          data.error ||
          `Failed to fetch organization spending data: ${response.statusText}`;
        return { detail: errorMessage };
      }

      return data as OrgSpend;
    } catch (error) {
      console.error(
        `[organizations/spending.ts getOrgSpend] Error fetching spend for org ${orgId}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Fetch the organization's spending limit configuration.
 *
 * @param apiKey - User's API key
 * @returns Async function that fetches spending limit
 *
 * @example
 * const getLimit = await getOrgSpendingLimit(apiKey);
 * const result = await getLimit(123);
 * if (isOrgSpendingLimitData(result)) {
 *   console.log(`Limit: $${result.monthlySpendingCap}`);
 * }
 */
export const getOrgSpendingLimit = async (apiKey: string) => {
  return async (orgId: number): Promise<OrgSpendingLimitResponse | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/spending-limit`,
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
            `[organizations/spending.ts getOrgSpendingLimit] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[organizations/spending.ts getOrgSpendingLimit] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage =
          data.detail ||
          data.error ||
          `Failed to fetch organization spending limit: ${response.statusText}`;
        return { detail: errorMessage };
      }

      return data as OrgSpendingLimitResponse;
    } catch (error) {
      console.error(
        `[organizations/spending.ts getOrgSpendingLimit] Error fetching limit for org ${orgId}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Update the organization's spending limit.
 *
 * @param apiKey - User's API key
 * @returns Async function that updates spending limit
 *
 * @example
 * const setLimit = await setOrgSpendingLimit(apiKey);
 * const result = await setLimit(123, { monthlySpendingCap: 5000 });
 * if (result.info) {
 *   console.log('Org limit updated successfully');
 * }
 */
export const setOrgSpendingLimit = async (apiKey: string) => {
  return async (
    orgId: number,
    payload: OrgSpendingLimitRequest
  ): Promise<(OrgSpendingLimitResponse & ResponseProps) | ResponseProps> => {
    'use server';

    const requestUrl = `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/spending-limit`;

    try {
      const response = await fetch(requestUrl, {
        method: 'PATCH',
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
            `[organizations/spending.ts setOrgSpendingLimit] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[organizations/spending.ts setOrgSpendingLimit] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage =
          data.detail ||
          data.error ||
          `Failed to set organization spending limit: ${response.statusText}`;
        return { detail: errorMessage };
      }

      return {
        ...data,
        info: 'Organization spending limit updated successfully.',
      } as OrgSpendingLimitResponse & ResponseProps;
    } catch (error) {
      console.error(
        `[organizations/spending.ts setOrgSpendingLimit] Error setting limit for org ${orgId}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Remove the organization's spending limit (set to unlimited).
 *
 * @param apiKey - User's API key
 * @returns Async function that removes spending limit
 *
 * @example
 * const removeLimit = await removeOrgSpendingLimit(apiKey);
 * const result = await removeLimit(123);
 * if (result.info) {
 *   console.log('Org limit removed successfully');
 * }
 */
export const removeOrgSpendingLimit = async (apiKey: string) => {
  return async (
    orgId: number
  ): Promise<(OrgSpendingLimitResponse & ResponseProps) | ResponseProps> => {
    'use server';

    const setLimit = await setOrgSpendingLimit(apiKey);
    return setLimit(orgId, { monthlySpendingCap: null });
  };
};

// Re-export type guards for convenience
export { isOrgSpendData, isOrgSpendingLimitData };
