'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { getValue } from '../../data';
import {
  DataPoint,
  RegressionResult,
  ScatterPlotOptions,
  ScaleContext,
  ColorContext,
} from '../types';

/**
 * Calculate linear regression parameters (slope, y-intercept) and correlation coefficient.
 * Uses the least squares method.
 *
 * @param data - Array of [x, y] data points
 * @returns Regression result with slope (m), y-intercept (b), and correlation (r)
 */
export function calculateRegression(data: DataPoint[]): RegressionResult {
  const xValues = data.map((d) => d[0]);
  const yValues = data.map((d) => d[1]);

  const xMean = d3.mean(xValues) || 0;
  const yMean = d3.mean(yValues) || 0;

  const numerator = d3.sum(xValues.map((x, i) => (x - xMean) * (yValues[i] - yMean)));
  const denominator = d3.sum(xValues.map((x) => (x - xMean) ** 2));

  const m = numerator / denominator;
  const b = yMean - m * xMean;

  const r =
    numerator / (Math.sqrt(denominator) * Math.sqrt(d3.sum(yValues.map((y) => (y - yMean) ** 2))));

  return { m, b, r };
}

/**
 * Draw regression lines on the plot (SVG-based, works for both SVG and WebGL modes).
 * Regression lines are always rendered as SVG for simplicity.
 *
 * @param g - D3 selection for the plot data group
 * @param data - Data points to calculate regression for
 * @param options - Scatter plot options
 * @param scaleContext - Scale context with x and y scales
 * @param colorContext - Color context for styling
 */
