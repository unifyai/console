'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { getValue } from '../../data';
import { getConfig } from '../config';

/**
 * Find the index of a point at given screen coordinates using linear search.
 * This is used when quadtree-based search is not available.
 *
 * @param data - Array of log data points
 * @param mouseX - Mouse X coordinate in screen space
 * @param mouseY - Mouse Y coordinate in screen space
 * @param xScale - D3 scale for x-axis
 * @param yScale - D3 scale for y-axis
 * @param fields - Field metadata for accessing values
 * @param xAxisProperty - Property name for x-axis values
 * @param yAxisProperty - Property name for y-axis values
 * @param xTable - Table name for x-axis
 * @param yTable - Table name for y-axis
 * @param reverseX - Whether x-axis is reversed (for log scale with negative values)
 * @param reverseY - Whether y-axis is reversed
 * @param threshold - Maximum distance in pixels to consider a hit
 * @returns Index of the nearest point, or -1 if none found
 */
export function findPointAtLinear(
  data: LogProps[],
  mouseX: number,
  mouseY: number,
  xScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>,
  yScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>,
  fields: LogFieldsResponseProps,
  xAxisProperty: string,
  yAxisProperty: string,
  xTable: string,
  yTable: string,
  reverseX: boolean,
  reverseY: boolean,
  threshold?: number
): number {
  const config = getConfig();
  const maxDist = threshold ?? config.HIT_THRESHOLD;

  let closestIndex = -1;
  let closestDist = maxDist;

  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const xVal = getValue(fields, xAxisProperty, d, xTable) as number;
    const yVal = getValue(fields, yAxisProperty, d, yTable) as number;

    const screenX = xScale(reverseX ? Math.abs(xVal) : xVal);
    const screenY = yScale(reverseY ? Math.abs(yVal) : yVal);

    const dist = Math.hypot(mouseX - screenX, mouseY - screenY);
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex = i;
    }
  }

  return closestIndex;
}

/**
 * Find all points that overlap with a target point's coordinates.
 * Used for showing multiple points in tooltip when they share the same position.
 *
 * @param targetDatum - The target log entry
 * @param allPlotData - All data points in the plot
 * @param fields - Field metadata for accessing values
 * @param xAxisProperty - Property name for x-axis values
 * @param yAxisProperty - Property name for y-axis values
 * @param xTable - Table name for x-axis
 * @param yTable - Table name for y-axis
 * @returns Array of overlapping log entries
 */
export function findAllPointsAtCoordinates(
  targetDatum: LogProps,
  allPlotData: LogProps[],
  fields: LogFieldsResponseProps,
  xAxisProperty: string,
  yAxisProperty: string,
  xTable: string,
  yTable: string
): LogProps[] {
  const targetX = getValue(fields, xAxisProperty, targetDatum, xTable);
  const targetY = getValue(fields, yAxisProperty, targetDatum, yTable);

  if (targetX === undefined || targetY === undefined) {
    return [targetDatum];
  }

  return allPlotData.filter((p) => {
    const currentX = getValue(fields, xAxisProperty, p, xTable);
    const currentY = getValue(fields, yAxisProperty, p, yTable);
    return currentX === targetX && currentY === targetY;
  });
}

/**
 * Convert screen coordinates to data coordinates using inverse scale.
 *
 * @param screenX - X coordinate in screen space
 * @param screenY - Y coordinate in screen space
 * @param xScale - D3 scale for x-axis
 * @param yScale - D3 scale for y-axis
 * @returns Data coordinates [x, y]
 */
export function screenToData(
  screenX: number,
  screenY: number,
  xScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>,
  yScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>
): [number, number] {
  return [xScale.invert(screenX), yScale.invert(screenY)];
}
