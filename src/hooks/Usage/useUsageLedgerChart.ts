/**
 * useUsageLedgerChart Hook
 *
 * Fetches time-bucketed spending data from the credit ledger for the chart.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { UsageDataPoint, UsageMetricsResponse, TimeGranularity } from '@/types/usage';
import { fetchSpendingTimeseries } from '@/lib/client/credits';
import { transformMetricsResponse } from '@/lib/usage/transforms';

const GENERIC_ERROR_MESSAGE = 'Unable to load usage data. Please try again later.';

export interface UseUsageLedgerChartProps {
  startDate: string;
  endDate: string;
  granularity: TimeGranularity;
  assistantId?: string;
  category?: string;
  userId?: string;
  enabled?: boolean;
}

export interface UseUsageLedgerChartReturn {
  data: UsageDataPoint[];
  rawData: UsageMetricsResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasInitiallyLoaded: boolean;
}

export function useUsageLedgerChart({
  startDate,
  endDate,
  granularity,
  assistantId,
  category,
  userId,
  enabled = true,
}: UseUsageLedgerChartProps): UseUsageLedgerChartReturn {
  const [data, setData] = useState<UsageDataPoint[]>([]);
  const [rawData, setRawData] = useState<UsageMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!enabled || !startDate || !endDate) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchSpendingTimeseries({
        startDate,
        endDate,
        groupBy: granularity,
        category,
        assistantId,
        userId,
      });

      if (!mountedRef.current) return;

      if ('detail' in result) {
        console.error('[useUsageLedgerChart] API error:', result.detail);
        setError(GENERIC_ERROR_MESSAGE);
        setData([]);
        setRawData(null);
      } else {
        const transformed = transformMetricsResponse(result);
        setData(transformed);
        setRawData(result);
        setError(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[useUsageLedgerChart] Fetch error:', err);
      setError(GENERIC_ERROR_MESSAGE);
      setData([]);
      setRawData(null);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setHasInitiallyLoaded(true);
      }
    }
  }, [startDate, endDate, granularity, assistantId, category, userId, enabled]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, rawData, isLoading, error, refetch, hasInitiallyLoaded };
}

export default useUsageLedgerChart;