export function drawRegressionLines(
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  data: LogProps[],
  options: ScatterPlotOptions,
  scaleContext: ScaleContext,
  colorContext: ColorContext
): void {
  const { fields, xAxisProperty, yAxisProperty, xTable, yTable, groupBy } = options;
  const { x, y } = scaleContext;
  const { primary, colorScale, colorRange } = colorContext;

  // Remove previous regression elements
  g.selectAll('text.correlation-group').remove();
  g.selectAll('text.correlation').remove();

  if (data.length <= 1) {
    g.selectAll('path.best-fit').remove();
    return;
  }

  if (groupBy) {
    // Grouped regression lines
    let groups = data.map((d) => JSON.stringify(getValue(fields, groupBy, d, xTable)));
    groups = Array.from(new Set(groups));
    const groupColor = d3.scaleOrdinal().domain(groups).range(colorRange);

    const groupRegressions = groups.map((groupKey) => {
      const groupData = data.filter(
        (d) => JSON.stringify(getValue(fields, groupBy, d, xTable)) === groupKey
      );
      const points = groupData.map((d) => [
        getValue(fields, xAxisProperty, d, xTable),
        getValue(fields, yAxisProperty, d, yTable),
      ]) as DataPoint[];

      return {
        ...calculateRegression(points),
        groupKey: groupKey,
      };
    });

    // Draw regression lines
    const line = d3
      .line<[number, number]>()
      .x((d) => x(d[0]))
      .y((d) => y(d[1]));

    g.selectAll('path.best-fit')
      .data(groupRegressions, (d: any) => d.groupKey)
      .join('path')
      .attr('d', (d) => {
        const xMin = x.domain()[0];
        const xMax = x.domain()[1];
        return line([
          [xMin, d.m * xMin + d.b],
          [xMax, d.m * xMax + d.b],
        ]);
      })
      .attr('stroke', (d: any) => groupColor(d.groupKey) as string)
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('class', 'best-fit');

    // Draw correlation text for each group
    g.selectAll('text.correlation-group')
      .data(groupRegressions, (d: any) => d.groupKey)
      .join(
        (enter) =>
          enter
            .append('text')
            .attr('class', 'correlation-group')
            .attr('dominant-baseline', 'middle'),
        (update) => update,
        (exit) => exit.remove()
      )
      .each(function (d) {
        const xMin = x.domain()[0];
        const xMax = x.domain()[1];
        const lineStart = [xMin, d.m * xMin + d.b];
        const lineEnd = [xMax, d.m * xMax + d.b];

        const [xStartPx, yStartPx] = [x(lineStart[0]), y(lineStart[1])];
        const [xEndPx, yEndPx] = [x(lineEnd[0]), y(lineEnd[1])];
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
          .attr('text-anchor', dx < 0 ? 'end' : 'start')
          .attr('fill', groupColor(d.groupKey!) as string)
          .text(`r = ${d.r.toFixed(2)}`);
      });
  } else {
    // Single regression line
    const allPoints = data.map((d) => [
      getValue(fields, xAxisProperty, d, xTable),
      getValue(fields, yAxisProperty, d, yTable),
    ]) as DataPoint[];
    const regression = calculateRegression(allPoints);

    const line = d3
      .line<[number, number]>()
      .x((d) => x(d[0]))
      .y((d) => y(d[1]));

    const xMin = x.domain()[0];
    const xMax = x.domain()[1];
    const [minX, maxX] = d3.extent(allPoints.map((p) => p[0])) as [number, number];

    g.selectAll('path.best-fit')
      .data([regression])
      .join(
        (enter) =>
          enter
            .append('path')
            .attr('class', 'best-fit')
            .attr('stroke', primary)
            .attr('stroke-width', 2)
            .attr('fill', 'none')
            .attr('d', (d) =>
              line([
                [xMin, d.m * xMin + d.b],
                [xMax, d.m * xMax + d.b],
              ])
            ),
        (update) =>
          update.attr('stroke', primary).attr('d', (d) =>
            line([
              [xMin, d.m * xMin + d.b],
              [xMax, d.m * xMax + d.b],
            ])
          ),
        (exit) => exit.remove()
      );

    // Get SVG coordinates of line endpoints
    const lineStart = [minX, regression.m * minX + regression.b];
    const lineEnd = [maxX, regression.m * maxX + regression.b];
    const [xStartPx, yStartPx] = [x(lineStart[0]), y(lineStart[1])];
    const [xEndPx, yEndPx] = [x(lineEnd[0]), y(lineEnd[1])];

    // Calculate angle in degrees
    const dx = xEndPx - xStartPx;
    const dy = yEndPx - yStartPx;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    // Position at line tip
    const textOffset = -60;
    const hypotenuse = Math.hypot(dx, dy) !== 0 ? Math.hypot(dx, dy) : 1;
    const textX = xEndPx + (dx / hypotenuse) * textOffset;
    const textY = yEndPx + (dy / hypotenuse) * textOffset - 20;

    g.selectAll('text.correlation')
      .data([regression])
      .join(
        (enter) =>
          enter
            .append('text')
            .attr('x', textX)
            .attr('y', textY)
            .attr('transform', `rotate(${angleDeg},${textX},${textY})`)
            .attr('text-anchor', dx < 0 ? 'end' : 'start')
            .attr('dominant-baseline', 'middle')
            .attr('fill', primary)
            .text(`r = ${regression.r.toFixed(2)}`)
            .attr('class', 'correlation'),
        (update) =>
          update
            .attr('fill', primary)
            .attr('x', textX)
            .attr('y', textY)
            .attr('transform', `rotate(${angleDeg},${textX},${textY})`)
            .attr('text-anchor', dx < 0 ? 'end' : 'start')
            .attr('dominant-baseline', 'middle')
            .text((d) => `r = ${d.r.toFixed(2)}`),
        (exit) => exit.remove()
      );
  }
}

/**
 * Update regression line highlighting based on hovered group.
 *
 * @param g - D3 selection for the plot data group
 * @param hoveredGroup - The group key being hovered (stringified) or null
 * @param showRegression - Whether regression is enabled
 */
export function updateRegressionHighlight(
  g: d3.Selection<d3.BaseType, unknown, null, undefined>,
  hoveredGroup: string | null,
  showRegression: string
): void {
  if (showRegression !== 'true') return;

  if (hoveredGroup) {
    g.selectAll('path.best-fit').style('opacity', (d: any) =>
      d.groupKey === hoveredGroup ? 1 : 0.1
    );
    g.selectAll('text.correlation-group').style('opacity', (d: any) =>
      d.groupKey === hoveredGroup ? 1 : 0.1
    );
  } else {
    g.selectAll('path.best-fit').style('opacity', 1);
    g.selectAll('text.correlation, text.correlation-group').style('opacity', 1);
  }
}
