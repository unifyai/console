'use client';

import * as d3 from 'd3';
import { LogProps } from '@/types/interfaces/logs';
import { InfoCardData } from '@/types/interfaces/plot';
import { getValue } from '../../data';
import { showFixedTooltip } from '../../tooltip';
import { ScatterPlotOptions } from '../types';
import { SVGScatterRenderer } from '../renderers/svg-renderer';
import { WebGLScatterRenderer } from '../renderers/webgl-renderer';
import { findAllPointsAtCoordinates } from '../data/hit-detection';
import { getTooltipData } from './hover';

/**
 * Generate a unique ID for a scatter point based on its data
 */
function generatePointId(
  datum: LogProps,
  fields: any,
  xAxisProperty: string,
  yAxisProperty: string,
  xTable: string,
  yTable: string,
  groupBy?: string
): string {
  const xVal = getValue(fields, xAxisProperty, datum, xTable);
  const yVal = getValue(fields, yAxisProperty, datum, yTable);
  if (groupBy) {
    const groupVal = getValue(fields, groupBy, datum, xTable);
    return `${groupVal}-${xVal}-${yVal}`;
  }
  return `${xVal}-${yVal}`;
}

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
    axisCustomization,
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

    // Use external drawer callback if provided
    if (axisCustomization?.onDatapointPin) {
      const xLabel = axisCustomization.xAxisLabel || xAxisProperty || 'X';
      const yLabel = axisCustomization.yAxisLabel || yAxisProperty || 'Y';
      const groupLabel = axisCustomization.groupByLabel || groupBy || 'Group';

      // Pin the first point (or clicked point if no overlaps)
      const pointToPin = overlappingPoints.length > 0 ? overlappingPoints[0] : clickedDatum;
      const xVal = getValue(fields, xAxisProperty!, pointToPin, xTable);
      const yVal = getValue(fields, yAxisProperty!, pointToPin, yTable);
      const pointId = generatePointId(
        pointToPin,
        fields,
        xAxisProperty!,
        yAxisProperty!,
        xTable,
        yTable,
        groupBy
      );

      if (groupBy) {
        const groupVal = getValue(fields, groupBy, pointToPin, xTable);
        axisCustomization.onDatapointPin({
          id: pointId,
          x: { label: xLabel, value: xVal },
          y: { label: yLabel, value: yVal },
          group: { label: groupLabel, value: String(groupVal) },
        });
      } else {
        axisCustomization.onDatapointPin({
          id: pointId,
          x: { label: xLabel, value: xVal },
          y: { label: yLabel, value: yVal },
        });
      }
    } else {
      // Fallback to old fixed tooltip behavior
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
            yType,
            axisCustomization
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
          yType,
          axisCustomization
        );
      }

      showFixedTooltip(event, dataForFixedTooltip, settings);
    }
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
    axisCustomization,
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

      // Use external drawer callback if provided
      if (axisCustomization?.onDatapointPin) {
        const xLabel = axisCustomization.xAxisLabel || xAxisProperty || 'X';
        const yLabel = axisCustomization.yAxisLabel || yAxisProperty || 'Y';
        const groupLabel = axisCustomization.groupByLabel || groupBy || 'Group';

        // Pin the first point (or clicked point if no overlaps)
        const pointToPin = overlappingPoints.length > 0 ? overlappingPoints[0] : clickedDatum;
        const xVal = getValue(fields, xAxisProperty!, pointToPin, xTable);
        const yVal = getValue(fields, yAxisProperty!, pointToPin, yTable);
        const pointId = generatePointId(
          pointToPin,
          fields,
          xAxisProperty!,
          yAxisProperty!,
          xTable,
          yTable,
          groupBy
        );

        if (groupBy) {
          const groupVal = getValue(fields, groupBy, pointToPin, xTable);
          axisCustomization.onDatapointPin({
            id: pointId,
            x: { label: xLabel, value: xVal },
            y: { label: yLabel, value: yVal },
            group: { label: groupLabel, value: String(groupVal) },
          });
        } else {
          axisCustomization.onDatapointPin({
            id: pointId,
            x: { label: xLabel, value: xVal },
            y: { label: yLabel, value: yVal },
          });
        }
      } else {
        // Fallback to old fixed tooltip behavior
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
              yType,
              axisCustomization
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
            yType,
            axisCustomization
          );
        }

        showFixedTooltip(event, dataForFixedTooltip, settings);
      }
    }
  };

  canvas.addEventListener('click', onClick);
}
