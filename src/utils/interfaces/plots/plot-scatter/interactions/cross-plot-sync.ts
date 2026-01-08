'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { getValue } from '../../data';
import { tooltipTemplate, positionTooltipRelativeToDatapoint } from '../../tooltip';
import { ScatterPlotOptions, ScaleContext, ColorContext } from '../types';
import { getTooltipData } from './hover';
import { updateRegressionHighlight } from '../regression';
import { getConfig } from '../config';

/**
 * Setup cross-plot hover synchronization for SVG renderer.
 * When a point is hovered in one plot, this highlights the same log in other plots.
 */
export function setupCrossPlotSync(
  data: LogProps[],
  options: ScatterPlotOptions,
  scaleContext: ScaleContext,
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  zoomContainer: d3.Selection<d3.BaseType, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<Element, unknown>
): void {
  const {
    container,
    svg,
    fields,
    xAxisProperty,
    yAxisProperty,
    xTable,
    yTable,
    groupBy,
    aggregate,
    showRegression,
    interactive,
    zoomRef,
    xType,
    yType,
  } = options;

  const { x, y, initialX, initialY, xRange, yRange, reverseX, reverseY } = scaleContext;
  const config = getConfig();

  const containerNode = container.node();
  if (!containerNode || !interactive) {
    tooltip.style('opacity', 0);
    return;
  }

  const hoveredLog = (containerNode as any).__hoveredLog;

  if (!hoveredLog) {
    tooltip.style('opacity', 0);
    return;
  }

  const hoveredLogData = data.find((d) => d[`${xTable}.id`] === hoveredLog);

  if (!hoveredLogData) {
    tooltip.style('opacity', 0);
    return;
  }

  const targetSelection = g
    .selectAll<SVGCircleElement, LogProps>('circle.data-point')
    .filter((d) => d[`${xTable}.id`] === hoveredLog);
  const targetNode = targetSelection.node();

  if (!targetNode) {
    tooltip.style('opacity', 0);
    return;
  }

  // Calculate screen coordinates
  const dataValueX = getValue(fields, xAxisProperty, hoveredLogData, xTable) as number;
  const dataValueY = getValue(fields, yAxisProperty, hoveredLogData, yTable) as number;
  const targetScreenX = x(reverseX ? Math.abs(dataValueX) : dataValueX);
  const targetScreenY = y(reverseY ? Math.abs(dataValueY) : dataValueY);

  const isOffScreen =
    targetScreenX < xRange[0] ||
    targetScreenX > xRange[1] ||
    targetScreenY > yRange[0] ||
    targetScreenY < yRange[1];

  // Prepare tooltip
  const tooltipData = getTooltipData(
    hoveredLogData,
    fields,
    groupBy,
    aggregate,
    xTable,
    yTable,
    xAxisProperty,
    yAxisProperty,
    xType,
    yType
  );
  const template = tooltipTemplate(tooltipData);
  tooltip.html(template).style('opacity', 1);

  // Highlight the point
  targetSelection
    .classed('hovered-point', true)
    .transition('emphasize_point')
    .duration(250)
    .attr('r', config.hoverSize)
    .style('opacity', 1);

  // Apply dimming to other points
  if (groupBy) {
    const hoveredGroupValue = getValue(fields, groupBy, hoveredLogData, xTable);
    const stringifiedHoveredGroup = JSON.stringify(hoveredGroupValue);

    g.selectAll<SVGCircleElement, LogProps>('circle.data-point:not(.hovered-point)')
      .filter(
        (d) => JSON.stringify(getValue(fields, groupBy, d, xTable)) !== stringifiedHoveredGroup
      )
      .transition('dim_other_groups')
      .duration(200)
      .style('opacity', config.dimOpacity);

    g.selectAll<SVGCircleElement, LogProps>('circle.data-point:not(.hovered-point)')
      .filter(
        (d) => JSON.stringify(getValue(fields, groupBy, d, xTable)) === stringifiedHoveredGroup
      )
      .transition('undim_same_group')
      .duration(200)
      .style('opacity', config.sameGroupOpacity);

    if (showRegression === 'true') {
      updateRegressionHighlight(g, stringifiedHoveredGroup, showRegression);
    }
  } else {
    g.selectAll<SVGCircleElement, LogProps>('circle.data-point:not(.hovered-point)')
      .transition('dim_others_no_group')
      .duration(200)
      .style('opacity', config.dimOpacity);

    if (showRegression === 'true') {
      updateRegressionHighlight(g, null, showRegression);
    }
  }

  // Position tooltip or pan to off-screen point
  const currentTransform = zoomRef.current;

  if (isOffScreen) {
    // Pan to bring point into view
    panToPoint(
      zoomContainer,
      zoom,
      zoomRef,
      initialX as d3.ScaleLinear<number, number>,
      initialY as d3.ScaleLinear<number, number>,
      currentTransform,
      targetScreenX,
      targetScreenY,
      xRange,
      yRange,
      () => {
        // After panning, position tooltip
        const finalTransform = d3.zoomTransform(zoomContainer.node()! as any);
        const finalXScale = finalTransform.rescaleX(initialX as d3.ScaleLinear<number, number>);
        const finalYScale = finalTransform.rescaleY(initialY as d3.ScaleLinear<number, number>);

        const finalSvgX = finalXScale(reverseX ? Math.abs(dataValueX) : dataValueX);
        const finalSvgY = finalYScale(reverseY ? Math.abs(dataValueY) : dataValueY);

        positionTooltipAtScreenCoords(tooltip, container, svg, finalSvgX, finalSvgY);
      }
    );
  } else {
    positionTooltipRelativeToDatapoint(targetNode, tooltip, container, svg, currentTransform);
  }
}

