'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { getValue } from '../../data';
import { drawAxes, generateTicks } from '../../axes';
import { positionTooltipRelativeToDatapoint } from '../../tooltip';
import { ScatterPlotOptions, ScaleContext, RenderMode } from '../types';

/**
 * Callback type for zoom updates
 */
export type ZoomUpdateCallback = (
  newXScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>,
  newYScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>,
  transform: d3.ZoomTransform
) => void;

/**
 * Setup zoom behavior for scatter plot
 */
export function setupZoomBehavior(
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  options: ScatterPlotOptions,
  scaleContext: ScaleContext,
  data: LogProps[],
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  onZoomUpdate: ZoomUpdateCallback
): d3.ZoomBehavior<Element, unknown> {
  const {
    container,
    dimensions,
    margins,
    scaleX,
    scaleY,
    xAxisProperty,
    yAxisProperty,
    xTable,
    yTable,
    fields,
    showRegression,
    interactive,
    zoomEnabled,
    zoomRef,
    containerRef,
    xType,
    yType,
  } = options;

  const { initialX, initialY, reverseX, reverseY } = scaleContext;

  const zoomContainer = svg.select('.zoom-layer');

  const onZoomStart = () => {
    d3.select('body').style('overflow', 'hidden');
    // Temporarily disable interaction during zoom
    g.selectAll('circle.data-point').style('pointer-events', 'none');
    g.selectAll('circle.hover-area').style('pointer-events', 'none');
    g.selectAll('text.correlation').style('pointer-events', 'none');
    g.selectAll('text.correlation-group').style('pointer-events', 'none');
    g.selectAll('path.best-fit').style('pointer-events', 'none');
  };

  const onZoomEnd = () => {
    d3.select('body').style('overflow', 'auto');
    // Re-enable interaction after zoom
    g.selectAll('circle.data-point').style('pointer-events', 'all');
    g.selectAll('circle.hover-area').style('pointer-events', 'all');
    g.selectAll('text.correlation').style('pointer-events', 'all');
    g.selectAll('text.correlation-group').style('pointer-events', 'all');
    g.selectAll('path.best-fit').style('pointer-events', 'all');
  };

  const onZoom = (event: d3.D3ZoomEvent<Element, unknown>) => {
    event.sourceEvent?.preventDefault();
    event.sourceEvent?.stopPropagation();

    const transform = event.transform;
    zoomRef.current = transform;

    const newX = transform.rescaleX(initialX as d3.ScaleLinear<number, number>);
    const newY = transform.rescaleY(initialY as d3.ScaleLinear<number, number>);

    // Update axes
    const [newXTicks, newYTicks] = [
      generateTicks(newX.domain()[0], newX.domain()[1], 10, scaleX === 'log'),
      generateTicks(newY.domain()[0], newY.domain()[1], 10, scaleY === 'log'),
    ];

    drawAxes(
      'Scatter Plot',
      svg,
      dimensions,
      margins,
      newX,
      newY,
      newXTicks,
      newYTicks,
      reverseX,
      reverseY,
      xAxisProperty,
      yAxisProperty,
      xType,
      yType
    );

    // Call update callback for renderer-specific updates
    onZoomUpdate(newX, newY, transform);

    // Update regression lines if enabled
    if (showRegression === 'true') {
      updateRegressionLinesOnZoom(
        g,
        data,
        fields,
        xAxisProperty,
        yAxisProperty,
        xTable,
        yTable,
        newX,
        newY
      );
    }

    // Update tooltip position if one is visible
    updateTooltipOnZoom(
      container,
      containerRef,
      data,
      g,
      xTable,
      newX,
      newY,
      reverseX,
      reverseY,
      fields,
      xAxisProperty,
      yAxisProperty,
      svg,
      transform
    );
  };

  // Create zoom behavior
  const zoom = d3
    .zoom<Element, unknown>()
    .on('start', onZoomStart)
    .on('end', onZoomEnd)
    .on('zoom', onZoom);

  // Apply to zoom container
  zoomContainer
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', dimensions.width)
    .attr('height', dimensions.height)
    .on('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();
    })
    .on('dblclick', () => {
      zoomRef.current = d3.zoomIdentity;
      (zoomContainer as any).transition('zoom').duration(500).call(zoom.transform, d3.zoomIdentity);
    })
    .style('fill', 'none')
    .style('pointer-events', interactive && zoomEnabled ? 'all' : 'none')
    .lower();

  (zoomContainer as any).call(zoom);
  zoom.transform(zoomContainer as any, zoomRef.current);

  return zoom;
}

/**
 * Update regression lines during zoom
 */
