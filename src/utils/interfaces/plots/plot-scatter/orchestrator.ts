'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { getValue, hasProperty, inferDisplayType } from '../data';
import { drawAxes, generateTicks, reverseOrKeepDomain } from '../axes';
import { getPrimaryColorFromNode } from '../common';
import { renderGroupingKey } from '../key';
import {
  RenderMode,
  RenderContext,
  ScatterPlotOptions,
  ScaleContext,
  ColorContext,
  PreparedScatterData,
} from './types';
import { getConfig } from './config';
import { buildQuadtree, cullToViewport, getViewportFromScales, stratifiedSample } from './data';
import { SVGScatterRenderer } from './renderers/svg-renderer';
import { WebGLScatterRenderer } from './renderers/webgl-renderer';
import { drawRegressionLines } from './regression';
import {
  setupSVGHoverInteraction,
  setupWebGLHoverInteraction,
  setupSVGClickInteraction,
  setupWebGLClickInteraction,
  setupZoomBehavior,
  setupWebGLZoomBehavior,
  setupCrossPlotSync,
} from './interactions';

// Cache for WebGL renderer instances (keyed by container element)
const webglRendererCache = new WeakMap<HTMLElement, WebGLScatterRenderer>();

/**
 * Determine the render mode based on data size
 */
export function determineRenderMode(dataLength: number): RenderMode {
  const config = getConfig();

  if (dataLength <= config.SVG_MAX) {
    return 'svg';
  }
  if (dataLength <= config.WEBGL_MAX) {
    return 'webgl';
  }
  return 'webgl-sampled';
}

/**
 * Process data through the rendering pipeline:
 * 1. Filter valid data points
 * 2. Apply stratified sampling if needed (>1M points)
 * 3. Apply viewport culling if enabled
 */
function processData(
  logs: LogProps[],
  fields: LogFieldsResponseProps,
  xAxisProperty: string,
  yAxisProperty: string,
  xTable: string,
  yTable: string,
  groupBy: string | undefined,
  mode: RenderMode,
  xScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>,
  yScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>
): { data: LogProps[]; context: RenderContext } {
  const config = getConfig();

  // Step 1: Filter valid data points
  // Debug: Log first log structure and field check results
  if (logs.length > 0) {
    const sampleLog = logs[0];
    const hasX = hasProperty(fields, xAxisProperty, sampleLog, xTable);
    const hasY = hasProperty(fields, yAxisProperty, sampleLog, yTable);
    const hasGroup = groupBy ? hasProperty(fields, groupBy, sampleLog, xTable) : true;
  }

  let data = logs.filter((log) => {
    const hasGroup = groupBy ? hasProperty(fields, groupBy, log, xTable) : true;
    const hasX = hasProperty(fields, xAxisProperty, log, xTable);
    const hasY = hasProperty(fields, yAxisProperty, log, yTable);
    return hasGroup && hasX && hasY;
  });

  const originalCount = data.length;
  let isSampled = false;
  let isViewportCulled = false;

  // Step 2: Stratified sampling for very large datasets
  if (mode === 'webgl-sampled') {
    const result = stratifiedSample(
      data,
      config.SAMPLE_TARGET,
      fields,
      xAxisProperty,
      yAxisProperty,
      xTable,
      yTable
    );
    data = result.sampled;
    isSampled = true;
  }

  // Step 3: Viewport culling (if enabled)
  if (config.VIEWPORT_CULLING && data.length > 0) {
    const quadtree = buildQuadtree(data, fields, xAxisProperty, yAxisProperty, xTable, yTable);
    const viewport = getViewportFromScales(xScale, yScale);
    const culledData = cullToViewport(quadtree, viewport);
    isViewportCulled = culledData.length < data.length;
    data = culledData;
  }

  return {
    data,
    context: {
      mode,
      originalCount,
      renderedCount: data.length,
      isSampled,
      isViewportCulled,
    },
  };
}

/**
 * Prepare scale context from data
 */