/**
 * Pan the view to bring a point into the center
 */
function panToPoint(
  zoomContainer: d3.Selection<d3.BaseType, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<Element, unknown>,
  zoomRef: React.MutableRefObject<d3.ZoomTransform>,
  initialX: d3.ScaleLinear<number, number>,
  initialY: d3.ScaleLinear<number, number>,
  currentTransform: d3.ZoomTransform,
  targetScreenX: number,
  targetScreenY: number,
  xRange: [number, number],
  yRange: [number, number],
  onComplete: () => void
): void {
  const centerX = (xRange[0] + xRange[1]) / 2;
  const centerY = (yRange[1] + yRange[0]) / 2;
  const k = currentTransform.k;
  const dx = centerX - targetScreenX;
  const dy = centerY - targetScreenY;
  const targetTransform = d3.zoomIdentity
    .translate(currentTransform.x + dx, currentTransform.y + dy)
    .scale(k);

  // Temporarily detach zoom listener
  zoomContainer.on('zoom', null);

  zoomContainer.interrupt('pan_to_hover');
  (zoomContainer as any)
    .transition('pan_to_hover')
    .duration(500)
    .call(zoom.transform, targetTransform)
    .on('end', () => {
      const finalTransform = d3.zoomTransform(zoomContainer.node()! as any);
      zoomRef.current = finalTransform;
      onComplete();
    })
    .on('interrupt', () => {
      const interruptedTransform = d3.zoomTransform(zoomContainer.node()! as any);
      zoomRef.current = interruptedTransform;
    });
}

/**
 * Position tooltip at specific screen coordinates
 */
function positionTooltipAtScreenCoords(
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  container: d3.Selection<HTMLDivElement | null, unknown, null, undefined>,
  svg: d3.Selection<SVGSVGElement | null, unknown, null, undefined>,
  svgX: number,
  svgY: number
): void {
  const containerNode = container.node();
  const tooltipNode = tooltip.node();
  const svgNode = svg.node();

  if (!containerNode || !tooltipNode || !svgNode) {
    tooltip.style('opacity', 0);
    return;
  }

  tooltip.style('opacity', 1);

  const svgRect = svgNode.getBoundingClientRect();
  const containerRect = containerNode.getBoundingClientRect();
  const tooltipRect = tooltipNode.getBoundingClientRect();

  const containerX = svgX + (svgRect.left - containerRect.left);
  const containerY = svgY + (svgRect.top - containerRect.top);

  const offsetX = 15;
  const offsetY = 15;

  let xPos = containerX + offsetX;
  let yPos = containerY + offsetY;

  // Adjust for boundaries
  if (xPos + tooltipRect.width > containerRect.width) {
    xPos = containerX - tooltipRect.width - offsetX;
  }
  if (xPos < 0) {
    xPos = offsetX;
  }
  if (yPos + tooltipRect.height > containerRect.height) {
    yPos = containerY - tooltipRect.height - offsetY;
  }
  if (yPos < 0) {
    yPos = offsetY;
  }

  tooltip.style('left', `${xPos}px`).style('top', `${yPos}px`);
}
