'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';

/**
 * Render mode for scatter plots based on data size
 * - 'svg': D3.js SVG rendering for ≤ svgMax points
 * - 'webgl': Three.js WebGL rendering for > svgMax and ≤ webglMax points
 * - 'webgl-sampled': Three.js WebGL with stratified sampling for > webglMax points
 */
export type RenderMode = 'svg' | 'webgl' | 'webgl-sampled';

/**
 * Context information about the current render pass
 */
export interface RenderContext {
  mode: RenderMode;
  originalCount: number;
  renderedCount: number;
  isSampled: boolean;
  isViewportCulled: boolean;
}

/**
 * Viewport bounds in data coordinates
 */
export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/**
 * Result from stratified sampling
 */
export interface SamplingResult {
  sampled: LogProps[];
  originalCount: number;
  sampledCount: number;
}

/**
 * Regression calculation result
 */
export interface RegressionResult {
  m: number; // slope
  b: number; // y-intercept
  r: number; // correlation coefficient
  groupKey?: string; // for grouped regressions
}

/**
 * Data point tuple for regression calculation
 */
export type DataPoint = [number, number];

/**
 * Common options passed to scatter plot rendering
 */
export interface ScatterPlotOptions {
  // D3 selections
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>;
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>;
  settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>;

  // Dimensions
  dimensions: { width: number; height: number };
  margins: { [key: string]: number };
  axisPadding: number;

  // Data
  logs: LogProps[];
  fields: LogFieldsResponseProps;
  xAxisProperty: string;
  yAxisProperty: string;
  xTable: string;
  yTable: string;
  xType: string | undefined;
  yType: string | undefined;

  // Scales
  scaleX: string;
  scaleY: string;

  // Grouping
  groupBy: string | undefined;
  aggregate: string | undefined;
  groupByColors: string;

  // Features
  showRegression: string;
  interactive: boolean;
  zoomEnabled: boolean;

  // Refs
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  zoomRef: React.MutableRefObject<d3.ZoomTransform>;
}

/**
 * Prepared data for rendering after filtering and processing
 */
export interface PreparedScatterData {
  data: LogProps[];
  xValues: number[];
  yValues: number[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  reverseX: boolean;
  reverseY: boolean;
  xDomain: [number, number];
  yDomain: [number, number];
}

/**
 * Scale context for rendering
 */
export interface ScaleContext {
  x: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
  y: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
  initialX: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
  initialY: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
  xRange: [number, number];
  yRange: [number, number];
  reverseX: boolean;
  reverseY: boolean;
}

/**
 * Color context for rendering
 */
export interface ColorContext {
  primary: string;
  colorScale: d3.ScaleOrdinal<string, string>;
  colorRange: readonly string[];
}

/**
 * Interface for scatter plot renderers (SVG and WebGL)
 */
export interface ScatterRenderer {
  /**
   * Render the scatter plot with the given data
   */
  render(
    data: LogProps[],
    options: ScatterPlotOptions,
    scaleContext: ScaleContext,
    colorContext: ColorContext,
    highlightIndex?: number
  ): void;

  /**
   * Find the index of the point at the given screen coordinates
   * Returns -1 if no point is found
   */
  findPointAt(clientX: number, clientY: number): number;

  /**
   * Resize the renderer to new dimensions
   */
  resize(width: number, height: number): void;

  /**
   * Clean up renderer resources
   */
  dispose(): void;

  /**
   * Get the current data being rendered
   */
  getData(): LogProps[];

  /**
   * Check if the renderer is currently active
   */
  isActive(): boolean;

  /**
   * Show or hide the renderer
   */
  setVisible(visible: boolean): void;
}
