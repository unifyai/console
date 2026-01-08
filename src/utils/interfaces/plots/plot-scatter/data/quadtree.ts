'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { getValue } from '../../data';
import { Viewport } from '../types';

/**
 * Build a D3 quadtree for efficient spatial queries on scatter plot data.
 * The quadtree enables O(log n) point lookup instead of O(n) linear search.
 *
 * @param data - Array of log data points
 * @param fields - Field metadata for accessing values
 * @param xAxisProperty - Property name for x-axis values
 * @param yAxisProperty - Property name for y-axis values
 * @param xTable - Table name for x-axis
 * @param yTable - Table name for y-axis
 * @returns Configured D3 quadtree
 */
export function buildQuadtree(
  data: LogProps[],
  fields: LogFieldsResponseProps,
  xAxisProperty: string,
  yAxisProperty: string,
  xTable: string,
  yTable: string
): d3.Quadtree<LogProps> {
  return d3
    .quadtree<LogProps>()
    .x((d) => getValue(fields, xAxisProperty, d, xTable) as number)
    .y((d) => getValue(fields, yAxisProperty, d, yTable) as number)
    .addAll(data);
}

/**
 * Get the viewport bounds from D3 scale domains.
 *
 * @param xScale - D3 scale for x-axis
 * @param yScale - D3 scale for y-axis
 * @returns Viewport bounds in data coordinates
 */
export function getViewportFromScales(
  xScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>,
  yScale: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>
): Viewport {
  const [xMin, xMax] = xScale.domain();
  // D3 domain is [minValue, maxValue], the range is what's inverted for screen coords
  const [yDomainStart, yDomainEnd] = yScale.domain();
  const yMin = Math.min(yDomainStart, yDomainEnd);
  const yMax = Math.max(yDomainStart, yDomainEnd);
  return { xMin, xMax, yMin, yMax };
}

/**
 * Cull data points to only those visible within the viewport.
 * Uses the quadtree for efficient spatial filtering.
 *
 * @param quadtree - Pre-built quadtree of data points
 * @param viewport - Visible viewport bounds in data coordinates
 * @param maxPoints - Optional maximum number of points to return
 * @returns Array of visible data points
 */
export function cullToViewport(
  quadtree: d3.Quadtree<LogProps>,
  viewport: Viewport,
  maxPoints?: number
): LogProps[] {
  const visible: LogProps[] = [];
  // Normalize bounds so min < max (handles inverted y-axis)
  let xMin = Math.min(viewport.xMin, viewport.xMax);
  let xMax = Math.max(viewport.xMin, viewport.xMax);
  let yMin = Math.min(viewport.yMin, viewport.yMax);
  let yMax = Math.max(viewport.yMin, viewport.yMax);

  // Add small epsilon to avoid floating-point boundary exclusions
  // This prevents edge cases where points exactly at the domain boundary
  // are incorrectly excluded due to floating-point precision issues
  const epsilon = 1e-10;
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  xMin -= xRange * epsilon;
  xMax += xRange * epsilon;
  yMin -= yRange * epsilon;
  yMax += yRange * epsilon;

  quadtree.visit((node, x0, y0, x1, y1) => {
    // Early exit if we have enough points
    if (maxPoints && visible.length >= maxPoints) {
      return true;
    }

    // Skip branches entirely outside the viewport
    if (x0 > xMax || x1 < xMin || y0 > yMax || y1 < yMin) {
      return true; // Don't visit children
    }

    // Process leaf nodes
    if (!node.length) {
      // Leaf node - check data points
      let current: d3.QuadtreeLeaf<LogProps> | undefined = node as d3.QuadtreeLeaf<LogProps>;
      while (current) {
        const d = current.data;
        if (d) {
          const px = quadtree.x()(d);
          const py = quadtree.y()(d);
          if (px >= xMin && px <= xMax && py >= yMin && py <= yMax) {
            visible.push(d);
            if (maxPoints && visible.length >= maxPoints) {
              return true;
            }
          }
        }
        current = (current as any).next;
      }
    }

    return false; // Continue visiting children
  });

  return visible;
}

/**
 * Find the nearest point to given coordinates within a threshold distance.
 * Uses the quadtree for efficient spatial search.
 *
 * @param quadtree - Pre-built quadtree of data points
 * @param x - X coordinate in data space
 * @param y - Y coordinate in data space
 * @param radius - Maximum distance to search
 * @returns The nearest LogProps or undefined if none found within radius
 */
export function findNearestPoint(
  quadtree: d3.Quadtree<LogProps>,
  x: number,
  y: number,
  radius: number
): LogProps | undefined {
  return quadtree.find(x, y, radius);
}
