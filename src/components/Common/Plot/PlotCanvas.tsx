/**
 * PlotCanvas - Shared plot rendering component
 *
 * Extracts the core D3 plot rendering logic shared between:
 * - PlotViewer.tsx (standalone viewer for shareable plots)
 * - Plot.tsx (interface tile in the console)
 *
 * This component handles:
 * - SVG structure and D3 integration
 * - drawPlot() orchestration
 * - Dimension tracking and responsive sizing
 * - Zoom and tooltip state
 *
 * Parent components control:
 * - Data (logs, fields)
 * - Configuration (plot type, axes, scales, etc.)
 * - Actions (callbacks for state changes)
 */

'use client';

import { useEffect, useRef, useId, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { drawPlot } from '@/utils/interfaces/plots/main';
import { clearFixedTooltip } from '@/utils/interfaces/plots/tooltip';
import { DataLabel, GroupedDataLabel } from '@/types/interfaces/plot';

/**
 * Props for the PlotCanvas component
 */
export interface PlotCanvasProps {
  // Data
  logs: LogProps[];
  fields: LogFieldsResponseProps;

  // Plot configuration
  plotType: string; // "Scatter Plot", "Bar Chart", "Histogram", "Line Chart"
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  aggregate?: string;
  scaleX: string;
  scaleY: string;
  metric: string;
  binCount: number;
  showRegression: string; // "true" | "false"
  colors?: string | null; // JSON string of color mapping

  // Behavior
  interactive?: boolean;
  zoomEnabled?: boolean;

  // Callbacks for state changes (optional - for controlled mode)
  onScaleXChange?: (scale: string) => void;
  onScaleYChange?: (scale: string) => void;
  onBinCountChange?: (count: number) => void;
  onLogScaleXEnabledChange?: (enabled: boolean) => void;
  onLogScaleYEnabledChange?: (enabled: boolean) => void;

  // Hover sync (optional)
  // Note: hoveredLog can be a log ID string (from interface tile) or LogProps object
  hoveredLog?: LogProps | string | null;
  onHoverLog?: ((log: LogProps | null) => void) | ((logId: string | undefined) => void);

  // Optional custom margins
  margins?: { top: number; right: number; bottom: number; left: number };

  // Optional sort for bar charts
  sortBars?: string;

  // Optional plot tile state for color mapping
  plotTileState?: { plotGroupByColors?: string | null } | null;

  // Optional external refs - allows parent to share refs with other components (e.g., PlotSettings)
  // If not provided, PlotCanvas creates its own internal refs
  svgRef?: React.RefObject<SVGSVGElement>;
  containerRef?: React.RefObject<HTMLDivElement>;
  settingsRef?: React.RefObject<HTMLDivElement>;

  // Optional pre-aggregated bar chart data from backend metrics endpoint
  // When provided, bar chart skips client-side aggregation for better performance
  preAggregatedBarData?: DataLabel[] | GroupedDataLabel[];
}

/**
 * Internal state interface for bin counts range
 */
interface BinCountRange {
  min: number;
  max: number;
}

/**
 * PlotCanvas Component
 *
 * Renders a D3-based plot within an SVG container.
 * Handles responsive sizing, zoom, and tooltip management.
 */
export function PlotCanvas({
  logs,
  fields,
  plotType,
  xAxis,
  yAxis,
  groupBy,
  aggregate,
  scaleX,
  scaleY,
  metric,
  binCount,
  showRegression,
  colors,
  interactive = true,
  zoomEnabled = false,
  onScaleXChange,
  onScaleYChange,
  onBinCountChange,
  onLogScaleXEnabledChange,
  onLogScaleYEnabledChange,
  hoveredLog,
  onHoverLog,
  margins: customMargins,
  sortBars,
  plotTileState,
  svgRef: externalSvgRef,
  containerRef: externalContainerRef,
  settingsRef: externalSettingsRef,
  preAggregatedBarData,
}: PlotCanvasProps) {
  // Internal refs (used when external refs not provided)
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const internalSvgRef = useRef<SVGSVGElement>(null);
  const internalSettingsRef = useRef<HTMLDivElement>(null);

  // Use external refs if provided, otherwise use internal refs
  const containerRef = externalContainerRef ?? internalContainerRef;
  const svgRef = externalSvgRef ?? internalSvgRef;
  const settingsRef = externalSettingsRef ?? internalSettingsRef;

  const zoomRef = useRef(d3.zoomIdentity);
  const clipId = useId();

  // Internal state
  const [binCounts, setBinCounts] = useState<number[]>([1, 100]);
  const [isTooltipMinimized, setIsTooltipMinimized] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Default margins
  const margins = useMemo(
    () => customMargins || { top: 0, right: 15, bottom: 45, left: 55 },
    [customMargins]
  );
  const axisPadding = 15;

  // Track dimensions responsively
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height: Math.max(300, height) });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach hover handlers to container (expected by plot-scatter.ts)
  useEffect(() => {
    if (!containerRef.current) return;
    (containerRef.current as any).__hoveredLog = hoveredLog ?? null;
    (containerRef.current as any).__setHoveredLog = onHoverLog ?? (() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredLog, onHoverLog]);

  // Reset zoom when plot configuration changes
  useEffect(() => {
    zoomRef.current = d3.zoomIdentity;
    if (settingsRef.current) {
      const settings = d3.select(settingsRef.current);
      clearFixedTooltip(settings as any, setIsTooltipMinimized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xAxis, yAxis, plotType]);

  // Create plot tile actions for drawPlot
  const plotTileActions = useMemo(
    () => ({
      setPlotScaleX: onScaleXChange ?? (() => {}),
      setPlotScaleY: onScaleYChange ?? (() => {}),
      setBinCount: (count: string) => onBinCountChange?.(parseInt(count, 10)),
    }),
    [onScaleXChange, onScaleYChange, onBinCountChange]
  );

  // Build the plot tile state with colors
  const effectivePlotTileState = useMemo(
    () =>
      plotTileState ?? {
        plotGroupByColors: colors ?? null,
      },
    [plotTileState, colors]
  );

  // Draw plot when dependencies change
  useEffect(() => {
    // Bar charts can render with pre-aggregated data OR raw logs
    const hasPreAggregatedData = preAggregatedBarData && preAggregatedBarData.length > 0;
    const hasRawLogsData = logs && logs.length > 0;

    if (!svgRef.current || !containerRef.current || (!hasRawLogsData && !hasPreAggregatedData)) {
      return;
    }

    const svg = d3.select(svgRef.current);
    const container = d3.select(containerRef.current);
    const settings = d3.select(settingsRef.current);
    const placeholder = svg.select('.placeholderText') as d3.Selection<
      SVGTextElement,
      unknown,
      null,
      undefined
    >;

    try {
      drawPlot(
        svg as any,
        container as any,
        settings,
        placeholder,
        dimensions,
        margins,
        axisPadding,
        plotType,
        logs,
        fields,
        xAxis,
        yAxis,
        groupBy,
        aggregate,
        scaleX,
        scaleY,
        metric,
        sortBars,
        binCount,
        binCounts,
        setBinCounts,
        showRegression,
        zoomRef,
        interactive,
        zoomEnabled,
        setIsTooltipMinimized,
        svgRef,
        containerRef,
        onLogScaleXEnabledChange ?? (() => {}),
        onLogScaleYEnabledChange ?? (() => {}),
        plotTileActions as any,
        effectivePlotTileState,
        preAggregatedBarData
      );
    } catch (err) {
      console.error('[PlotCanvas] drawPlot error:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    logs,
    fields,
    dimensions,
    margins,
    plotType,
    xAxis,
    yAxis,
    groupBy,
    aggregate,
    scaleX,
    scaleY,
    metric,
    sortBars,
    binCount,
    binCounts,
    showRegression,
    interactive,
    zoomEnabled,
    hoveredLog,
    plotTileActions,
    effectivePlotTileState,
    onLogScaleXEnabledChange,
    onLogScaleYEnabledChange,
    preAggregatedBarData,
  ]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-background">
      {/* SVG Plot Container */}
      <svg ref={svgRef} className="absolute left-0 top-0 z-0 h-full w-full">
        <defs>
          <clipPath id={clipId}>
            <rect id="clip-rect" />
          </clipPath>
        </defs>
        <rect className="zoom-layer" fill="transparent" />
        <g className="plotData" clipPath={`url(#${clipId})`} />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="placeholderText"
          stroke="var(--foreground)"
          strokeWidth="0.1"
          style={{ fill: 'var(--foreground)' }}
        />
        <line className="bottomLine" stroke="var(--foreground)" strokeWidth="0.5" />
        <line className="leftLine" stroke="var(--foreground)" strokeWidth="0.5" />
        <line
          className="x-zero"
          stroke="var(--foreground)"
          strokeWidth="1"
          strokeDasharray="5,5"
          style={{ opacity: 0 }}
        />
        <line
          className="y-zero"
          stroke="var(--foreground)"
          strokeWidth="1"
          strokeDasharray="5,5"
          style={{ opacity: 0 }}
        />
        <g className="xAxis" transform={`translate(0, ${dimensions.height - margins.bottom})`} />
        <g className="yAxis" transform={`translate(${margins.left}, 0)`} />
      </svg>

      {/* Hover Tooltip */}
      <div
        className="plotTooltip gap-2 overflow-hidden"
        style={{
          position: 'absolute',
          minWidth: '160px',
          maxWidth: '300px',
          pointerEvents: 'none',
          background: 'var(--background)',
          border: '1px solid var(--foreground)',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'opacity 0.2s',
          fontSize: '14px',
          opacity: 0,
          zIndex: 1000,
        }}
      />

      {/* Settings anchor point (used by drawPlot for grouping key) */}
      <div ref={settingsRef} className="absolute bottom-4 left-4" />
    </div>
  );
}

export default PlotCanvas;
