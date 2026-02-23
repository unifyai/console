/**
 * useUsageData Hook
 *
 * Orchestrates data fetching for usage metrics.
 * Uses server actions passed from the page (API key never exposed to client).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { UsageDataPoint, UsageMetricsResponse, TimeGranularity } from '@/types/usage';
import { UsageActions } from '@/lib/usage/actions';
import { isUsageError } from '@/lib/usage/api';
import { transformMetricsResponse } from '@/lib/usage/transforms';

/**
 * Generic error message shown to users.
 * Actual error details are logged to console for debugging.
 */
const GENERIC_ERROR_MESSAGE = 'Unable to load usage data. Please try again later.';

/**
 * Props for useUsageData hook
 */
export interface UseUsageDataProps {
  /** Bound server actions (API key captured in closure) */
  usageActions: UsageActions;
  /** Context path for the logs */
  contextPath: string;
  /** Time granularity for grouping */
  granularity: TimeGranularity;
  /** Filter expression for date range */
  filterExpression: string;
  /** Whether data fetching is enabled */
  enabled?: boolean;
}

/**
 * Return type for useUsageData hook
 */
export interface UseUsageDataReturn {
  /** Transformed usage data */
  data: UsageDataPoint[];
  /** Raw API response */
  rawData: UsageMetricsResponse | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refetch data */
  refetch: () => Promise<void>;
  /** Whether initial fetch has completed */
  hasInitiallyLoaded: boolean;
}

/**
 * Hook to fetch and transform usage data.
 *
 * @param props Hook props
 * @returns Usage data and loading/error states
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useUsageData({
 *   usageActions,
 *   contextPath: 'UserName/All/Events/LLM',
 *   granularity: 'time_day',
 *   filterExpression: "event_timestamp >= '2026-01-01'",
 *   enabled: true,
 * });
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error} />;
 * return <Chart data={data} />;
 * ```
 */
export function useUsageData({
  usageActions,
  contextPath,
  granularity,
  filterExpression,
  enabled = true,
}: UseUsageDataProps): UseUsageDataReturn {
  const [data, setData] = useState<UsageDataPoint[]>([]);
  const [rawData, setRawData] = useState<UsageMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Use ref to track mounted state and avoid memory leaks
  const mountedRef = useRef(true);

  // Track last successful fetch params to avoid duplicate fetches
  const lastFetchParamsRef = useRef<string | null>(null);

  /**
   * Fetch data from the API using the bound server action
   */
  const fetchData = useCallback(async () => {
    if (!enabled || !contextPath || !filterExpression) {
      return;
    }

    // Create a unique key for this fetch
    const fetchKey = `${contextPath}|${granularity}|${filterExpression}`;

    setIsLoading(true);
    setError(null);

    try {
      // Call the bound server action (API key is on server, not exposed)
      const result = await usageActions.getMetrics(contextPath, granularity, filterExpression);

      // Only update state if still mounted
      if (!mountedRef.current) return;

      if (isUsageError(result)) {
        // Log actual error for debugging, show generic message to user
        console.error('[useUsageData] API error:', result.detail);
        setError(GENERIC_ERROR_MESSAGE);
        setData([]);
        setRawData(null);
      } else {
        const transformed = transformMetricsResponse(result);
        setData(transformed);
        setRawData(result);
        setError(null);
        lastFetchParamsRef.current = fetchKey;
      }
    } catch (err) {
      if (!mountedRef.current) return;

      // Log actual error for debugging, show generic message to user
      console.error('[useUsageData] Fetch error:', err);
      setError(GENERIC_ERROR_MESSAGE);
      setData([]);
      setRawData(null);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setHasInitiallyLoaded(true);
      }
    }
  }, [usageActions, contextPath, granularity, filterExpression, enabled]);

  /**
   * Public refetch function
   */
  const refetch = useCallback(async () => {
    // Reset last fetch params to force a new fetch
    lastFetchParamsRef.current = null;
    await fetchData();
  }, [fetchData]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    rawData,
    isLoading,
    error,
    refetch,
    hasInitiallyLoaded,
  };
}

export default useUsageData;
