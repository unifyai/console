'use client';

import * as d3 from 'd3';
import { LogProps } from '@/types/interfaces/logs';
import { InfoCardData } from '@/types/interfaces/plot';
import { showFixedTooltip } from '../../tooltip';
import { ScatterPlotOptions } from '../types';
import { SVGScatterRenderer } from '../renderers/svg-renderer';
import { WebGLScatterRenderer } from '../renderers/webgl-renderer';
import { findAllPointsAtCoordinates } from '../data/hit-detection';
import { getTooltipData } from './hover';

/**
 * Handle click interaction for SVG renderer
 */
export function setupSVGClickInteraction(
  renderer: SVGScatterRenderer,
  data: LogProps[],
  options: ScatterPlotOptions,
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
    settings,
    xType,
    yType,
  } = options;

  const onClick = (event: MouseEvent, clickedDatum: LogProps) => {
    // Find all overlapping points at this coordinate
    const overlappingPoints = findAllPointsAtCoordinates(
      clickedDatum,
      data,
      fields,
      xAxisProperty,
      yAxisProperty,
      xTable,
      yTable
    );

    let dataForFixedTooltip: InfoCardData | InfoCardData[];
    if (overlappingPoints.length > 1) {
      dataForFixedTooltip = overlappingPoints.map((p) =>
        getTooltipData(
          p,
          fields,
          groupBy,
          aggregate,
          xTable,
          yTable,
          xAxisProperty,
          yAxisProperty,
          xType,
          yType
        )
      );
    } else {
      dataForFixedTooltip = getTooltipData(
        clickedDatum,
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
    }

    showFixedTooltip(event, dataForFixedTooltip, settings);
  };

  // Bind click events
  g.selectAll<SVGCircleElement, LogProps>('circle.data-point').on('click', onClick);
  g.selectAll<SVGCircleElement, LogProps>('circle.hover-area').on('click', onClick);
}

/**
 * Handle click interaction for WebGL renderer
 */
export function setupWebGLClickInteraction(
  renderer: WebGLScatterRenderer,
  data: LogProps[],
  options: ScatterPlotOptions
): void {
  const {
    fields,
    xAxisProperty,
    yAxisProperty,
    xTable,
    yTable,
    groupBy,
    aggregate,
    settings,
    xType,
    yType,
  } = options;

  const canvas = renderer.getCanvas();

  const onClick = (event: MouseEvent) => {
    const clickedIndex = renderer.findPointAtLinear(event.clientX, event.clientY);

    if (clickedIndex >= 0) {
      const clickedDatum = data[clickedIndex];

      // Find all overlapping points
      const overlappingPoints = findAllPointsAtCoordinates(
        clickedDatum,
        data,
        fields,
        xAxisProperty,
        yAxisProperty,
        xTable,
        yTable
      );

      let dataForFixedTooltip: InfoCardData | InfoCardData[];
      if (overlappingPoints.length > 1) {
        dataForFixedTooltip = overlappingPoints.map((p) =>
          getTooltipData(
            p,
            fields,
            groupBy,
            aggregate,
            xTable,
            yTable,
            xAxisProperty,
            yAxisProperty,
            xType,
            yType
          )
        );
      } else {
        dataForFixedTooltip = getTooltipData(
          clickedDatum,
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
      }

      showFixedTooltip(event, dataForFixedTooltip, settings);
    }
  };

  canvas.addEventListener('click', onClick);
}
