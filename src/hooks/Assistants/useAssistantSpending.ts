/**
 * React hook for managing assistant spending data and limits.
 *
 * Provides:
 * - Current month's cumulative spend
 * - Spending limit configuration
 * - Actions to update limits
 * - Loading and error states
 *
 * Uses polling to keep spend data fresh (updates every 60 seconds).
 */

import * as React from 'react';
import {
  AssistantSpend,
  SpendingLimitResponse,
  SpendingLimitRequest,
  SpendingDisplayProps,
  isSpendingData,
  isSpendingLimitData,
  calculateSpendingDisplay,
  getCurrentMonth,
} from '@/types/assistants/spending';
import { ResponseProps } from '@/types/common';
import { fetchAssistantSpend, fetchAssistantSpendingLimit } from '@/lib/client/spending';

/** Polling interval for spend updates (60 seconds) */
const SPEND_POLLING_INTERVAL = 60000;

/** Type for the setLimit action function */
type SetLimitAction = (
  assistantId: string,
  payload: SpendingLimitRequest
) => Promise<(SpendingLimitResponse & ResponseProps) | ResponseProps>;

/** Hook configuration */
interface UseAssistantSpendingConfig {
  /** Assistant ID to fetch spending data for */
  assistantId: string;
  /** Server action to set spending limit */
  setLimitAction: SetLimitAction;
  /** Whether to enable automatic polling (default: true) */
  enablePolling?: boolean;
  /** Custom polling interval in ms (default: 60000) */
  pollingInterval?: number;
}

/** Hook return value */
interface UseAssistantSpendingResult {
  /** Current month's spend data */
  spend: AssistantSpend | null;
  /** Spending limit configuration */
  limit: SpendingLimitResponse | null;
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
 * Hook for managing assistant spending data.
 *
 * @example
 * const {
 *   spend,
 *   limit,
 *   display,
 *   isLoading,
 *   error,
 *   updateLimit
 * } = useAssistantSpending({
 *   assistantId: '123',
 *   getSpendAction: await getAssistantSpend(apiKey),
 *   getLimitAction: await getAssistantSpendingLimit(apiKey),
 *   setLimitAction: await setAssistantSpendingLimit(apiKey),
 * });
 *
 * // Display spending info
 * if (display) {
 *   return <SpendingProgress {...display} />;
 * }
 *
 * // Update limit
 * const { success } = await updateLimit(100);
 */
export function useAssistantSpending({
  assistantId,
  setLimitAction,
  enablePolling = true,
  pollingInterval = SPEND_POLLING_INTERVAL,
}: UseAssistantSpendingConfig): UseAssistantSpendingResult {
  const [spend, setSpend] = React.useState<AssistantSpend | null>(null);
  const [limit, setLimit] = React.useState<SpendingLimitResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pollerRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentMonth = getCurrentMonth();

  // Fetch spend data
  const fetchSpend = React.useCallback(
    async (isBackground = false) => {
      if (!assistantId) return;

      if (isBackground) {
        setIsRefreshing(true);
      }

      try {
        const result = await fetchAssistantSpend(assistantId, currentMonth);

        if (isSpendingData(result)) {
          setSpend(result);
          setError(null);
        } else if ('detail' in result) {
          if (!isBackground) {
            setSpend(null);
            setError(result.detail as string);
          }
        }
      } catch (err) {
        if (!isBackground) {
          setSpend(null);
          setError(err instanceof Error ? err.message : 'Failed to fetch spending data');
        }
      } finally {
        if (isBackground) {
          setIsRefreshing(false);
        }
      }
    },
    [assistantId, currentMonth]
  );

  // Fetch limit data
  const fetchLimit = React.useCallback(async () => {
    if (!assistantId) return;

    try {
      const result = await fetchAssistantSpendingLimit(assistantId);

      if (isSpendingLimitData(result)) {
        setLimit(result);
      } else if ('detail' in result) {
        // Limit fetch errors are less critical, just log
        console.warn('[useAssistantSpending] Failed to fetch limit:', result.detail);
      }
    } catch (err) {
      console.warn('[useAssistantSpending] Failed to fetch limit:', err);
    }
  }, [assistantId]);

  // Reset state when assistantId changes
  React.useEffect(() => {
    setSpend(null);
    setLimit(null);
    setError(null);
  }, [assistantId]);

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
    if (!enablePolling || !assistantId) return;

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
  }, [enablePolling, assistantId, pollingInterval, fetchSpend]);

  // Calculate display properties
  const display = React.useMemo((): SpendingDisplayProps | null => {
    if (!spend) return null;

    return calculateSpendingDisplay(spend);
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
        const result = await setLimitAction(assistantId, { monthlySpendingCap: newLimit });

        if ('detail' in result && !('info' in result)) {
          return { success: false, error: result.detail as string };
        }

        // Refresh limit data after successful update
        await fetchLimit();

        // Also refresh spend to get updated percentUsed
        await fetchSpend(false);

        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update spending limit';
        return { success: false, error: errorMsg };
      }
    },
    [assistantId, setLimitAction, fetchLimit, fetchSpend]
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
