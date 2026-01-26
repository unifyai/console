/**
 * PlotViewer - Standalone plot viewer for shareable links
 *
 * This component renders a full-page plot viewer with header and footer.
 * Uses the shared PlotCanvas component for the actual plot rendering.
 *
 * Used by: /plot/view/[token] page
 */

'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { PlotCanvas } from '@/components/Common/Plot/PlotCanvas';
import { DataLabel, GroupedDataLabel } from '@/types/interfaces/plot';
import { PlotFooter, PlotDetailsDrawer, usePlotDetails } from '@/components/Common/Plot/PlotFooter';

/**
 * Plot configuration from the API
 */
interface PlotViewerConfig {
  type: string;
  xAxis: string;
  yAxis?: string;
  groupBy?: string;
  aggregate?: string;
  scaleX?: string;
  scaleY?: string;
  metric?: string;
  binCount?: number;
  showRegression?: boolean;
  dimensions?: { width: number; height: number };
  margins?: { top: number; right: number; bottom: number; left: number };
  primaryColor?: string;
  colors?: Record<string, string>;
  // Bar chart sorting
  sortOrder?: string; // 'asc', 'desc', or undefined
  // Axis customization - xLabel/yLabel apply to both axis and tooltip
  xLabel?: string;
  yLabel?: string;
  showXLabel?: boolean;
  showYLabel?: boolean;
  xTickFormat?: string;
  yTickFormat?: string;
  // Group by and aggregate labels
  groupByLabel?: string;
  aggregateLabel?: string;
}

/**
 * Props for PlotViewer
 */
interface PlotViewerProps {
  config: PlotViewerConfig;
  data: LogProps[];
  fields: LogFieldsResponseProps;
  title?: string;
  /** Pre-aggregated bar chart data from backend (optional) */
  preAggregatedBarData?: DataLabel[] | GroupedDataLabel[];
}

/**
 * Map short type to full plot type name expected by drawPlot
 */
const PLOT_TYPE_MAP: Record<string, string> = {
  scatter: 'Scatter Plot',
  bar: 'Bar Chart',
  histogram: 'Histogram',
  line: 'Line Chart',
};

/**
 * Strip table prefix from field name for display (e.g., "table1.latency_ms" -> "latency_ms")
 */
function formatFieldName(field?: string): string {
  if (!field) return '';
  // Remove "table1." or any "tableN." prefix
  return field.replace(/^table\d+\./, '');
}

/**
 * Generate a title from plot configuration when no explicit title is provided
 */
function generateTitle(config: PlotViewerConfig): string {
  const xAxis = formatFieldName(config.xAxis);
  const yAxis = formatFieldName(config.yAxis);
  const groupBy = formatFieldName(config.groupBy);

  switch (config.type) {
    case 'scatter':
      if (yAxis && xAxis) {
        return groupBy ? `${yAxis} vs ${xAxis} (by ${groupBy})` : `${yAxis} vs ${xAxis}`;
      }
      return `Scatter Plot: ${xAxis}`;

    case 'bar':
      if (yAxis && xAxis) {
        return groupBy ? `${yAxis} by ${xAxis} (grouped by ${groupBy})` : `${yAxis} by ${xAxis}`;
      }
      return `Bar Chart: ${xAxis}`;

    case 'histogram':
      return groupBy ? `Distribution of ${xAxis} (by ${groupBy})` : `Distribution of ${xAxis}`;

    case 'line':
      if (yAxis && xAxis) {
        return groupBy ? `${yAxis} over ${xAxis} (by ${groupBy})` : `${yAxis} over ${xAxis}`;
      }
      return `Line Chart: ${xAxis}`;

    default:
      return yAxis ? `${yAxis} vs ${xAxis}` : xAxis;
  }
}

/**
 * PlotViewer Component
 *
 * Wraps PlotCanvas with a header, footer, and page-level layout.
 * Manages state for interactive plot configuration changes.
 */
