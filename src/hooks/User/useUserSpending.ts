/**
 * React hook for managing user spending data and limits (personal workspace).
 *
 * Provides:
 * - Current month's cumulative spend for the user
 * - Spending limit configuration
 * - Actions to update limits
 * - Loading and error states
 *
 * Uses polling to keep spend data fresh (updates every 60 seconds).
 *
 * Note: This is for the user's personal workspace spending, not organization spending.
 * The user ID is derived from the authenticated session.
 */

import * as React from 'react';
import {
  UserSpend,
  UserSpendingLimitResponse,
  UserSpendingLimitRequest,
  SpendingDisplayProps,
  isUserSpendData,
  isUserSpendingLimitData,
  calculateUserSpendingDisplay,
  getCurrentMonth,
} from '@/types/user/spending';
import { ResponseProps } from '@/types/common';
import { fetchUserSpend, fetchUserSpendingLimit } from '@/lib/client/spending';

/** Polling interval for spend updates (60 seconds) */
const SPEND_POLLING_INTERVAL = 60000;

/** Type for the setLimit action function */
type SetUserLimitAction = (
  payload: UserSpendingLimitRequest
) => Promise<(UserSpendingLimitResponse & ResponseProps) | ResponseProps>;

/** Hook configuration */
interface UseUserSpendingConfig {
  /** Server action to set spending limit */
  setLimitAction: SetUserLimitAction;
  /** Whether to enable automatic polling (default: true) */
  enablePolling?: boolean;
  /** Custom polling interval in ms (default: 60000) */
  pollingInterval?: number;
}

/** Hook return value */
interface UseUserSpendingResult {
  /** Current month's spend data */
  spend: UserSpend | null;
  /** Spending limit configuration */
  limit: UserSpendingLimitResponse | null;
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
 * Hook for managing user spending data (personal workspace).
 *
 * @example
 * const {
 *   spend,
 *   limit,
 *   display,
 *   isLoading,
 *   error,
 *   updateLimit
 * } = useUserSpending({
 *   getSpendAction: await getUserSpend(apiKey),
 *   getLimitAction: await getUserSpendingLimit(apiKey),
 *   setLimitAction: await setUserSpendingLimit(apiKey),
 * });
 *
 * // Display spending info
 * if (display) {
 *   return <SpendingProgress {...display} />;
 * }
 *
 * // Update limit
 * const { success } = await updateLimit(200);
 */
export function useUserSpending({
  setLimitAction,
  enablePolling = true,
  pollingInterval = SPEND_POLLING_INTERVAL,
}: UseUserSpendingConfig): UseUserSpendingResult {
  const [spend, setSpend] = React.useState<UserSpend | null>(null);
  const [limit, setLimit] = React.useState<UserSpendingLimitResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pollerRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentMonth = getCurrentMonth();

  // Fetch spend data
  const fetchSpend = React.useCallback(
    async (isBackground = false) => {
      if (isBackground) {
        setIsRefreshing(true);
      }

      try {
        const result = await fetchUserSpend(currentMonth);

        if (isUserSpendData(result)) {
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
          setError(err instanceof Error ? err.message : 'Failed to fetch user spending data');
        }
      } finally {
        if (isBackground) {
          setIsRefreshing(false);
        }
      }
    },
    [currentMonth]
  );

  // Fetch limit data
  const fetchLimit = React.useCallback(async () => {
    try {
      const result = await fetchUserSpendingLimit();

      if (isUserSpendingLimitData(result)) {
        setLimit(result);
      } else if ('detail' in result) {
        // Limit fetch errors are less critical, just log
        console.warn('[useUserSpending] Failed to fetch limit:', result.detail);
      }
    } catch (err) {
      console.warn('[useUserSpending] Failed to fetch limit:', err);
    }
  }, []);

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
    if (!enablePolling) return;

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
  }, [enablePolling, pollingInterval, fetchSpend]);

  // Calculate display properties
  const display = React.useMemo((): SpendingDisplayProps | null => {
    if (!spend) return null;

    return calculateUserSpendingDisplay(spend);
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
        const result = await setLimitAction({ monthlySpendingCap: newLimit });

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
          err instanceof Error ? err.message : 'Failed to update user spending limit';
        return { success: false, error: errorMsg };
      }
    },
    [setLimitAction, fetchLimit, fetchSpend]
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