function updateRegressionLinesOnZoom(
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  data: LogProps[],
  fields: LogFieldsResponseProps,
  xAxisProperty: string,
  yAxisProperty: string,
  xTable: string,
  yTable: string,
  newX: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>,
  newY: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>
): void {
  const line = d3
    .line<[number, number]>()
    .x((d) => newX(d[0]))
    .y((d) => newY(d[1]));

  const xMin = d3.min(data, (d) => getValue(fields, xAxisProperty, d, xTable)) as number;
  const xMax = d3.max(data, (d) => getValue(fields, xAxisProperty, d, xTable)) as number;
  const [xStart, xEnd] = newX.domain();
  const constrainedXStart = Math.max(xStart, xMin);
  const constrainedXEnd = Math.min(xEnd, xMax);

  // Update regression line paths
  g.selectAll('path.best-fit')
    .transition('zoom')
    .attr('d', (d: any) =>
      line([
        [constrainedXStart, d.m * constrainedXStart + d.b],
        [constrainedXEnd, d.m * constrainedXEnd + d.b],
      ])
    );

  // Update correlation text positions
  g.selectAll('text.correlation, text.correlation-group')
    .transition('zoom')
    .each(function (d: any) {
      const lineStart = [xMin, d.m * xMin + d.b];
      const lineEnd = [xMax, d.m * xMax + d.b];

      const [xStartPx, yStartPx] = [newX(lineStart[0]), newY(lineStart[1])];
      const [xEndPx, yEndPx] = [newX(lineEnd[0]), newY(lineEnd[1])];
      const dx = xEndPx - xStartPx;
      const dy = yEndPx - yStartPx;

      const angleRad = Math.atan2(dy, dx);
      const angleDeg = (angleRad * 180) / Math.PI;
      const textOffset = -60;
      const hypotenuse = Math.hypot(dx, dy) !== 0 ? Math.hypot(dx, dy) : 1;
      const textX = xEndPx + (dx / hypotenuse) * textOffset;
      const textY = yEndPx + (dy / hypotenuse) * textOffset - 20;

      d3.select(this)
        .attr('x', textX)
        .attr('y', textY)
        .attr('transform', `rotate(${angleDeg},${textX},${textY})`)
        .attr('text-anchor', dx < 0 ? 'end' : 'start');
    });
}

/**
 * Update tooltip position during zoom
 */
function updateTooltipOnZoom(
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
  data: LogProps[],
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  xTable: string,
  newX: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>,
  newY: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>,
  reverseX: boolean,
  reverseY: boolean,
  fields: LogFieldsResponseProps,
  xAxisProperty: string,
  yAxisProperty: string,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  transform: d3.ZoomTransform
): void {
  if (!containerRef.current) return;

  const hoveredLog = (containerRef.current as any).__hoveredLog;
  const currentTooltip = container.select<HTMLDivElement>('.plotTooltip');

  if (hoveredLog && currentTooltip.node()) {
    const hoveredData = data.find((d) => d[`${xTable}.id`] === hoveredLog);
    if (hoveredData) {
      const targetElem = g
        .selectAll<SVGCircleElement, LogProps>('circle.data-point')
        .filter((d) => d[`${xTable}.id`] === hoveredLog)
        .node();

      if (targetElem && parseFloat(currentTooltip.style('opacity')) > 0) {
        positionTooltipRelativeToDatapoint(targetElem, currentTooltip, container, svg, transform);
      }
    } else {
      if (parseFloat(currentTooltip.style('opacity')) > 0) {
        currentTooltip.style('opacity', 0);
      }
    }
  }
}

/**
 * Setup zoom behavior for WebGL renderer (attaches to canvas)
 */
export function setupWebGLZoomBehavior(
  canvas: HTMLCanvasElement,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  options: ScatterPlotOptions,
  scaleContext: ScaleContext,
  data: LogProps[],
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  onZoomUpdate: ZoomUpdateCallback
): d3.ZoomBehavior<Element, unknown> {
  const {
    container,
    dimensions,
    margins,
    scaleX,
    scaleY,
    xAxisProperty,
    yAxisProperty,
    xTable,
    yTable,
    fields,
    showRegression,
    interactive,
    zoomEnabled,
    zoomRef,
    containerRef,
    xType,
    yType,
  } = options;

  const { initialX, initialY, reverseX, reverseY } = scaleContext;

  const onZoom = (event: d3.D3ZoomEvent<Element, unknown>) => {
    event.sourceEvent?.preventDefault();
    event.sourceEvent?.stopPropagation();

    const transform = event.transform;
    zoomRef.current = transform;

    const newX = transform.rescaleX(initialX as d3.ScaleLinear<number, number>);
    const newY = transform.rescaleY(initialY as d3.ScaleLinear<number, number>);

    // Update axes
    const [newXTicks, newYTicks] = [
      generateTicks(newX.domain()[0], newX.domain()[1], 10, scaleX === 'log'),
      generateTicks(newY.domain()[0], newY.domain()[1], 10, scaleY === 'log'),
    ];

    drawAxes(
      'Scatter Plot',
      svg,
      dimensions,
      margins,
      newX,
      newY,
      newXTicks,
      newYTicks,
      reverseX,
      reverseY,
      xAxisProperty,
      yAxisProperty,
      xType,
      yType
    );

    // Call update callback for renderer-specific updates
    onZoomUpdate(newX, newY, transform);

    // Update regression lines if enabled
    if (showRegression === 'true') {
      updateRegressionLinesOnZoom(
        g,
        data,
        fields,
        xAxisProperty,
        yAxisProperty,
        xTable,
        yTable,
        newX,
        newY
      );
    }
  };

  // Create zoom behavior
  const zoom = d3.zoom<Element, unknown>().on('zoom', onZoom);

  // Apply zoom behavior to canvas using d3.select
  const canvasSelection = d3.select(canvas);

  canvasSelection
    .on('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();
    })
    .on('dblclick', () => {
      zoomRef.current = d3.zoomIdentity;
      (canvasSelection as any)
        .transition('zoom')
        .duration(500)
        .call(zoom.transform, d3.zoomIdentity);
    });

  if (interactive && zoomEnabled) {
    (canvasSelection as any).call(zoom);
    zoom.transform(canvasSelection as any, zoomRef.current);
  }

  return zoom;
}
