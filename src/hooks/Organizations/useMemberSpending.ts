/**
 * React hook for managing organization member spending data and limits.
 *
 * Provides:
 * - Current month's cumulative spend for a member within an organization
 * - Spending limit configuration for the member
 * - Actions to update limits
 * - Loading and error states
 *
 * Uses polling to keep spend data fresh (updates every 60 seconds).
 */

import * as React from 'react';
import {
  MemberSpend,
  MemberSpendingLimitResponse,
  MemberSpendingLimitRequest,
  SpendingDisplayProps,
  isMemberSpendData,
  isMemberSpendingLimitData,
  calculateMemberSpendingDisplay,
  getCurrentMonth,
} from '@/types/organization';
import { ResponseProps } from '@/types/common';

/** Polling interval for spend updates (60 seconds) */
const SPEND_POLLING_INTERVAL = 60000;

/** Type for the getSpend action function */
type GetMemberSpendAction = (
  orgId: number,
  userId: string,
  month?: string
) => Promise<MemberSpend | ResponseProps>;

/** Type for the getLimit action function */
type GetMemberLimitAction = (
  orgId: number,
  userId: string
) => Promise<MemberSpendingLimitResponse | ResponseProps>;

/** Type for the setLimit action function */
type SetMemberLimitAction = (
  orgId: number,
  userId: string,
  payload: MemberSpendingLimitRequest
) => Promise<(MemberSpendingLimitResponse & ResponseProps) | ResponseProps>;

/** Hook configuration */
interface UseMemberSpendingConfig {
  /** Organization ID */
  orgId: number;
  /** User ID of the member */
  userId: string;
  /** Server action to fetch spend data */
  getSpendAction: GetMemberSpendAction;
  /** Server action to fetch spending limit */
  getLimitAction: GetMemberLimitAction;
  /** Server action to set spending limit */
  setLimitAction: SetMemberLimitAction;
  /** Whether to enable automatic polling (default: true) */
  enablePolling?: boolean;
  /** Custom polling interval in ms (default: 60000) */
  pollingInterval?: number;
}

/** Hook return value */
interface UseMemberSpendingResult {
  /** Current month's spend data */
  spend: MemberSpend | null;
  /** Spending limit configuration */
  limit: MemberSpendingLimitResponse | null;
  /** Calculated display properties for UI */
  display: SpendingDisplayProps | null;
  /** Whether data is currently being fetched */
  isLoading: boolean;
  /** Whether spend data is being refreshed in background */
  isRefreshing: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refresh spend data */
  refreshSpend: () => Promise<void>;
  /** Manually refresh limit data */
  refreshLimit: () => Promise<void>;
  /** Refresh both spend and limit data */
  refreshAll: () => Promise<void>;
  /** Update the spending limit */
  updateLimit: (newLimit: number | null) => Promise<{ success: boolean; error?: string }>;
  /** Current month being displayed (YYYY-MM) */
  currentMonth: string;
}

/**
 * Hook for managing organization member spending data.
 *
 * @example
 * const {
 *   spend,
 *   limit,
 *   display,
 *   isLoading,
 *   error,
 *   updateLimit
 * } = useMemberSpending({
 *   orgId: 123,
 *   userId: 'user-456',
 *   getSpendAction: await getMemberSpend(apiKey),
 *   getLimitAction: await getMemberSpendingLimit(apiKey),
 *   setLimitAction: await setMemberSpendingLimit(apiKey),
 * });
 *
 * // Display spending info
 * if (display) {
 *   return <SpendingProgress {...display} />;
 * }
 *
 * // Update limit
 * const { success } = await updateLimit(500);
 */
