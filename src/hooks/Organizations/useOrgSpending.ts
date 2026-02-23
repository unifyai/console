/**
 * React hook for managing organization spending data and limits.
 *
 * Provides:
 * - Current month's cumulative spend for the organization
 * - Spending limit configuration
 * - Actions to update limits
 * - Loading and error states
 *
 * Uses polling to keep spend data fresh (updates every 60 seconds).
 */

import * as React from 'react';
import {
  OrgSpend,
  OrgSpendingLimitResponse,
  OrgSpendingLimitRequest,
  SpendingDisplayProps,
  isOrgSpendData,
  isOrgSpendingLimitData,
  calculateOrgSpendingDisplay,
  getCurrentMonth,
} from '@/types/organization';
import { ResponseProps } from '@/types/common';

/** Polling interval for spend updates (60 seconds) */
const SPEND_POLLING_INTERVAL = 60000;

/** Type for the getSpend action function */
type GetOrgSpendAction = (orgId: number, month?: string) => Promise<OrgSpend | ResponseProps>;

/** Type for the getLimit action function */
type GetOrgLimitAction = (orgId: number) => Promise<OrgSpendingLimitResponse | ResponseProps>;

/** Type for the setLimit action function */
type SetOrgLimitAction = (
  orgId: number,
  payload: OrgSpendingLimitRequest
) => Promise<(OrgSpendingLimitResponse & ResponseProps) | ResponseProps>;

/** Hook configuration */
interface UseOrgSpendingConfig {
  /** Organization ID to fetch spending data for */
  orgId: number;
  /** Server action to fetch spend data */
  getSpendAction: GetOrgSpendAction;
  /** Server action to fetch spending limit */
  getLimitAction: GetOrgLimitAction;
  /** Server action to set spending limit */
  setLimitAction: SetOrgLimitAction;
  /** Whether to enable automatic polling (default: true) */
  enablePolling?: boolean;
  /** Custom polling interval in ms (default: 60000) */
  pollingInterval?: number;
}

/** Hook return value */
interface UseOrgSpendingResult {
  /** Current month's spend data */
  spend: OrgSpend | null;
  /** Spending limit configuration */
  limit: OrgSpendingLimitResponse | null;
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
 * Hook for managing organization spending data.
 *
 * @example
 * const {
 *   spend,
 *   limit,
 *   display,
 *   isLoading,
 *   error,
 *   updateLimit
 * } = useOrgSpending({
 *   orgId: 123,
 *   getSpendAction: await getOrgSpend(apiKey),
 *   getLimitAction: await getOrgSpendingLimit(apiKey),
 *   setLimitAction: await setOrgSpendingLimit(apiKey),
 * });
 *
 * // Display spending info
 * if (display) {
 *   return <SpendingProgress {...display} />;
 * }
 *
 * // Update limit
 * const { success } = await updateLimit(5000);
 */
export function useOrgSpending({
  orgId,
  getSpendAction,
  getLimitAction,
  setLimitAction,
  enablePolling = true,
  pollingInterval = SPEND_POLLING_INTERVAL,
}: UseOrgSpendingConfig): UseOrgSpendingResult {
  const [spend, setSpend] = React.useState<OrgSpend | null>(null);
  const [limit, setLimit] = React.useState<OrgSpendingLimitResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pollerRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentMonth = getCurrentMonth();

  // Fetch spend data
  const fetchSpend = React.useCallback(
    async (isBackground = false) => {
      if (!orgId) {
        return;
      }

      if (isBackground) {
        setIsRefreshing(true);
      }

      try {
        const result = await getSpendAction(orgId, currentMonth);

        if (isOrgSpendData(result)) {
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
          setError(
            err instanceof Error ? err.message : 'Failed to fetch organization spending data'
          );
        }
      } finally {
        if (isBackground) {
          setIsRefreshing(false);
        }
      }
    },
    [orgId, currentMonth, getSpendAction]
  );

  // Fetch limit data
  const fetchLimit = React.useCallback(async () => {
    if (!orgId) return;

    try {
      const result = await getLimitAction(orgId);

      if (isOrgSpendingLimitData(result)) {
        setLimit(result);
      } else if ('detail' in result) {
        // Limit fetch errors are less critical, just log
        console.warn('[useOrgSpending] Failed to fetch limit:', result.detail);
      }
    } catch (err) {
      console.warn('[useOrgSpending] Failed to fetch limit:', err);
    }
  }, [orgId, getLimitAction]);

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
    if (!enablePolling || !orgId) return;

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
  }, [enablePolling, orgId, pollingInterval, fetchSpend]);

  // Calculate display properties
  const display = React.useMemo((): SpendingDisplayProps | null => {
    if (!spend) return null;

    return calculateOrgSpendingDisplay(spend);
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
        const result = await setLimitAction(orgId, { monthlySpendingCap: newLimit });

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
          err instanceof Error ? err.message : 'Failed to update organization spending limit';
        return { success: false, error: errorMsg };
      }
    },
    [orgId, setLimitAction, fetchLimit, fetchSpend]
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
