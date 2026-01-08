'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { InfoCardData } from '@/types/interfaces/plot';
import { getValue } from '../../data';
import { formatTimeTypeValue } from '../../../format';
import { tooltipTemplate, positionTooltipRelativeToPointer } from '../../tooltip';
import { ScatterPlotOptions, RenderMode } from '../types';
import { SVGScatterRenderer } from '../renderers/svg-renderer';
import { WebGLScatterRenderer } from '../renderers/webgl-renderer';
import { updateRegressionHighlight } from '../regression';

/**
 * Generate tooltip data for a hovered point
 */
export function getTooltipData(
  data: LogProps,
  fields: LogFieldsResponseProps,
  groupBy: string | undefined,
  aggregate: string | undefined,
  xTable: string,
  yTable: string,
  selectedXAxisProperty: string | undefined,
  selectedYAxisProperty: string | undefined,
  xType: string | undefined,
  yType: string | undefined
): InfoCardData {
  const hoverData: InfoCardData = {
    x: {
      name: `X: ${selectedXAxisProperty as string}`,
      value:
        xType === 'timestamp' || xType === 'timedelta' || xType === 'time' || xType === 'date'
          ? formatTimeTypeValue(
              getValue(fields, selectedXAxisProperty as string, data, xTable),
              xType
            )
          : getValue(fields, selectedXAxisProperty as string, data, xTable),
    },
    y: {
      name: `Y: ${selectedYAxisProperty as string}`,
      value:
        yType === 'timestamp' || yType === 'timedelta' || yType === 'time' || yType === 'date'
          ? formatTimeTypeValue(
              getValue(fields, selectedYAxisProperty as string, data, yTable),
              yType
            )
          : getValue(fields, selectedYAxisProperty as string, data, yTable),
    },
  };

  if (groupBy) {
    hoverData['group'] = {
      name: `Group: ${groupBy}`,
      value: getValue(fields, groupBy as string, data, xTable),
    };
  }

  if (aggregate) {
    hoverData['aggregate'] = {
      name: `Aggregate: ${aggregate}`,
    };
  }

  return hoverData;
}

/**
 * Handle hover interaction for SVG renderer
 */
