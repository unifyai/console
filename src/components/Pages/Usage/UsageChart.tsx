'use client';

import * as React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { UsageDataPoint, TimeGranularity } from '@/types/usage';
import { formatTimestampForDisplay } from '@/utils/usage/dateUtils';
import { formatCostAxis, formatCostForDisplay } from '@/utils/usage/formatters';
import { BarChart3 } from 'lucide-react';

interface UsageChartProps {
  data: UsageDataPoint[];
  granularity: TimeGranularity;
  isLoading?: boolean;
}

interface ChartColors {
  bar: string;
  grid: string;
  border: string;
  tickText: string;
  cursorFill: string;
}

const FALLBACK_COLORS: ChartColors = {
  bar: 'var(--role-green-deep)',
  grid: 'var(--chart-grid)',
  border: 'var(--rule)',
  tickText: 'var(--muted-ink)',
  cursorFill: 'color-mix(in srgb, var(--rule) 30%, transparent)',
};

function useChartColors(): ChartColors {
  const [colors, setColors] = React.useState<ChartColors>(FALLBACK_COLORS);

  React.useEffect(() => {
    const resolve = () => {
      const s = getComputedStyle(document.documentElement);
      const get = (v: string) => s.getPropertyValue(v).trim();

      const primary = get('--primary') || get('--role-green-deep');
      const border = get('--border') || get('--rule');
      const muted = get('--muted') || border;
      const mutedFg = get('--muted-foreground') || get('--muted-ink');
      const chartGrid = get('--chart-grid') || border;

      setColors({
        bar: primary || FALLBACK_COLORS.bar,
        grid: chartGrid || FALLBACK_COLORS.grid,
        border: border || FALLBACK_COLORS.border,
        tickText: mutedFg || FALLBACK_COLORS.tickText,
        cursorFill: muted
          ? `color-mix(in srgb, ${muted} 30%, transparent)`
          : FALLBACK_COLORS.cursorFill,
      });
    };

    resolve();

    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-lg border border-border bg-card"
      data-testid="usage-chart-empty"
    >
      <BarChart3 className="text-muted-foreground/50 mb-4 h-12 w-12" />
      <p className="text-body-muted">{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-border bg-card"
      data-testid="usage-chart-loading"
    >
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-body-muted mt-2">Loading usage data...</p>
      </div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  granularity,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  granularity: TimeGranularity;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-caption">{formatTimestampForDisplay(String(label), granularity)}</p>
      <p className="text-title text-card-foreground">{formatCostForDisplay(payload[0].value)}</p>
    </div>
  );
}

export function UsageChart({ data, granularity, isLoading = false }: UsageChartProps) {
  const colors = useChartColors();

  if (isLoading) {
    return (
      <div className="h-full" data-testid="usage-chart">
        <LoadingState />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-full" data-testid="usage-chart">
        <EmptyState message="No usage data for the selected period" />
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-border bg-card [&_*]:outline-none"
      data-testid="usage-chart"
    >
      <div className="min-h-0 flex-1 p-2 sm:p-4 sm:pb-2 sm:pr-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={colors.grid}
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(v: string) => formatTimestampForDisplay(v, granularity)}
              tick={{ fontSize: 11, fill: colors.tickText }}
              axisLine={{ stroke: colors.border }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => formatCostAxis(v)}
              tick={{ fontSize: 11, fill: colors.tickText }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip
              content={<CustomTooltip granularity={granularity} />}
              cursor={{ fill: colors.cursorFill }}
            />
            <Bar dataKey="billedCost" fill={colors.bar} radius={[3, 3, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default UsageChart;
