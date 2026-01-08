'use client';

/**
 * Scatter Plot Module
 *
 * Tiered rendering system for scatter plots:
 * - SVG (D3.js): ≤2,000 points - Rich interactivity, DOM-based
 * - WebGL (Three.js): 2K-1M points - GPU-accelerated rendering
 * - WebGL + Sampling: >1M points - Stratified sampling + GPU rendering
 *
 * All tiers support:
 * - Viewport culling for improved performance
 * - Hover tooltips with cross-plot synchronization
 * - Click for fixed tooltips with overlapping point detection
 * - Zoom/pan with regression line updates
 * - Grouping with color coding and legends
 */

// Main entry point
export { drawScatterPlot, determineRenderMode, sampleData } from './orchestrator';

// Configuration
export {
  getConfig,
  updateConfig,
  resetConfig,
  getDefaultConfig,
  type ScatterConfig,
} from './config';

// Types
export type {
  RenderMode,
  RenderContext,
  Viewport,
  SamplingResult,
  RegressionResult,
  DataPoint,
  ScatterPlotOptions,
  PreparedScatterData,
  ScaleContext,
  ColorContext,
  ScatterRenderer,
} from './types';

// Data processing utilities
export {
  buildQuadtree,
  getViewportFromScales,
  cullToViewport,
  findNearestPoint,
  stratifiedSample,
  findPointAtLinear,
  findAllPointsAtCoordinates,
  screenToData,
} from './data';

// Renderers
export { SVGScatterRenderer } from './renderers/svg-renderer';
export { WebGLScatterRenderer } from './renderers/webgl-renderer';

// Regression
export { calculateRegression, drawRegressionLines, updateRegressionHighlight } from './regression';

// Interactions
export { getTooltipData } from './interactions/hover';
