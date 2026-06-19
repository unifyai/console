'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
/**
 * Server actions for organization member spending limits and cumulative spend tracking.
 *
 * These actions follow the pattern established in lib/organizations/spending.ts:
 * - Curried functions that take apiKey and return async server actions
 * - Consistent error handling with ResponseProps
 * - Snake_case to camelCase transformation handled by API routes
 */

import { ResponseProps } from '@/types/common';
import {
  MemberSpend,
  MemberSpendingLimitResponse,
  MemberSpendingLimitRequest,
  isMemberSpendData,
  isMemberSpendingLimitData,
  getCurrentMonth,
} from '@/types/organization';

/**
 * Fetch the member's cumulative spend within an organization for a given month.
 *
 * @param apiKey - User's API key (must have org admin permissions)
 * @returns Async function that fetches spend data
 *
 * @example
 * const getSpend = await getMemberSpend(apiKey);
 * const result = await getSpend(123, 'user-456', '2026-01');
 * if (isMemberSpendData(result)) {
 *   console.log(`Member spent: $${result.cumulativeSpend}`);
 * }
 */
export async function getMemberSpend(
  orgId: number,
  userId: string,
  month?: string
): Promise<MemberSpend | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const targetMonth = month || getCurrentMonth();
  const requestUrl = `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/members/${encodeURIComponent(userId)}/spending?month=${targetMonth}`;

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
          `[organizations/member-spending.ts getMemberSpend] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(
        `[organizations/member-spending.ts getMemberSpend] Failed to parse JSON response ${parseError}`
      );
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      // 404 means no spend data yet - return zero spend
      if (response.status === 404) {
        return {
          orgId: orgId,
          userId: userId,
          month: targetMonth,
          cumulativeSpend: 0,
          limit: null,
          percentUsed: 0,
        } as MemberSpend;
      }
      const errorMessage =
        data.detail || data.error || `Failed to fetch member spending data: ${response.statusText}`;
      return { detail: errorMessage };
    }

    return data as MemberSpend;
  } catch (error) {
    console.error(
      `[organizations/member-spending.ts getMemberSpend] Error fetching spend for member ${userId} in org ${orgId}:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}

/**
 * Fetch the member's spending limit configuration within an organization.
 *
 * @param apiKey - User's API key (must have org admin permissions)
 * @returns Async function that fetches spending limit
 *
 * @example
 * const getLimit = await getMemberSpendingLimit(apiKey);
 * const result = await getLimit(123, 'user-456');
 * if (isMemberSpendingLimitData(result)) {
 *   console.log(`Limit: $${result.monthlySpendingCap}`);
 * }
 */
export async function getMemberSpendingLimit(
  orgId: number,
  userId: string
): Promise<MemberSpendingLimitResponse | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/members/${encodeURIComponent(userId)}/spending-limit`,
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
          `[organizations/member-spending.ts getMemberSpendingLimit] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(
        `[organizations/member-spending.ts getMemberSpendingLimit] Failed to parse JSON response ${parseError}`
      );
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      const errorMessage =
        data.detail ||
        data.error ||
        `Failed to fetch member spending limit: ${response.statusText}`;
      return { detail: errorMessage };
    }

    return data as MemberSpendingLimitResponse;
  } catch (error) {
    console.error(
      `[organizations/member-spending.ts getMemberSpendingLimit] Error fetching limit for member ${userId} in org ${orgId}:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}

/**
 * Update the member's spending limit within an organization.
 *
 * @param apiKey - User's API key (must have org admin permissions)
 * @returns Async function that updates spending limit
 *
 * @example
 * const setLimit = await setMemberSpendingLimit(apiKey);
 * const result = await setLimit(123, 'user-456', { monthlySpendingCap: 500 });
 * if (result.info) {
 *   console.log('Member limit updated successfully');
 * }
 */
export async function setMemberSpendingLimit(
  orgId: number,
  userId: string,
  payload: MemberSpendingLimitRequest
): Promise<(MemberSpendingLimitResponse & ResponseProps) | ResponseProps> {
  const apiKey = await requireUserApiKey();
  const requestUrl = `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/members/${encodeURIComponent(userId)}/spending-limit`;

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
          `[organizations/member-spending.ts setMemberSpendingLimit] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(
        `[organizations/member-spending.ts setMemberSpendingLimit] Failed to parse JSON response ${parseError}`
      );
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      const errorMessage =
        data.detail || data.error || `Failed to set member spending limit: ${response.statusText}`;
      return { detail: errorMessage };
    }

    return {
      ...data,
      info: 'Member spending limit updated successfully.',
    } as MemberSpendingLimitResponse & ResponseProps;
  } catch (error) {
    console.error(
      `[organizations/member-spending.ts setMemberSpendingLimit] Error setting limit for member ${userId} in org ${orgId}:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}

/**
 * Remove the member's spending limit (set to unlimited).
 *
 * @param apiKey - User's API key (must have org admin permissions)
 * @returns Async function that removes spending limit
 *
 * @example
 * const removeLimit = await removeMemberSpendingLimit(apiKey);
 * const result = await removeLimit(123, 'user-456');
 * if (result.info) {
 *   console.log('Member limit removed successfully');
 * }
 */
export async function removeMemberSpendingLimit(
  orgId: number,
  userId: string
): Promise<(MemberSpendingLimitResponse & ResponseProps) | ResponseProps> {
  const apiKey = await requireUserApiKey();
  return setMemberSpendingLimit(orgId, userId, { monthlySpendingCap: null });
}

// Re-export type guards for convenience
export { isMemberSpendData, isMemberSpendingLimitData };