function prepareScales(
  data: LogProps[],
  fields: LogFieldsResponseProps,
  xAxisProperty: string,
  yAxisProperty: string,
  xTable: string,
  yTable: string,
  scaleX: string,
  scaleY: string,
  dimensions: { width: number; height: number },
  margins: { [key: string]: number },
  axisPadding: number,
  zoomRef: React.MutableRefObject<d3.ZoomTransform>
): ScaleContext {
  const [width, height] = [dimensions.width, dimensions.height];

  const xValues = data.map((d) => getValue(fields, xAxisProperty, d, xTable) as number);
  const yValues = data.map((d) => getValue(fields, yAxisProperty, d, yTable) as number);

  const [[minX = 0, maxX = 0], [minY = 0, maxY = 0]] = [d3.extent(xValues), d3.extent(yValues)];

  const xScaleFn = scaleX === 'log' ? d3.scaleLog : d3.scaleLinear;
  const yScaleFn = scaleY === 'log' ? d3.scaleLog : d3.scaleLinear;

  const reverseX = scaleX === 'log' && xValues.every((v) => v < 0);
  const reverseY = scaleY === 'log' && yValues.every((v) => v < 0);

  const xDomain = reverseOrKeepDomain(xValues, [minX, maxX], reverseX);
  const yDomain = reverseOrKeepDomain(yValues, [minY, maxY], reverseY);

  const xRange: [number, number] = [
    margins.left + axisPadding,
    width - margins.right - axisPadding,
  ];
  const yRange: [number, number] = [
    height - margins.bottom - axisPadding,
    margins.top + axisPadding,
  ];

  const initialX = xScaleFn().domain(xDomain).range(xRange);
  const initialY = yScaleFn().domain(yDomain).range(yRange);

  const currentTransform = zoomRef.current;
  const x = currentTransform.rescaleX(initialX);
  const y = currentTransform.rescaleY(initialY);

  return {
    x,
    y,
    initialX,
    initialY,
    xRange,
    yRange,
    reverseX,
    reverseY,
  };
}

/**
 * Prepare color context
 */
function prepareColors(
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  data: LogProps[],
  fields: LogFieldsResponseProps,
  xTable: string,
  groupBy: string | undefined,
  groupByColors: string
): ColorContext {
  const primary = getPrimaryColorFromNode(svg.node());
  const colorRange = d3[groupByColors as keyof typeof d3] as readonly string[];
  const colorScale = d3.scaleOrdinal<string>().range(colorRange);

  if (groupBy) {
    let domain = data.map((d) => JSON.stringify(getValue(fields, groupBy, d, xTable)));
    domain = Array.from(new Set(domain));
    colorScale.domain(domain);
  }

  return {
    primary,
    colorScale,
    colorRange,
  };
}

/**
 * Update placeholder text with render context information
 */
function updatePlaceholder(
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  context: RenderContext,
  dimensions: { width: number; height: number },
  margins: { [key: string]: number }
): void {
  const placeholder = svg.select('.placeholderText');

  let message: string | null = null;

  if (context.isSampled) {
    const pct = ((context.renderedCount / context.originalCount) * 100).toFixed(1);
    message = `Showing ${context.renderedCount.toLocaleString()} of ${context.originalCount.toLocaleString()} points (${pct}% sample)`;
  } else if (context.isViewportCulled && context.renderedCount < context.originalCount) {
    message = `${context.renderedCount.toLocaleString()} points in view`;
  }

  if (message) {
    placeholder
      .text(message)
      .attr('text-anchor', 'start')
      .attr('x', margins.left + 10)
      .attr('y', dimensions.height - margins.bottom - 10)
      .attr('font-size', '10px')
      .attr('opacity', 0.6);
  } else {
    placeholder.text('');
  }
}

/**
 * Main scatter plot drawing function.
 * Orchestrates the rendering pipeline with automatic tier selection.
 */
