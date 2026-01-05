/**
 * Plot Canvas Test Harness
 *
 * A minimal wrapper for testing PlotCanvas component directly,
 * without Zustand store dependencies. Used for:
 * - API-generated plot rendering correctness tests
 * - D3 SVG element verification
 * - Data visualization accuracy tests
 *
 * Unlike plotTileTestHarness.tsx (which tests tile UI/store interactions),
 * this harness focuses on pure rendering correctness with mocked data.
 */

import React, { useRef, useState, useCallback } from 'react';
import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import { PlotCanvas, PlotCanvasProps } from '../../../components/Common/Plot/PlotCanvas';
import type { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import type { DataTypeConfig, PlotConfig } from './configs';
import type { MockScaleOption } from './mockData';
import {
  createMockLogs,
  createMockFields,
  createDeterministicMockLogs,
} from './mockData';

// Re-export for convenience
export type ScaleOption = MockScaleOption;

// =============================================================================
// Types
// =============================================================================

export type PlotType = 'scatter' | 'line' | 'bar' | 'histogram';
export type ScaleType = 'linear' | 'log';

export interface PlotCanvasTestOptions {
  /** Log data to render */
  logs?: LogProps[];
  /** Field definitions */
  fields?: LogFieldsResponseProps;
  /** Plot configuration */
  plotConfig?: Partial<PlotConfig>;
  /** Data type configuration (for generating mock data) */
  dataTypeConfig?: DataTypeConfig;
  /** Scale option (for generating mock data) */
  scale?: ScaleOption;
  /** Initial X axis */
  xAxis?: string;
  /** Initial Y axis */
  yAxis?: string;
  /** Initial plot type */
  plotType?: 'Scatter Plot' | 'Bar Chart' | 'Histogram' | 'Line Chart';
  /** Group by field */
  groupBy?: string;
  /** Aggregate function */
  aggregate?: string;
  /** X scale type */
  scaleX?: ScaleType;
  /** Y scale type */
  scaleY?: ScaleType;
  /** Metric field */
  metric?: string;
  /** Bin count for histograms */
  binCount?: number;
  /** Show regression line */
  showRegression?: boolean;
  /** Color mapping JSON */
  colors?: string;
  /** Enable interactivity */
  interactive?: boolean;
  /** Enable zoom */
  zoomEnabled?: boolean;
  /** Sort order for bar charts */
  sortBars?: string;
  /** Container dimensions */
  containerDimensions?: { width: number; height: number };
  /**
   * Use deterministic data generation for precise position assertions.
   * When true, generates predictable values that can be verified against
   * expected pixel positions.
   */
  deterministic?: boolean;
}

export interface PlotCanvasTestResult extends RenderResult {
  /** Get the SVG container element */
  getSvg: () => SVGSVGElement | null;
  /** Get the plot data group element */
  getPlotDataGroup: () => SVGGElement | null;
  /** Get all scatter points */
  getScatterPoints: () => SVGCircleElement[];
  /** Get all bar rectangles */
  getBars: () => SVGRectElement[];
  /** Get all histogram bins */
  getHistogramBins: () => SVGRectElement[];
  /** Get the line path */
  getLinePath: () => SVGPathElement | null;
  /** Get X axis group */
  getXAxis: () => SVGGElement | null;
  /** Get Y axis group */
  getYAxis: () => SVGGElement | null;
  /** Get axis tick labels */
  getAxisTicks: (axis: 'x' | 'y') => string[];
  /** Get the regression line */
  getRegressionLine: () => SVGLineElement | null;
  /** Get the tooltip element */
  getTooltip: () => HTMLDivElement | null;
  /** Get legend element */
  getLegend: () => HTMLElement | null;
  /** Update props dynamically */
  updateProps: (props: Partial<PlotCanvasTestOptions>) => void;
  /** Wait for plot to render */
  waitForPlot: () => Promise<void>;
  /** Get current props */
  getProps: () => PlotCanvasTestOptions;
}

// =============================================================================
// Map internal plot types to PlotCanvas display types
// =============================================================================

function mapPlotType(
  type: string | undefined
): 'Scatter Plot' | 'Bar Chart' | 'Histogram' | 'Line Chart' {
  switch (type) {
    case 'scatter':
      return 'Scatter Plot';
    case 'bar':
      return 'Bar Chart';
    case 'histogram':
      return 'Histogram';
    case 'line':
      return 'Line Chart';
    default:
      return 'Scatter Plot';
  }
}

// =============================================================================
// Test Wrapper Component
// =============================================================================

interface PlotCanvasWrapperProps {
  initialOptions: PlotCanvasTestOptions;
  onPropsRef: React.MutableRefObject<{
    getProps: () => PlotCanvasTestOptions;
    updateProps: (props: Partial<PlotCanvasTestOptions>) => void;
  } | null>;
}

function PlotCanvasWrapper({
  initialOptions,
  onPropsRef,
}: PlotCanvasWrapperProps) {
  const [options, setOptions] = useState(initialOptions);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const updateProps = useCallback(
    (newProps: Partial<PlotCanvasTestOptions>) => {
      setOptions((prev) => ({ ...prev, ...newProps }));
    },
    []
  );

  // Expose methods via ref
  React.useEffect(() => {
    onPropsRef.current = {
      getProps: () => options,
      updateProps,
    };
  }, [options, updateProps, onPropsRef]);

  // Generate mock data if not provided
  const dataTypeConfigToUse = options.dataTypeConfig ?? {
    x_axis_type: 'float',
    y_axis_type: 'float',
    group_by_type: 'str',
  };
  const scaleToUse = options.scale ?? { name: 'small', count: 100, skip: false, timeout: 5000 };

  const logs =
    options.logs ??
    (options.deterministic
      ? (createDeterministicMockLogs(dataTypeConfigToUse, scaleToUse.count).logs as unknown as LogProps[])
      : (createMockLogs({
          dataTypeConfig: dataTypeConfigToUse,
          scale: scaleToUse,
          deterministic: false,
        }) as unknown as LogProps[]));

  const fields =
    options.fields ?? createMockFields(dataTypeConfigToUse);

  const { width = 800, height = 600 } = options.containerDimensions ?? {};

  return (
    <div
      data-testid="plot-canvas-container"
      style={{ width, height, position: 'relative' }}
    >
      <PlotCanvas
        logs={logs}
        fields={fields}
        plotType={
          options.plotType ?? mapPlotType(options.plotConfig?.type ?? 'scatter')
        }
        xAxis={options.xAxis ?? options.plotConfig?.x_axis ?? 'table1.x_value'}
        yAxis={options.yAxis ?? options.plotConfig?.y_axis ?? 'table1.y_value'}
        groupBy={options.groupBy ?? options.plotConfig?.group_by}
        aggregate={options.aggregate ?? options.plotConfig?.aggregate}
        scaleX={options.scaleX ?? options.plotConfig?.scale_x ?? 'linear'}
        scaleY={options.scaleY ?? options.plotConfig?.scale_y ?? 'linear'}
        metric={options.metric ?? 'sum'}
        binCount={options.binCount ?? options.plotConfig?.bin_count ?? 10}
        showRegression={
          (options.showRegression ?? options.plotConfig?.show_regression ?? false)
            ? 'true'
            : 'false'
        }
        colors={options.colors ?? null}
        interactive={options.interactive ?? true}
        zoomEnabled={options.zoomEnabled ?? false}
        sortBars={options.sortBars}
        svgRef={svgRef as React.RefObject<SVGSVGElement>}
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        settingsRef={settingsRef as React.RefObject<HTMLDivElement>}
      />
    </div>
  );
}

// =============================================================================
// Main Export: renderPlotCanvas
// =============================================================================

/**
 * Render PlotCanvas for testing
 *
 * @param options - Configuration options for the plot
 * @returns Test utilities for interacting with the rendered plot
 */
export function renderPlotCanvas(
  options: PlotCanvasTestOptions = {}
): PlotCanvasTestResult {
  const propsRef: React.MutableRefObject<{
    getProps: () => PlotCanvasTestOptions;
    updateProps: (props: Partial<PlotCanvasTestOptions>) => void;
  } | null> = { current: null };

  const renderResult = render(
    <PlotCanvasWrapper initialOptions={options} onPropsRef={propsRef} />,
  );

  // Helper to get SVG
  const getSvg = (): SVGSVGElement | null => {
    const container = renderResult.container.querySelector(
      '[data-testid="plot-canvas-container"]'
    );
    return container?.querySelector('svg') ?? null;
  };

  // Helper to get plot data group
  const getPlotDataGroup = (): SVGGElement | null => {
    const svg = getSvg();
    return svg?.querySelector('.plotData') ?? null;
  };

  // Helper to get scatter points
  const getScatterPoints = (): SVGCircleElement[] => {
    const plotData = getPlotDataGroup();
    if (!plotData) return [];
    return Array.from(plotData.querySelectorAll('circle.data-point'));
  };

  // Helper to get bar rectangles
  const getBars = (): SVGRectElement[] => {
    const plotData = getPlotDataGroup();
    if (!plotData) return [];
    return Array.from(plotData.querySelectorAll('rect.bar-item'));
  };

  // Helper to get histogram bins
  const getHistogramBins = (): SVGRectElement[] => {
    const plotData = getPlotDataGroup();
    if (!plotData) return [];
    return Array.from(plotData.querySelectorAll('rect.hist-item'));
  };

  // Helper to get line path
  const getLinePath = (): SVGPathElement | null => {
    const plotData = getPlotDataGroup();
    return plotData?.querySelector('path.line, path[data-line]') ?? null;
  };

  // Helper to get X axis
  const getXAxis = (): SVGGElement | null => {
    const svg = getSvg();
    return svg?.querySelector('.xAxis') ?? null;
  };

  // Helper to get Y axis
  const getYAxis = (): SVGGElement | null => {
    const svg = getSvg();
    return svg?.querySelector('.yAxis') ?? null;
  };

  // Helper to get axis tick labels
  const getAxisTicks = (axis: 'x' | 'y'): string[] => {
    const axisGroup = axis === 'x' ? getXAxis() : getYAxis();
    if (!axisGroup) return [];
    const ticks = axisGroup.querySelectorAll('.tick text');
    return Array.from(ticks).map((t) => t.textContent ?? '');
  };

  // Helper to get regression line
  const getRegressionLine = (): SVGLineElement | null => {
    const plotData = getPlotDataGroup();
    return (
      plotData?.querySelector('line.regression, line[data-regression]') ?? null
    );
  };

  // Helper to get tooltip
  const getTooltip = (): HTMLDivElement | null => {
    const container = renderResult.container.querySelector(
      '[data-testid="plot-canvas-container"]'
    );
    return container?.querySelector('.plotTooltip') as HTMLDivElement | null;
  };

  // Helper to get legend
  const getLegend = (): HTMLElement | null => {
    const container = renderResult.container.querySelector(
      '[data-testid="plot-canvas-container"]'
    );
    return container?.querySelector('.legend, [data-testid="legend"]') ?? null;
  };

  // Wait for plot to render (D3 updates are async)
  // Increased timeout for browser tests where ResizeObserver may be slower
  const waitForPlot = async (): Promise<void> => {
    await waitFor(
      () => {
        const svg = getSvg();
        const plotData = getPlotDataGroup();
        
        // Debug: log what we're seeing
        if (!plotData) {
          throw new Error('Plot not yet rendered: plotData group not found');
        }
        if (plotData.children.length === 0) {
          // Check if SVG exists and has dimensions
          const svgWidth = svg?.getAttribute('width') || svg?.clientWidth;
          const svgHeight = svg?.getAttribute('height') || svg?.clientHeight;
          throw new Error(`Plot not yet rendered: plotData is empty (svg: ${svgWidth}x${svgHeight})`);
        }
      },
      { timeout: 10000 }
    );
    
    // Wait for D3 transitions to complete (histograms animate height over 500ms)
    // Add buffer time for transition completion
    await new Promise(resolve => setTimeout(resolve, 600));
  };

  return {
    ...renderResult,
    getSvg,
    getPlotDataGroup,
    getScatterPoints,
    getBars,
    getHistogramBins,
    getLinePath,
    getXAxis,
    getYAxis,
    getAxisTicks,
    getRegressionLine,
    getTooltip,
    getLegend,
    updateProps: (props) => propsRef.current?.updateProps(props),
    waitForPlot,
    getProps: () => propsRef.current?.getProps() ?? options,
  };
}

// =============================================================================
// Additional Utilities
// =============================================================================

export interface PlotTestSetupOptions {
  /** Use deterministic data for precise position assertions */
  deterministic?: boolean;
  /** Include null values in data */
  includeNulls?: boolean;
  /** Include edge cases in data */
  includeEdgeCases?: boolean;
}

/**
 * Create a standard test setup for a plot type
 */
export function createPlotTestSetup(
  plotConfig: PlotConfig,
  dataTypeConfig: DataTypeConfig,
  scale: ScaleOption,
  options: PlotTestSetupOptions = {}
): PlotCanvasTestOptions {
    
  return {
    plotConfig,
    dataTypeConfig,
    scale,
    plotType: mapPlotType(plotConfig.type),
    xAxis: plotConfig.x_axis,
    yAxis: plotConfig.y_axis,
    groupBy: plotConfig.group_by,
    aggregate: plotConfig.aggregate,
    scaleX: plotConfig.scale_x as ScaleType,
    scaleY: plotConfig.scale_y as ScaleType,
    binCount: plotConfig.bin_count,
    showRegression: plotConfig.show_regression,
    sortBars: plotConfig.sort_order ?? 'asc',
    deterministic: options.deterministic ?? false,
  };
}

/**
 * Assert that a scatter plot has the expected number of points
 */
export function assertScatterPointCount(
  result: PlotCanvasTestResult,
  expectedCount: number
) {
  const points = result.getScatterPoints();
  if (points.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} scatter points, got ${points.length}`
    );
  }
}

/**
 * Assert that a bar chart has the expected number of bars
 */
export function assertBarCount(
  result: PlotCanvasTestResult,
  expectedCount: number
) {
  const bars = result.getBars();
  if (bars.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} bars, got ${bars.length}`);
  }
}

/**
 * Assert that a histogram has the expected number of bins
 */
export function assertHistogramBinCount(
  result: PlotCanvasTestResult,
  expectedBinCount: number
) {
  const bins = result.getHistogramBins();
  if (bins.length !== expectedBinCount) {
    throw new Error(
      `Expected ${expectedBinCount} histogram bins, got ${bins.length}`
    );
  }
}

/**
 * Assert that axes are properly rendered
 */
export function assertAxesRendered(result: PlotCanvasTestResult) {
  const xAxis = result.getXAxis();
  const yAxis = result.getYAxis();

  if (!xAxis) {
    throw new Error('X axis not rendered');
  }
  if (!yAxis) {
    throw new Error('Y axis not rendered');
  }
}