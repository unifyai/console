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
import { ResponseProps } from '@/types/common';

/**
 * Spending limit information for display in the usage page
 */
export interface SpendingLimitInfo {
  /** Type of limit (user, org, member, assistant) */
  type: 'user' | 'org' | 'member' | 'assistant';
  /** Monthly spending limit in dollars (null = unlimited) */
  limit: number | null;
  /** Label to display */
  label: string;
}

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
 * Fetch user spending limit for personal workspace
 */
export const getUserSpendingLimitAction = async (apiKey: string) => {
  return async (): Promise<SpendingLimitInfo | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/user/spending-limit`, {
        method: 'GET',
        headers: { apiKey },
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || 'Failed to fetch user spending limit' };
      }

      return {
        type: 'user',
        limit: data.monthlySpendingCap ?? null,
        label: 'My Limit',
      };
    } catch (error) {
      console.error('[usage/actions] Error fetching user spending limit:', error);
      return { detail: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
};

/**
 * Fetch organization spending limit
 */
export const getOrgSpendingLimitAction = async (apiKey: string) => {
  return async (orgId: number): Promise<SpendingLimitInfo | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/spending-limit`,
        {
          method: 'GET',
          headers: { apiKey },
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || 'Failed to fetch org spending limit' };
      }

      return {
        type: 'org',
        limit: data.monthlySpendingCap ?? null,
        label: 'Org Limit',
      };
    } catch (error) {
      console.error('[usage/actions] Error fetching org spending limit:', error);
      return { detail: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
};

/**
 * Fetch member spending limit within an organization
 */
export const getMemberSpendingLimitAction = async (apiKey: string) => {
  return async (orgId: number, userId: string): Promise<SpendingLimitInfo | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/members/${encodeURIComponent(userId)}/spending-limit`,
        {
          method: 'GET',
          headers: { apiKey },
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || 'Failed to fetch member spending limit' };
      }

      return {
        type: 'member',
        limit: data.monthlySpendingCap ?? null,
        label: 'Member Limit',
      };
    } catch (error) {
      console.error('[usage/actions] Error fetching member spending limit:', error);
      return { detail: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
};

/**
 * Fetch assistant spending limit
 */
export const getAssistantSpendingLimitAction = async (apiKey: string) => {
  return async (assistantId: string): Promise<SpendingLimitInfo | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/spending-limit`,
        {
          method: 'GET',
          headers: { apiKey },
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || 'Failed to fetch assistant spending limit' };
      }

      return {
        type: 'assistant',
        limit: data.effectiveLimit ?? data.monthlySpendingCap ?? null,
        label: 'Assistant Limit',
      };
    } catch (error) {
      console.error('[usage/actions] Error fetching assistant spending limit:', error);
      return { detail: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
};

/**
 * Set user spending limit for personal workspace
 */
export const setUserSpendingLimitAction = async (apiKey: string) => {
  return async (limit: number | null): Promise<SpendingLimitInfo | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/user/spending-limit`, {
        method: 'PUT',
        headers: { apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlySpendingCap: limit }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || 'Failed to set user spending limit' };
      }

      return {
        type: 'user',
        limit: data.monthlySpendingCap ?? null,
        label: 'My Limit',
      };
    } catch (error) {
      console.error('[usage/actions] Error setting user spending limit:', error);
      return { detail: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
};

/**
 * Set organization spending limit
 */
export const setOrgSpendingLimitAction = async (apiKey: string) => {
  return async (orgId: number, limit: number | null): Promise<SpendingLimitInfo | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/spending-limit`,
        {
          method: 'PUT',
          headers: { apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthlySpendingCap: limit }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || 'Failed to set org spending limit' };
      }

      return {
        type: 'org',
        limit: data.monthlySpendingCap ?? null,
        label: 'Org Limit',
      };
    } catch (error) {
      console.error('[usage/actions] Error setting org spending limit:', error);
      return { detail: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
};

/**
 * Set member spending limit within an organization
 */
export const setMemberSpendingLimitAction = async (apiKey: string) => {
  return async (
    orgId: number,
    userId: string,
    limit: number | null
  ): Promise<SpendingLimitInfo | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/members/${encodeURIComponent(userId)}/spending-limit`,
        {
          method: 'PUT',
          headers: { apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthlySpendingCap: limit }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || 'Failed to set member spending limit' };
      }

      return {
        type: 'member',
        limit: data.monthlySpendingCap ?? null,
        label: 'My Limit',
      };
    } catch (error) {
      console.error('[usage/actions] Error setting member spending limit:', error);
      return { detail: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
};

/**
 * Set assistant spending limit
 */
export const setAssistantSpendingLimitAction = async (apiKey: string) => {
  return async (
    assistantId: string,
    limit: number | null
  ): Promise<SpendingLimitInfo | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/spending-limit`,
        {
          method: 'PUT',
          headers: { apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ monthlySpendingCap: limit }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || 'Failed to set assistant spending limit' };
      }

      return {
        type: 'assistant',
        limit: data.effectiveLimit ?? data.monthlySpendingCap ?? null,
        label: 'Assistant Limit',
      };
    } catch (error) {
      console.error('[usage/actions] Error setting assistant spending limit:', error);
      return { detail: error instanceof Error ? error.message : 'Unknown error' };
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
  getUserSpendingLimit: () => Promise<SpendingLimitInfo | ResponseProps>;
  getOrgSpendingLimit: (orgId: number) => Promise<SpendingLimitInfo | ResponseProps>;
  getMemberSpendingLimit: (
    orgId: number,
    userId: string
  ) => Promise<SpendingLimitInfo | ResponseProps>;
  getAssistantSpendingLimit: (assistantId: string) => Promise<SpendingLimitInfo | ResponseProps>;
  setUserSpendingLimit: (limit: number | null) => Promise<SpendingLimitInfo | ResponseProps>;
  setOrgSpendingLimit: (
    orgId: number,
    limit: number | null
  ) => Promise<SpendingLimitInfo | ResponseProps>;
  setMemberSpendingLimit: (
    orgId: number,
    userId: string,
    limit: number | null
  ) => Promise<SpendingLimitInfo | ResponseProps>;
  setAssistantSpendingLimit: (
    assistantId: string,
    limit: number | null
  ) => Promise<SpendingLimitInfo | ResponseProps>;
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
    getUserSpendingLimit: await getUserSpendingLimitAction(apiKey),
    getOrgSpendingLimit: await getOrgSpendingLimitAction(apiKey),
    getMemberSpendingLimit: await getMemberSpendingLimitAction(apiKey),
    getAssistantSpendingLimit: await getAssistantSpendingLimitAction(apiKey),
    setUserSpendingLimit: await setUserSpendingLimitAction(apiKey),
    setOrgSpendingLimit: await setOrgSpendingLimitAction(apiKey),
    setMemberSpendingLimit: await setMemberSpendingLimitAction(apiKey),
    setAssistantSpendingLimit: await setAssistantSpendingLimitAction(apiKey),
  };
}