export function setupSVGHoverInteraction(
  renderer: SVGScatterRenderer,
  data: LogProps[],
  options: ScatterPlotOptions,
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  g: d3.Selection<d3.BaseType, unknown, null, undefined>
): void {
  const {
    fields,
    xAxisProperty,
    yAxisProperty,
    xTable,
    yTable,
    groupBy,
    aggregate,
    showRegression,
    container,
    xType,
    yType,
  } = options;

  const onMouseOver = (event: MouseEvent, datum: LogProps) => {
    // Generate tooltip content
    const tooltipData = getTooltipData(
      datum,
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
    positionTooltipRelativeToPointer(event, tooltip, container);

    // Notify cross-plot sync
    const containerNode = container.node();
    if (containerNode) {
      const setHoveredLog = (containerNode as any).__setHoveredLog;
      if (setHoveredLog) {
        setHoveredLog(datum[`${xTable}.id`]);
      }
    }

    // Apply highlighting
    const index = data.indexOf(datum);
    if (index >= 0) {
      renderer.applyHighlight(index);
    }

    // Update regression line highlighting
    if (groupBy && showRegression === 'true') {
      const hoveredGroup = JSON.stringify(getValue(fields, groupBy, datum, xTable));
      updateRegressionHighlight(g, hoveredGroup, showRegression);
    }
  };

  const onMouseMove = (event: MouseEvent) => {
    positionTooltipRelativeToPointer(event as any, tooltip, container);
  };

  const onMouseOut = () => {
    tooltip.style('opacity', 0);
    renderer.clearHighlight();
    updateRegressionHighlight(g, null, showRegression);

    // Clear cross-plot sync
    const containerNode = container.node();
    if (containerNode) {
      const setHoveredLog = (containerNode as any).__setHoveredLog;
      if (setHoveredLog) {
        setHoveredLog(undefined);
      }
    }
  };

  // Bind events to data points and hover areas
  g.selectAll<SVGCircleElement, LogProps>('circle.data-point')
    .on('mouseover', onMouseOver)
    .on('mousemove', onMouseMove)
    .on('mouseout', onMouseOut);

  g.selectAll<SVGCircleElement, LogProps>('circle.hover-area')
    .on('mouseover', onMouseOver)
    .on('mousemove', onMouseMove)
    .on('mouseout', onMouseOut);
}

// Store references to event handlers on canvas to allow cleanup
interface WebGLCanvasWithHandlers extends HTMLCanvasElement {
  __webglMouseMoveHandler?: (event: MouseEvent) => void;
  __webglMouseLeaveHandler?: () => void;
}

/**
 * Handle hover interaction for WebGL renderer
 */
export function setupWebGLHoverInteraction(
  renderer: WebGLScatterRenderer,
  data: LogProps[],
  options: ScatterPlotOptions,
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  scaleContext: any,
  colorContext: any,
  rerenderFn: (highlightIndex: number) => void
): void {
  const {
    fields,
    xAxisProperty,
    yAxisProperty,
    xTable,
    yTable,
    groupBy,
    aggregate,
    showRegression,
    container,
    xType,
    yType,
  } = options;

  let hoveredIndex = -1;
  const canvas = renderer.getCanvas() as WebGLCanvasWithHandlers;

  // Remove old event listeners if they exist (prevents accumulation on re-renders)
  if (canvas.__webglMouseMoveHandler) {
    canvas.removeEventListener('mousemove', canvas.__webglMouseMoveHandler);
  }
  if (canvas.__webglMouseLeaveHandler) {
    canvas.removeEventListener('mouseleave', canvas.__webglMouseLeaveHandler);
  }

  const onMouseMove = (event: MouseEvent) => {
    // Use linear search for more reliable hit detection in 2D
    const newIndex = renderer.findPointAtLinear(event.clientX, event.clientY);

    if (newIndex !== hoveredIndex) {
      hoveredIndex = newIndex;

      if (newIndex >= 0) {
        const datum = data[newIndex];

        // Show tooltip
        const tooltipData = getTooltipData(
          datum,
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
        tooltip.html(tooltipTemplate(tooltipData)).style('opacity', 1);
        positionTooltipRelativeToPointer(event as any, tooltip, container);

        // Notify cross-plot sync
        const containerNode = container.node();
        if (containerNode) {
          const setHoveredLog = (containerNode as any).__setHoveredLog;
          if (setHoveredLog) {
            setHoveredLog(datum[`${xTable}.id`]);
          }
        }

        // Re-render with highlight
        rerenderFn(newIndex);

        // Update regression line highlighting
        if (groupBy && showRegression === 'true') {
          const hoveredGroup = JSON.stringify(getValue(fields, groupBy, datum, xTable));
          updateRegressionHighlight(g, hoveredGroup, showRegression);
        }
      } else {
        // No point hovered
        tooltip.style('opacity', 0);
        rerenderFn(-1);
        updateRegressionHighlight(g, null, showRegression);

        // Clear cross-plot sync
        const containerNode = container.node();
        if (containerNode) {
          const setHoveredLog = (containerNode as any).__setHoveredLog;
          if (setHoveredLog) {
            setHoveredLog(undefined);
          }
        }
      }
    } else if (newIndex >= 0) {
      // Same point hovered, just update tooltip position
      positionTooltipRelativeToPointer(event as any, tooltip, container);
    }
  };

  const onMouseLeave = () => {
    if (hoveredIndex >= 0) {
      hoveredIndex = -1;
      tooltip.style('opacity', 0);
      rerenderFn(-1);
      updateRegressionHighlight(g, null, showRegression);

      const containerNode = container.node();
      if (containerNode) {
        const setHoveredLog = (containerNode as any).__setHoveredLog;
        if (setHoveredLog) {
          setHoveredLog(undefined);
        }
      }
    }
  };

  // Store handlers for later cleanup
  canvas.__webglMouseMoveHandler = onMouseMove;
  canvas.__webglMouseLeaveHandler = onMouseLeave;

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
}