export function PlotViewer({ config, data, fields, title, preAggregatedBarData }: PlotViewerProps) {
  // State for user-adjustable plot settings
  const [scaleX, setScaleX] = useState(config.scaleX || 'linear');
  const [scaleY, setScaleY] = useState(config.scaleY || 'linear');
  const [binCount, setBinCount] = useState(config.binCount || 10);
  const [logScaleXEnabled, setLogScaleXEnabled] = useState(true);
  const [logScaleYEnabled, setLogScaleYEnabled] = useState(true);

  // Zoom state
  const [zoomEnabled, setZoomEnabled] = useState(true);

  // Map short type to full name
  const plotType = PLOT_TYPE_MAP[config.type] || 'Scatter Plot';

  // Serialize colors for PlotCanvas
  const colorsJson = config.colors ? JSON.stringify(config.colors) : null;

  // Use provided title or generate one from config
  const displayTitle = useMemo(() => title || generateTitle(config), [title, config]);

  // Create tick formatter functions from format strings
  const xTickFormatter = useMemo(() => {
    if (!config.xTickFormat) return undefined;
    const format = config.xTickFormat;
    return (value: unknown) => {
      if (format === '$') return `$${Number(value).toLocaleString()}`;
      if (format === '%') return `${Number(value)}%`;
      return `${format}${value}`;
    };
  }, [config.xTickFormat]);

  const yTickFormatter = useMemo(() => {
    if (!config.yTickFormat) return undefined;
    const format = config.yTickFormat;
    return (value: unknown) => {
      if (format === '$') return `$${Number(value).toLocaleString()}`;
      if (format === '%') return `${Number(value)}%`;
      return `${format}${value}`;
    };
  }, [config.yTickFormat]);

  // Plot details state (for footer and drawer)
  const plotDetails = usePlotDetails({
    xAxis: config.xAxis,
    xLabel: config.xLabel,
    xScale: scaleX,
    yAxis: config.yAxis,
    yLabel: config.yLabel,
    yScale: scaleY,
    metric: config.metric,
    groupBy: config.groupBy,
    groupByLabel: config.groupByLabel,
  });

  // Container ref for drawer positioning
  const containerRef = useRef<HTMLDivElement>(null);

  // Destructure stable callbacks from plotDetails to satisfy ESLint
  const { setGroups, addPinnedDatapoint, openDrawer, isDrawerOpen } = plotDetails;

  // Groups are now set directly via the onGroupsChange callback from PlotCanvas/D3
  // Memoize callbacks to prevent infinite re-render loops
  const handleGroupsChange = useCallback(
    (groups: Array<{ key: string; color: string }>) => {
      setGroups(groups.map((g) => ({ key: g.key, color: g.color })));
    },
    [setGroups]
  );

  const handleDatapointPin = useCallback(
    (datapoint: {
      id: string;
      x: { label: string; value: string | number };
      y: { label: string; value: string | number };
      group?: { label: string; value: string };
    }) => {
      addPinnedDatapoint(datapoint);
      // Open drawer if not already open when pinning a datapoint
      if (!isDrawerOpen) {
        openDrawer();
      }
    },
    [addPinnedDatapoint, openDrawer, isDrawerOpen]
  );

  return (
    <div ref={containerRef} className="relative flex h-screen flex-col bg-background">
      {/* Header - compact styling */}
      <header className="flex-shrink-0 border-b border-border px-3 py-1.5">
        <h1 className="text-title">{displayTitle}</h1>
      </header>

      {/* Plot Container */}
      <div className="min-h-[400px] flex-1 overflow-hidden">
        <PlotCanvas
          logs={data}
          fields={fields}
          plotType={plotType}
          xAxis={config.xAxis}
          yAxis={config.yAxis}
          groupBy={config.groupBy}
          aggregate={config.aggregate}
          scaleX={scaleX}
          scaleY={scaleY}
          metric={config.metric || 'mean'}
          binCount={binCount}
          showRegression={config.showRegression ? 'true' : 'false'}
          colors={colorsJson}
          interactive={true}
          zoomEnabled={zoomEnabled}
          onScaleXChange={setScaleX}
          onScaleYChange={setScaleY}
          onBinCountChange={setBinCount}
          onLogScaleXEnabledChange={setLogScaleXEnabled}
          onLogScaleYEnabledChange={setLogScaleYEnabled}
          margins={config.margins || { top: 0, right: 15, bottom: 45, left: 55 }}
          preAggregatedBarData={preAggregatedBarData}
          // Bar chart sorting
          sortBars={config.sortOrder}
          // Axis customization - xLabel/yLabel apply to both axis and tooltip
          showXAxisLabel={config.showXLabel}
          showYAxisLabel={config.showYLabel}
          xAxisLabel={config.xLabel}
          yAxisLabel={config.yLabel}
          xTickFormatter={xTickFormatter}
          yTickFormatter={yTickFormatter}
          // Group by and aggregate labels
          groupByLabel={config.groupByLabel}
          aggregateLabel={config.aggregateLabel}
          // Hide settings overlay - using drawer instead
          hideSettingsOverlay={true}
          // Callbacks for external drawer (memoized to prevent re-render loops)
          onGroupsChange={handleGroupsChange}
          onDatapointPin={handleDatapointPin}
          // Highlight target for bidirectional hover highlighting
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

      {/* Details Drawer - slides up from footer */}
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

export default PlotViewer;
