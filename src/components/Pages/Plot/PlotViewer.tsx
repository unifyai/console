/**
 * PlotViewer - Standalone plot viewer for shareable links
 *
 * This component renders a full-page plot viewer with header and footer.
 * Uses the shared PlotCanvas component for the actual plot rendering.
 *
 * Used by: /plot/view/[token] page
 */

"use client";

import { useState, useMemo } from "react";
import { LogProps, LogFieldsResponseProps } from "@/types/interfaces/logs";
import { PlotCanvas } from "@/components/Common/Plot/PlotCanvas";

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
}

/**
 * Props for PlotViewer
 */
interface PlotViewerProps {
  config: PlotViewerConfig;
  data: LogProps[];
  fields: LogFieldsResponseProps;
  title?: string;
}

/**
 * Map short type to full plot type name expected by drawPlot
 */
const PLOT_TYPE_MAP: Record<string, string> = {
  scatter: "Scatter Plot",
  bar: "Bar Chart",
  histogram: "Histogram",
  line: "Line Chart",
};

/**
 * Strip table prefix from field name for display (e.g., "table1.latency_ms" -> "latency_ms")
 */
function formatFieldName(field?: string): string {
  if (!field) return "";
  // Remove "table1." or any "tableN." prefix
  return field.replace(/^table\d+\./, "");
}

/**
 * Generate a title from plot configuration when no explicit title is provided
 */
function generateTitle(config: PlotViewerConfig): string {
  const xAxis = formatFieldName(config.xAxis);
  const yAxis = formatFieldName(config.yAxis);
  const groupBy = formatFieldName(config.groupBy);

  switch (config.type) {
    case "scatter":
      if (yAxis && xAxis) {
        return groupBy 
          ? `${yAxis} vs ${xAxis} (by ${groupBy})`
          : `${yAxis} vs ${xAxis}`;
      }
      return `Scatter Plot: ${xAxis}`;

    case "bar":
      if (yAxis && xAxis) {
        return groupBy
          ? `${yAxis} by ${xAxis} (grouped by ${groupBy})`
          : `${yAxis} by ${xAxis}`;
      }
      return `Bar Chart: ${xAxis}`;

    case "histogram":
      return groupBy
        ? `Distribution of ${xAxis} (by ${groupBy})`
        : `Distribution of ${xAxis}`;

    case "line":
      if (yAxis && xAxis) {
        return groupBy
          ? `${yAxis} over ${xAxis} (by ${groupBy})`
          : `${yAxis} over ${xAxis}`;
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
export function PlotViewer({ config, data, fields, title }: PlotViewerProps) {
  // State for user-adjustable plot settings
  const [scaleX, setScaleX] = useState(config.scaleX || "linear");
  const [scaleY, setScaleY] = useState(config.scaleY || "linear");
  const [binCount, setBinCount] = useState(config.binCount || 10);
  const [logScaleXEnabled, setLogScaleXEnabled] = useState(true);
  const [logScaleYEnabled, setLogScaleYEnabled] = useState(true);

  // Zoom state
  const [zoomEnabled, setZoomEnabled] = useState(true);

  // Map short type to full name
  const plotType = PLOT_TYPE_MAP[config.type] || "Scatter Plot";

  // Serialize colors for PlotCanvas
  const colorsJson = config.colors ? JSON.stringify(config.colors) : null;

  // Use provided title or generate one from config
  const displayTitle = useMemo(
    () => title || generateTitle(config),
    [title, config]
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header - compact styling */}
      <header className="px-3 py-1.5 border-b border-border flex-shrink-0">
        <h1 className="text-sm font-medium text-foreground">{displayTitle}</h1>
      </header>

      {/* Plot Container */}
      <div className="flex-1 min-h-[400px] overflow-hidden">
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
          metric={config.metric || "mean"}
          binCount={binCount}
          showRegression={config.showRegression ? "true" : "false"}
          colors={colorsJson}
          interactive={true}
          zoomEnabled={zoomEnabled}
          onScaleXChange={setScaleX}
          onScaleYChange={setScaleY}
          onBinCountChange={setBinCount}
          onLogScaleXEnabledChange={setLogScaleXEnabled}
          onLogScaleYEnabledChange={setLogScaleYEnabled}
          margins={config.margins || { top: 0, right: 15, bottom: 45, left: 55 }}
        />
      </div>

      {/* Footer */}
      <footer className="px-4 py-2 text-xs text-muted-foreground border-t border-border flex-shrink-0 flex justify-between items-center">
        <span>Generated plot • View only</span>
        <button
          onClick={() => setZoomEnabled(!zoomEnabled)}
          className="text-xs hover:text-foreground transition-colors"
        >
          {zoomEnabled ? "🔍 Zoom enabled" : "🔍 Zoom disabled"}
        </button>
      </footer>
    </div>
  );
}

export default PlotViewer;