export function drawScatterPlot(
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  settings: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  scaleX: string,
  scaleY: string,
  dimensions: { width: number; height: number },
  margins: { [key: string]: number },
  axisPadding: number,
  selectedXAxisProperty: string | undefined,
  selectedYAxisProperty: string | undefined,
  groupBy: string | undefined,
  aggregate: string | undefined,
  showRegression: string,
  xTable: string,
  yTable: string,
  logs: LogProps[],
  fields: LogFieldsResponseProps,
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
  zoomRef: React.MutableRefObject<d3.ZoomTransform>,
  groupByColors: string = 'schemeCategory10',
  interactive: boolean = true,
  zoomEnabled: boolean = false
): void {
  const g = svg.select('.plotData');
  const zoomContainer = svg.select('.zoom-layer');
  const tooltip = container.select<HTMLDivElement>('.plotTooltip').style('opacity', 0);

  // Remove elements from other plot types
  g.selectAll('path.line-item').remove();
  g.selectAll('rect.bar-item').remove();
  g.selectAll('rect.hist-item').remove();
  g.selectAll('text.correlation-group').remove();
  g.selectAll('text.correlation').remove();
  if (showRegression !== 'true') {
    g.selectAll('path.best-fit').remove();
  }

  // Get valid properties
  const properties = Object.entries(fields)
    .filter(
      ([, { data_type: dataType }]) =>
        dataType === 'float' ||
        dataType === 'int' ||
        dataType === 'timestamp' ||
        dataType === 'time' ||
        dataType === 'timedelta' ||
        dataType === 'date' ||
        dataType === 'bool' ||
        dataType === 'Any'
    )
    .map(([name]) => name);

  const xAxisProperty =
    selectedXAxisProperty && properties.includes(selectedXAxisProperty)
      ? selectedXAxisProperty
      : properties.at(0);
  const yAxisProperty =
    selectedYAxisProperty && properties.includes(selectedYAxisProperty)
      ? selectedYAxisProperty
      : properties.at(0);

  if (!xAxisProperty || !yAxisProperty) {
    return;
  }

  const xType = inferDisplayType(fields, xAxisProperty, logs, xTable);
  const yType = inferDisplayType(fields, yAxisProperty, logs, yTable);

  // Determine render mode based on data size
  const mode = determineRenderMode(logs.length);

  // Create temporary scale for initial viewport culling
  // Use all logs to ensure viewport includes full data extent
  const tempScaleContext = prepareScales(
    logs,
    fields,
    xAxisProperty,
    yAxisProperty,
    xTable,
    yTable,
    scaleX,
    scaleY,
    dimensions,
    margins,
    axisPadding,
    zoomRef
  );

  // Process data through pipeline
  const { data, context } = processData(
    logs,
    fields,
    xAxisProperty,
    yAxisProperty,
    xTable,
    yTable,
    groupBy,
    mode,
    tempScaleContext.x,
    tempScaleContext.y
  );

  if (data.length === 0) {
    // Clear and show empty state
    g.selectAll('circle.data-point').remove();
    g.selectAll('circle.hover-area').remove();
    return;
  }

  // Prepare final scales with actual data
  const scaleContext = prepareScales(
    data,
    fields,
    xAxisProperty,
    yAxisProperty,
    xTable,
    yTable,
    scaleX,
    scaleY,
    dimensions,
    margins,
    axisPadding,
    zoomRef
  );

  // Prepare colors
  const colorContext = prepareColors(svg, data, fields, xTable, groupBy, groupByColors);

  // Draw axes
  const [xTicks, yTicks] = [
    generateTicks(scaleContext.x.domain()[0], scaleContext.x.domain()[1], 10, scaleX === 'log'),
    generateTicks(scaleContext.y.domain()[0], scaleContext.y.domain()[1], 10, scaleY === 'log'),
  ];

  drawAxes(
    'Scatter Plot',
    svg,
    dimensions,
    margins,
    scaleContext.x,
    scaleContext.y,
    xTicks,
    yTicks,
    scaleContext.reverseX,
    scaleContext.reverseY,
    xAxisProperty,
    yAxisProperty,
    xType,
    yType
  );

  // Render grouping key legend
  if (groupBy) {
    let domain = data.map((d) => JSON.stringify(getValue(fields, groupBy, d, xTable)));
    domain = Array.from(new Set(domain));
    const colors = domain.map((key) => ({
      key: key,
      color: colorContext.colorScale(key) as string,
    }));
    renderGroupingKey(settings, colors);
  } else {
    renderGroupingKey(settings, null);
  }

  // Update placeholder
  updatePlaceholder(svg, context, dimensions, margins);

  // Create options object
  const options: ScatterPlotOptions = {
    container,
    svg,
    settings,
    dimensions,
    margins,
    axisPadding,
    logs,
    fields,
    xAxisProperty,
    yAxisProperty,
    xTable,
    yTable,
    xType,
    yType,
    scaleX,
    scaleY,
    groupBy,
    aggregate,
    groupByColors,
    showRegression,
    interactive,
    zoomEnabled,
    containerRef,
    zoomRef,
  };

  // Render based on mode
  const containerNode = container.node();

  if (mode === 'svg') {
    // Ensure pointer-events are enabled on zoom-layer for SVG mode
    zoomContainer.style('pointer-events', 'all');

    // Hide WebGL canvas if it exists
    if (containerNode) {
      const webglRenderer = webglRendererCache.get(containerNode);
      if (webglRenderer) {
        webglRenderer.setVisible(false);
      }
    }

    // Use SVG renderer
    const svgRenderer = new SVGScatterRenderer(svg);
    svgRenderer.render(data, options, scaleContext, colorContext);

    // Setup interactions
    setupSVGHoverInteraction(svgRenderer, data, options, tooltip, g);
    setupSVGClickInteraction(svgRenderer, data, options, g);

    // Setup zoom
    const zoom = setupZoomBehavior(svg, options, scaleContext, data, g, (newX, newY, transform) => {
      // On zoom, update point positions
      g.selectAll('circle.data-point')
        .transition('zoom')
        .attr('cx', (d: any) => {
          const val = getValue(fields, xAxisProperty, d, xTable) as number;
          return newX(scaleContext.reverseX ? Math.abs(val) : val);
        })
        .attr('cy', (d: any) => {
          const val = getValue(fields, yAxisProperty, d, yTable) as number;
          return newY(scaleContext.reverseY ? Math.abs(val) : val);
        });

      g.selectAll('circle.hover-area')
        .transition('zoom')
        .attr('cx', (d: any) => {
          const val = getValue(fields, xAxisProperty, d, xTable) as number;
          return newX(scaleContext.reverseX ? Math.abs(val) : val);
        })
        .attr('cy', (d: any) => {
          const val = getValue(fields, yAxisProperty, d, yTable) as number;
          return newY(scaleContext.reverseY ? Math.abs(val) : val);
        });
    });

    // Setup cross-plot sync
    setupCrossPlotSync(data, options, scaleContext, g, tooltip, zoomContainer, zoom);
  } else {
    // Use WebGL renderer
    // Hide SVG points
    g.selectAll('circle.data-point').remove();
    g.selectAll('circle.hover-area').remove();

    // Disable pointer-events on SVG zoom-layer so events reach the canvas
    zoomContainer.style('pointer-events', 'none');

    // Get or create WebGL renderer
    let webglRenderer: WebGLScatterRenderer;
    if (containerNode && webglRendererCache.has(containerNode)) {
      webglRenderer = webglRendererCache.get(containerNode)!;
      webglRenderer.resize(dimensions.width, dimensions.height);
    } else if (containerNode) {
      webglRenderer = new WebGLScatterRenderer(containerNode, dimensions);
      webglRendererCache.set(containerNode, webglRenderer);
    } else {
      return;
    }

    webglRenderer.setVisible(true);
    webglRenderer.render(data, options, scaleContext, colorContext);

    // Track current scale context (mutable so hover uses zoomed scales)
    let currentScaleContext = scaleContext;

    // Setup interactions - rerenderFn uses currentScaleContext which updates on zoom
    const rerenderFn = (highlightIndex: number) => {
      webglRenderer.render(data, options, currentScaleContext, colorContext, highlightIndex);
    };

    setupWebGLHoverInteraction(
      webglRenderer,
      data,
      options,
      tooltip,
      g,
      scaleContext,
      colorContext,
      rerenderFn
    );
    setupWebGLClickInteraction(webglRenderer, data, options);

    // Setup zoom on the canvas (not SVG zoom-layer which has pointer-events: none)
    setupWebGLZoomBehavior(
      webglRenderer.getCanvas(),
      svg,
      options,
      scaleContext,
      data,
      g,
      (newX, newY, transform) => {
        // On zoom, update current scale context and re-render
        currentScaleContext = { ...scaleContext, x: newX, y: newY };
        webglRenderer.render(data, options, currentScaleContext, colorContext);
      }
    );
  }

  // Draw regression lines (always SVG, overlaid on both renderers)
  if (showRegression === 'true' && data.length > 1) {
    drawRegressionLines(g, data, options, scaleContext, colorContext);
  }
}

/**
 * Export for backwards compatibility
 */
export { sampleData } from './data/sampling';
