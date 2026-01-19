'use client';

/**
 * UsageChart Component
 *
 * Bar chart wrapper for displaying usage data over time.
 * Wraps PlotCanvas with usage-specific configuration.
 * Includes PlotFooter and PlotDetailsDrawer for axes info.
 */

import * as React from 'react';
import { PlotCanvas } from '@/components/Common/Plot/PlotCanvas';
import { PlotFooter } from '@/components/Common/Plot/PlotFooter/PlotFooter';
import { PlotDetailsDrawer } from '@/components/Common/Plot/PlotFooter/PlotDetailsDrawer';
import { usePlotDetails } from '@/hooks/Interfaces/Plot/usePlotDetails';
import { UsageDataPoint, TimeGranularity } from '@/types/usage';
import { useUsageChartConfig } from '@/hooks/Usage/useUsageChartConfig';
import { BarChart3 } from 'lucide-react';

interface UsageChartProps {
  /** Usage data points to display */
  data: UsageDataPoint[];
  /** Time granularity for axis formatting */
  granularity: TimeGranularity;
  /** Whether data is loading */
  isLoading?: boolean;
}

/**
 * Empty state component when there's no data
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="bg-muted/20 flex h-full min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border"
      data-testid="usage-chart-empty"
    >
      <BarChart3 className="text-muted-foreground/50 mb-4 h-12 w-12" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Loading state component
 */
function LoadingState() {
  return (
    <div
      className="bg-muted/10 flex h-full min-h-[200px] items-center justify-center rounded-lg border border-border"
      data-testid="usage-chart-loading"
    >
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-2 text-sm text-muted-foreground">Loading usage data...</p>
      </div>
    </div>
  );
}

export function UsageChart({ data, granularity, isLoading = false }: UsageChartProps) {
  const { barData, fields, config, xTickFormatter, yTickFormatter } = useUsageChartConfig({
    data,
    granularity,
  });

  // Plot details state for footer and drawer
  const plotDetails = usePlotDetails({
    xAxis: 'timestamp',
    xLabel: config.xAxisLabel,
    xScale: 'linear',
    yAxis: 'billed_cost',
    yLabel: config.yAxisLabel,
    yScale: 'linear',
    metric: 'sum',
  });

  // Destructure stable methods from plotDetails to use in callbacks
  const { setGroups, addPinnedDatapoint, openDrawer, isDrawerOpen } = plotDetails;

  // Memoize callbacks to prevent infinite re-render loops
  const handleGroupsChange = React.useCallback(
    (groups: Array<{ key: string; color: string }>) => {
      setGroups(groups.map((g) => ({ key: g.key, color: g.color })));
    },
    [setGroups]
  );

  const handleDatapointPin = React.useCallback(
    (datapoint: {
      id: string;
      x: { label: string; value: string | number };
      y: { label: string; value: string | number };
      group?: { label: string; value: string };
    }) => {
      addPinnedDatapoint(datapoint);
      if (!isDrawerOpen) {
        openDrawer();
      }
    },
    [addPinnedDatapoint, openDrawer, isDrawerOpen]
  );

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-full" data-testid="usage-chart">
        <LoadingState />
      </div>
    );
  }

  // Show empty state when no data
  if (!config.showChart) {
    return (
      <div className="h-full" data-testid="usage-chart">
        <EmptyState message={config.emptyMessage || 'No data available'} />
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-border bg-card"
      data-testid="usage-chart"
    >
      {/* Chart - fills remaining space, no axis labels */}
      <div className="min-h-0 flex-1">
        <PlotCanvas
          logs={[]}
          fields={fields}
          plotType="Bar Chart"
          xAxis="timestamp"
          yAxis="billed_cost"
          aggregate="sum"
          scaleX="linear"
          scaleY="linear"
          metric="sum"
          binCount={10}
          showRegression="false"
          interactive={true}
          zoomEnabled={false}
          preAggregatedBarData={barData}
          showXAxisLabel={false}
          showYAxisLabel={false}
          xAxisLabel={config.xAxisLabel}
          yAxisLabel="Billed Cost"
          aggregateLabel=""
          xTickFormatter={xTickFormatter}
          yTickFormatter={yTickFormatter}
          hideSettingsOverlay={true}
          onGroupsChange={handleGroupsChange}
          onDatapointPin={handleDatapointPin}
          highlightTarget={plotDetails.highlightTarget}
        />
      </div>

      {/* Footer - compact with counts, toggles drawer */}
      <PlotFooter
        groupCount={plotDetails.groupCount}
        pinnedCount={plotDetails.pinnedCount}
        isOpen={plotDetails.isDrawerOpen}
        onToggle={plotDetails.toggleDrawer}
      />

      {/* Details Drawer - slides up from footer with axes info */}
      <PlotDetailsDrawer
        isOpen={plotDetails.isDrawerOpen}
        groups={plotDetails.groups}
        pinnedDatapoints={plotDetails.pinnedDatapoints}
        axesInfo={plotDetails.axesInfo}
        onUnpinDatapoint={plotDetails.removePinnedDatapoint}
        onHighlight={plotDetails.setHighlightTarget}
      />
    </div>
  );
}

export default UsageChart;
