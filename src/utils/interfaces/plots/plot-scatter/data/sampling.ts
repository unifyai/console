'use client';

import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import { getValue } from '../../data';
import { SamplingResult } from '../types';
import { getConfig } from '../config';

/**
 * Perform stratified sampling on large datasets.
 * Divides the 2D plot space into a grid and samples proportionally from each cell.
 * This preserves the spatial distribution of the data better than random sampling.
 *
 * @param data - Array of log data points
 * @param targetSize - Desired number of points after sampling
 * @param fields - Field metadata for accessing values
 * @param xAxisProperty - Property name for x-axis values
 * @param yAxisProperty - Property name for y-axis values
 * @param xTable - Table name for x-axis
 * @param yTable - Table name for y-axis
 * @returns Sampling result with sampled data and counts
 */
export function stratifiedSample(
  data: LogProps[],
  targetSize: number,
  fields: LogFieldsResponseProps,
  xAxisProperty: string,
  yAxisProperty: string,
  xTable: string,
  yTable: string
): SamplingResult {
  // No sampling needed if data is small enough
  if (data.length <= targetSize) {
    return {
      sampled: data,
      originalCount: data.length,
      sampledCount: data.length,
    };
  }

  const config = getConfig();
  const gridSize = config.samplingGridSize;

  // Get value extents
  const xValues = data.map((d) => getValue(fields, xAxisProperty, d, xTable) as number);
  const yValues = data.map((d) => getValue(fields, yAxisProperty, d, yTable) as number);
  const [minX, maxX] = d3.extent(xValues) as [number, number];
  const [minY, maxY] = d3.extent(yValues) as [number, number];

  // Calculate cell dimensions
  const xStep = (maxX - minX) / gridSize || 1;
  const yStep = (maxY - minY) / gridSize || 1;

  // Bin data into grid cells
  const bins = new Map<string, LogProps[]>();

  for (const d of data) {
    const xVal = getValue(fields, xAxisProperty, d, xTable) as number;
    const yVal = getValue(fields, yAxisProperty, d, yTable) as number;
    const xBin = Math.min(Math.floor((xVal - minX) / xStep), gridSize - 1);
    const yBin = Math.min(Math.floor((yVal - minY) / yStep), gridSize - 1);
    const key = `${xBin},${yBin}`;

    if (!bins.has(key)) {
      bins.set(key, []);
    }
    bins.get(key)!.push(d);
  }

  // Sample proportionally from each bin
  const samplingRatio = targetSize / data.length;
  const result: LogProps[] = [];

  for (const binData of Array.from(bins.values())) {
    // Ensure at least 1 point per non-empty bin for coverage
    const sampleCount = Math.max(1, Math.round(binData.length * samplingRatio));

    if (sampleCount >= binData.length) {
      // Take all points from this bin
      result.push(...binData);
    } else {
      // Fisher-Yates partial shuffle for random sample
      const copy = [...binData];
      for (let i = 0; i < sampleCount; i++) {
        const j = i + Math.floor(Math.random() * (copy.length - i));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      result.push(...copy.slice(0, sampleCount));
    }
  }

  return {
    sampled: result,
    originalCount: data.length,
    sampledCount: result.length,
  };
}

/**
 * Simple random sampling using Fisher-Yates shuffle.
 * Kept for backwards compatibility and simpler use cases.
 *
 * @param arr - Array to sample from
 * @param size - Number of elements to sample
 * @returns Randomly sampled array
 */
export function sampleData<T>(arr: T[], size: number): T[] {
  if (arr.length <= size) {
    return arr;
  }

  const shuffled = arr.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, size);
}
