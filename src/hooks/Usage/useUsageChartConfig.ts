/**
 * useUsageChartConfig Hook
 *
 * Builds PlotCanvas configuration from usage data.
 * This hook transforms usage data into the format expected by the chart component.
 */

import { useMemo, useCallback } from 'react';
import {
  UsageDataPoint,
  UsageBarData,
  UsageChartConfig,
  TimeGranularity,
  GRANULARITY_LABELS,
} from '@/types/usage';
import { transformToBarData } from '@/lib/usage/transforms';
import { formatTimestampForDisplay } from '@/utils/usage/dateUtils';
import { formatCostForDisplay } from '@/utils/usage/formatters';
import { LogFieldsResponseProps } from '@/types/interfaces/logs';

/**
 * Props for useUsageChartConfig hook
 */
export interface UseUsageChartConfigProps {
  /** Usage data points */
  data: UsageDataPoint[];
  /** Current time granularity */
  granularity: TimeGranularity;
}

/**
 * Return type for useUsageChartConfig hook
 */
export interface UseUsageChartConfigReturn {
  /** Pre-aggregated bar data for PlotCanvas */
  barData: UsageBarData[];
  /** Mock fields object for PlotCanvas (required by the component) */
  fields: LogFieldsResponseProps;
  /** Chart configuration options */
  config: UsageChartConfig;
  /** X-axis tick formatter */
  xTickFormatter: (value: unknown) => string;
  /** Y-axis tick formatter */
  yTickFormatter: (value: unknown) => string;
}

/**
 * Hook to build chart configuration from usage data.
 *
 * @param props Hook props
 * @returns Chart configuration and formatted data
 *
 * @example
 * ```tsx
 * const { barData, fields, config, xTickFormatter, yTickFormatter } = useUsageChartConfig({
 *   data,
 *   granularity: 'time_day',
 * });
 *
 * return (
 *   <PlotCanvas
 *     logs={[]}
 *     fields={fields}
 *     plotType="Bar Chart"
 *     preAggregatedBarData={barData}
 *     xTickFormatter={xTickFormatter}
 *     yTickFormatter={yTickFormatter}
 *   />
 * );
 * ```
 */
export function useUsageChartConfig({
  data,
  granularity,
}: UseUsageChartConfigProps): UseUsageChartConfigReturn {
  /**
   * Transform data to bar chart format
   */
  const barData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    return transformToBarData(data);
  }, [data]);

  /**
   * Create mock fields object for PlotCanvas
   * PlotCanvas requires a fields object even when using pre-aggregated data
   */
  const fields = useMemo((): LogFieldsResponseProps => {
    return {
      timestamp: {
        dataType: 'datetime',
        fieldType: 'entry',
        artifacts: '',
        mutable: 'false',
        createdAt: new Date().toISOString(),
      },
      billed_cost: {
        dataType: 'float',
        fieldType: 'entry',
        artifacts: '',
        mutable: 'false',
        createdAt: new Date().toISOString(),
      },
    };
  }, []);

  /**
   * Chart configuration
   */
  const config = useMemo((): UsageChartConfig => {
    const hasData = data && data.length > 0;
    const granularityLabel = GRANULARITY_LABELS[granularity] || 'Time';

    return {
      xAxisLabel: granularityLabel,
      yAxisLabel: 'Billed Cost ($)',
      showChart: hasData,
      emptyMessage: hasData ? undefined : 'No usage data for the selected period',
    };
  }, [data, granularity]);

  /**
   * X-axis tick formatter - formats timestamps based on granularity
   */
  const xTickFormatter = useCallback(
    (value: unknown): string => {
      if (typeof value !== 'string') {
        return String(value);
      }
      return formatTimestampForDisplay(value, granularity);
    },
    [granularity]
  );

  /**
   * Y-axis tick formatter - formats cost values
   */
  const yTickFormatter = useCallback((value: unknown): string => {
    if (typeof value !== 'number') {
      return String(value);
    }
    return formatCostForDisplay(value);
  }, []);

  return {
    barData,
    fields,
    config,
    xTickFormatter,
    yTickFormatter,
  };
}

export default useUsageChartConfig;
