/**
 * useUsageSummary Hook
 *
 * Pure logic hook that computes summary statistics from usage data.
 * This hook is intentionally simple and contains no side effects.
 */

import { useMemo } from 'react';
import { UsageDataPoint, UsageSummary, EMPTY_SUMMARY } from '@/types/usage';
import { calculateSummary } from '@/lib/usage/transforms';

/**
 * Props for useUsageSummary hook
 */
export interface UseUsageSummaryProps {
  /** Usage data points to summarize */
  data: UsageDataPoint[];
}

/**
 * Return type for useUsageSummary hook
 */
export interface UseUsageSummaryReturn {
  /** Computed summary statistics */
  summary: UsageSummary;
  /** Whether there is any data */
  hasData: boolean;
  /** Number of data points */
  dataPointCount: number;
}

/**
 * Hook to compute summary statistics from usage data.
 *
 * @param props Hook props containing the data to summarize
 * @returns Summary statistics and metadata
 *
 * @example
 * ```tsx
 * const { summary, hasData } = useUsageSummary({ data });
 *
 * if (!hasData) {
 *   return <EmptyState />;
 * }
 *
 * return (
 *   <>
 *     <Card label="Total" value={summary.total} />
 *     <Card label="Average" value={summary.average} />
 *     <Card label="Peak" value={summary.peak} />
 *   </>
 * );
 * ```
 */
export function useUsageSummary({ data }: UseUsageSummaryProps): UseUsageSummaryReturn {
  const summary = useMemo(() => {
    if (!data || data.length === 0) {
      return EMPTY_SUMMARY;
    }
    return calculateSummary(data);
  }, [data]);

  const hasData = useMemo(() => {
    return data && data.length > 0;
  }, [data]);

  const dataPointCount = useMemo(() => {
    return data?.length ?? 0;
  }, [data]);

  return {
    summary,
    hasData,
    dataPointCount,
  };
}

export default useUsageSummary;