export function useMemberSpending({
  orgId,
  userId,
  getSpendAction,
  getLimitAction,
  setLimitAction,
  enablePolling = true,
  pollingInterval = SPEND_POLLING_INTERVAL,
}: UseMemberSpendingConfig): UseMemberSpendingResult {
  const [spend, setSpend] = React.useState<MemberSpend | null>(null);
  const [limit, setLimit] = React.useState<MemberSpendingLimitResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pollerRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentMonth = getCurrentMonth();

  // Fetch spend data
  const fetchSpend = React.useCallback(
    async (isBackground = false) => {
      if (!orgId || !userId) {
        return;
      }

      if (isBackground) {
        setIsRefreshing(true);
      }

      try {
        const result = await getSpendAction(orgId, userId, currentMonth);

        if (isMemberSpendData(result)) {
          setSpend(result);
          setError(null);
        } else if ('detail' in result) {
          // Only set error if not a background refresh
          if (!isBackground) {
            setError(result.detail as string);
          }
        }
      } catch (err) {
        if (!isBackground) {
          setError(err instanceof Error ? err.message : 'Failed to fetch member spending data');
        }
      } finally {
        if (isBackground) {
          setIsRefreshing(false);
        }
      }
    },
    [orgId, userId, currentMonth, getSpendAction]
  );

  // Fetch limit data
  const fetchLimit = React.useCallback(async () => {
    if (!orgId || !userId) return;

    try {
      const result = await getLimitAction(orgId, userId);

      if (isMemberSpendingLimitData(result)) {
        setLimit(result);
      } else if ('detail' in result) {
        // Limit fetch errors are less critical, just log
        console.warn('[useMemberSpending] Failed to fetch limit:', result.detail);
      }
    } catch (err) {
      console.warn('[useMemberSpending] Failed to fetch limit:', err);
    }
  }, [orgId, userId, getLimitAction]);

  // Initial data fetch
  React.useEffect(() => {
    let mounted = true;

    const fetchInitialData = async () => {
      setIsLoading(true);
      setError(null);

      await Promise.all([fetchSpend(false), fetchLimit()]);

      if (mounted) {
        setIsLoading(false);
      }
    };

    fetchInitialData();

    return () => {
      mounted = false;
    };
  }, [fetchSpend, fetchLimit]);

  // Set up polling for spend data
  React.useEffect(() => {
    if (!enablePolling || !orgId || !userId) return;

    // Clear any existing poller
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
    }

    // Start polling
    pollerRef.current = setInterval(() => {
      fetchSpend(true); // Background refresh
    }, pollingInterval);

    return () => {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
      }
    };
  }, [enablePolling, orgId, userId, pollingInterval, fetchSpend]);

  // Calculate display properties
  const display = React.useMemo((): SpendingDisplayProps | null => {
    if (!spend) return null;

    return calculateMemberSpendingDisplay(spend);
  }, [spend]);

  // Action to manually refresh spend
  const refreshSpend = React.useCallback(async () => {
    await fetchSpend(false);
  }, [fetchSpend]);

  // Action to manually refresh limit
  const refreshLimit = React.useCallback(async () => {
    await fetchLimit();
  }, [fetchLimit]);

  // Action to refresh all data
  const refreshAll = React.useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchSpend(false), fetchLimit()]);
    setIsLoading(false);
  }, [fetchSpend, fetchLimit]);

  // Action to update limit
  const updateLimit = React.useCallback(
    async (newLimit: number | null): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await setLimitAction(orgId, userId, { monthlySpendingCap: newLimit });

        if ('detail' in result && !('info' in result)) {
          return { success: false, error: result.detail as string };
        }

        // Refresh limit data after successful update
        await fetchLimit();

        // Also refresh spend to get updated percentUsed
        await fetchSpend(false);

        return { success: true };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Failed to update member spending limit';
        return { success: false, error: errorMsg };
      }
    },
    [orgId, userId, setLimitAction, fetchLimit, fetchSpend]
  );

  return {
    spend,
    limit,
    display,
    isLoading,
    isRefreshing,
    error,
    refreshSpend,
    refreshLimit,
    refreshAll,
    updateLimit,
    currentMonth,
  };
}
