'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
/**
 * Usage Server Actions
 *
 * These are bound server actions that capture the API key in a closure.
 * The API key is never exposed to the client - only the action function is passed.
 *
 * This follows the same pattern as lib/interfaces/tiles.ts
 */

import { ResponseProps } from '@/types/common';
import { getCurrentMonth } from '@/types/assistants/spending';

/**
 * Spending limit information for display in the usage page.
 * Includes the actual cumulative spend for the current month so progress
 * bars reflect the real monthly spend (not the date-range filtered total).
 */
export interface SpendingLimitInfo {
  /** Type of limit (user, org, member, assistant) */
  type: 'user' | 'org' | 'member' | 'assistant';
  /** Monthly spending limit in dollars (null = unlimited) */
  limit: number | null;
  /** Label to display */
  label: string;
  /** Actual cumulative spend for the current billing month */
  currentSpend: number;
}

/**
 * Fetch user spending limit for personal workspace.
 * Also fetches the user's cumulative spend for the current month so the
 * progress bar reflects the real monthly spend (not the date-range total).
 */
export async function getUserSpendingLimitAction(): Promise<SpendingLimitInfo | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const month = getCurrentMonth();

    // Fetch limit and cumulative spend in parallel
    const [limitRes, spendRes] = await Promise.all([
      fetch(`${process.env.NEXTAUTH_URL}/api/user/spending-limit`, {
        method: 'GET',
        headers: { apiKey },
        cache: 'no-store',
      }),
      fetch(`${process.env.NEXTAUTH_URL}/api/user/spending?month=${month}`, {
        method: 'GET',
        headers: { apiKey },
        cache: 'no-store',
      }),
    ]);

    const limitData = await limitRes.json();

    if (!limitRes.ok) {
      return { detail: limitData.detail || 'Failed to fetch user spending limit' };
    }

    let currentSpend = 0;
    if (spendRes.ok) {
      const spendData = await spendRes.json();
      currentSpend = spendData.cumulativeSpend ?? 0;
    }

    return {
      type: 'user',
      limit: limitData.monthlySpendingCap ?? null,
      label: 'My Limit',
      currentSpend,
    };
  } catch (error) {
    console.error('[usage/actions] Error fetching user spending limit:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch organization spending limit.
 * Also fetches the org's cumulative spend for the current month.
 */
export async function getOrgSpendingLimitAction(
  orgId: number
): Promise<SpendingLimitInfo | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const month = getCurrentMonth();

    const [limitRes, spendRes] = await Promise.all([
      fetch(`${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/spending-limit`, {
        method: 'GET',
        headers: { apiKey },
        cache: 'no-store',
      }),
      fetch(`${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/spending?month=${month}`, {
        method: 'GET',
        headers: { apiKey },
        cache: 'no-store',
      }),
    ]);

    const limitData = await limitRes.json();

    if (!limitRes.ok) {
      return { detail: limitData.detail || 'Failed to fetch org spending limit' };
    }

    let currentSpend = 0;
    if (spendRes.ok) {
      const spendData = await spendRes.json();
      currentSpend = spendData.cumulativeSpend ?? 0;
    }

    return {
      type: 'org',
      limit: limitData.monthlySpendingCap ?? null,
      label: 'Org Limit',
      currentSpend,
    };
  } catch (error) {
    console.error('[usage/actions] Error fetching org spending limit:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch member spending limit within an organization.
 * Also fetches the member's cumulative spend for the current month.
 */
export async function getMemberSpendingLimitAction(
  orgId: number,
  userId: string
): Promise<SpendingLimitInfo | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const month = getCurrentMonth();

    const [limitRes, spendRes] = await Promise.all([
      fetch(
        `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/members/${encodeURIComponent(userId)}/spending-limit`,
        {
          method: 'GET',
          headers: { apiKey },
          cache: 'no-store',
        }
      ),
      fetch(
        `${process.env.NEXTAUTH_URL}/api/organizations/${orgId}/members/${encodeURIComponent(userId)}/spending?month=${month}`,
        {
          method: 'GET',
          headers: { apiKey },
          cache: 'no-store',
        }
      ),
    ]);

    const limitData = await limitRes.json();

    if (!limitRes.ok) {
      return { detail: limitData.detail || 'Failed to fetch member spending limit' };
    }

    let currentSpend = 0;
    if (spendRes.ok) {
      const spendData = await spendRes.json();
      currentSpend = spendData.cumulativeSpend ?? 0;
    }

    return {
      type: 'member',
      limit: limitData.monthlySpendingCap ?? null,
      label: 'Member Limit',
      currentSpend,
    };
  } catch (error) {
    console.error('[usage/actions] Error fetching member spending limit:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch assistant spending limit.
 * Also fetches the assistant's cumulative spend for the current month.
 */
export async function getAssistantSpendingLimitAction(
  assistantId: string
): Promise<SpendingLimitInfo | ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const month = getCurrentMonth();

    const [limitRes, spendRes] = await Promise.all([
      fetch(`${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/spending-limit`, {
        method: 'GET',
        headers: { apiKey },
        cache: 'no-store',
      }),
      fetch(`${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/spending?month=${month}`, {
        method: 'GET',
        headers: { apiKey },
        cache: 'no-store',
      }),
    ]);

    const limitData = await limitRes.json();

    if (!limitRes.ok) {
      return { detail: limitData.detail || 'Failed to fetch assistant spending limit' };
    }

    let currentSpend = 0;
    if (spendRes.ok) {
      const spendData = await spendRes.json();
      currentSpend = spendData.cumulativeSpend ?? 0;
    }

    return {
      type: 'assistant',
      limit: limitData.effectiveLimit ?? limitData.monthlySpendingCap ?? null,
      label: 'Assistant Limit',
      currentSpend,
    };
  } catch (error) {
    console.error('[usage/actions] Error fetching assistant spending limit:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Set user spending limit for personal workspace
 */
export async function setUserSpendingLimitAction(
  limit: number | null
): Promise<SpendingLimitInfo | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
      currentSpend: 0, // Will be refreshed on next limit fetch
    };
  } catch (error) {
    console.error('[usage/actions] Error setting user spending limit:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Set organization spending limit
 */
export async function setOrgSpendingLimitAction(
  orgId: number,
  limit: number | null
): Promise<SpendingLimitInfo | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
      currentSpend: 0, // Will be refreshed on next limit fetch
    };
  } catch (error) {
    console.error('[usage/actions] Error setting org spending limit:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Set member spending limit within an organization
 */
export async function setMemberSpendingLimitAction(
  orgId: number,
  userId: string,
  limit: number | null
): Promise<SpendingLimitInfo | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
      currentSpend: 0, // Will be refreshed on next limit fetch
    };
  } catch (error) {
    console.error('[usage/actions] Error setting member spending limit:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Set assistant spending limit
 */
export async function setAssistantSpendingLimitAction(
  assistantId: string,
  limit: number | null
): Promise<SpendingLimitInfo | ResponseProps> {
  const apiKey = await requireUserApiKey();
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
      currentSpend: 0, // Will be refreshed on next limit fetch
    };
  } catch (error) {
    console.error('[usage/actions] Error setting assistant spending limit:', error);
    return { detail: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Type for the usage actions object passed to client components
 */
export interface UsageActions {
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
