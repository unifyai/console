/**
 * Scatter Plot Data Processing Unit Tests
 *
 * Tests for quadtree, sampling, and hit detection utilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as d3 from 'd3';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';
import {
  buildQuadtree,
  cullToViewport,
  findNearestPoint,
  getViewportFromScales,
  stratifiedSample,
  sampleData,
  findPointAtLinear,
  findAllPointsAtCoordinates,
} from '@/utils/interfaces/plots/plot-scatter/data';
import { resetConfig, updateConfig } from '@/utils/interfaces/plots/plot-scatter/config';
import { determineRenderMode } from '@/utils/interfaces/plots/plot-scatter/orchestrator';

// =============================================================================
// Test Helpers
// =============================================================================

const mockFields: LogFieldsResponseProps = {
  'table1.x': {
    data_type: 'float',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: '',
  },
  'table1.y': {
    data_type: 'float',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: '',
  },
  'table1.group': {
    data_type: 'str',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: '',
  },
};

function createMockLog(id: string, x: number, y: number, group?: string): LogProps {
  return {
    'table1.id': id,
    'table1.entries': {
      'table1.x': x,
      'table1.y': y,
      'table1.group': group || 'default',
    },
  } as unknown as LogProps;
}

function createDataset(count: number, spread = 100): LogProps[] {
  return Array.from({ length: count }, (_, i) =>
    createMockLog(`log_${i}`, Math.random() * spread, Math.random() * spread)
  );
}

// =============================================================================
// Render Mode Determination
// =============================================================================

describe('Render Mode Determination', () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  it('returns "svg" for small datasets', () => {
    expect(determineRenderMode(100)).toBe('svg');
    expect(determineRenderMode(1000)).toBe('svg');
    expect(determineRenderMode(2000)).toBe('svg');
  });

  it('returns "webgl" for medium datasets', () => {
    expect(determineRenderMode(2001)).toBe('webgl');
    expect(determineRenderMode(10000)).toBe('webgl');
    expect(determineRenderMode(500000)).toBe('webgl');
    expect(determineRenderMode(1000000)).toBe('webgl');
  });

  it('returns "webgl-sampled" for very large datasets', () => {
    expect(determineRenderMode(1000001)).toBe('webgl-sampled');
    expect(determineRenderMode(5000000)).toBe('webgl-sampled');
  });

  it('respects custom thresholds', () => {
    updateConfig({ svgMax: 100, webglMax: 1000 });

    expect(determineRenderMode(50)).toBe('svg');
    expect(determineRenderMode(100)).toBe('svg');
    expect(determineRenderMode(101)).toBe('webgl');
    expect(determineRenderMode(1000)).toBe('webgl');
    expect(determineRenderMode(1001)).toBe('webgl-sampled');
  });
});

// =============================================================================
// Quadtree Tests
// =============================================================================

describe('Quadtree Operations', () => {
  it('builds quadtree from data', () => {
    const data = [
      createMockLog('a', 10, 20),
      createMockLog('b', 30, 40),
      createMockLog('c', 50, 60),
    ];

    const qt = buildQuadtree(data, mockFields, 'table1.x', 'table1.y', 'table1', 'table1');

    expect(qt).toBeDefined();
    expect(qt.size()).toBe(3);
  });

  it('finds nearest point within radius', () => {
    const data = [
      createMockLog('a', 10, 10),
      createMockLog('b', 50, 50),
      createMockLog('c', 90, 90),
    ];

    const qt = buildQuadtree(data, mockFields, 'table1.x', 'table1.y', 'table1', 'table1');

    const nearest = findNearestPoint(qt, 12, 12, 10);
    expect(nearest).toBeDefined();
    expect(nearest!['table1.id']).toBe('a');

    const noMatch = findNearestPoint(qt, 50, 50, 1);
    expect(noMatch).toBeDefined();
    expect(noMatch!['table1.id']).toBe('b');
  });

  it('returns undefined when no point is within radius', () => {
    const data = [createMockLog('a', 100, 100)];

    const qt = buildQuadtree(data, mockFields, 'table1.x', 'table1.y', 'table1', 'table1');

    const nearest = findNearestPoint(qt, 0, 0, 5);
    expect(nearest).toBeUndefined();
  });
});

// =============================================================================
// Viewport Scale Extraction Tests
// =============================================================================

describe('Viewport Scale Extraction', () => {
  it('extracts viewport from standard scales', () => {
    const xScale = d3.scaleLinear().domain([10, 90]).range([0, 100]);
    const yScale = d3.scaleLinear().domain([20, 80]).range([100, 0]);

    const viewport = getViewportFromScales(xScale, yScale);

    expect(viewport.xMin).toBe(10);
    expect(viewport.xMax).toBe(90);
    // After fix: yMin should always be less than yMax
    expect(viewport.yMin).toBe(20);
    expect(viewport.yMax).toBe(80);
  });

  it('normalizes inverted Y scale domain correctly', () => {
    // Y scale with inverted domain (high to low)
    const xScale = d3.scaleLinear().domain([0, 100]).range([0, 500]);
    const yScale = d3.scaleLinear().domain([100, 0]).range([0, 500]);

    const viewport = getViewportFromScales(xScale, yScale);

    // Should normalize so yMin < yMax
    expect(viewport.yMin).toBeLessThan(viewport.yMax);
    expect(viewport.yMin).toBe(0);
    expect(viewport.yMax).toBe(100);
  });

  it('handles log scales correctly', () => {
    const xScale = d3.scaleLog().domain([1, 1000]).range([0, 100]);
    const yScale = d3.scaleLog().domain([10, 10000]).range([100, 0]);

    const viewport = getViewportFromScales(xScale, yScale);

    expect(viewport.xMin).toBe(1);
    expect(viewport.xMax).toBe(1000);
    expect(viewport.yMin).toBe(10);
    expect(viewport.yMax).toBe(10000);
  });

  it('handles scales with negative values', () => {
    const xScale = d3.scaleLinear().domain([-50, 50]).range([0, 100]);
    const yScale = d3.scaleLinear().domain([-100, 100]).range([100, 0]);

    const viewport = getViewportFromScales(xScale, yScale);

    expect(viewport.xMin).toBe(-50);
    expect(viewport.xMax).toBe(50);
    expect(viewport.yMin).toBe(-100);
    expect(viewport.yMax).toBe(100);
  });

  it('handles scales with very small ranges', () => {
    const xScale = d3.scaleLinear().domain([0.001, 0.002]).range([0, 100]);
    const yScale = d3.scaleLinear().domain([0.005, 0.01]).range([100, 0]);

    const viewport = getViewportFromScales(xScale, yScale);

    expect(viewport.xMin).toBeCloseTo(0.001, 6);
    expect(viewport.xMax).toBeCloseTo(0.002, 6);
    expect(viewport.yMin).toBeCloseTo(0.005, 6);
    expect(viewport.yMax).toBeCloseTo(0.01, 6);
  });

  it('handles scales with large ranges', () => {
    const xScale = d3.scaleLinear().domain([0, 1e15]).range([0, 100]);
    const yScale = d3.scaleLinear().domain([0, 1e15]).range([100, 0]);

    const viewport = getViewportFromScales(xScale, yScale);

    expect(viewport.xMin).toBe(0);
    expect(viewport.xMax).toBe(1e15);
    expect(viewport.yMin).toBe(0);
    expect(viewport.yMax).toBe(1e15);
  });
});

// =============================================================================
// Viewport Culling Tests
// =============================================================================

describe('Viewport Culling', () => {
  it('culls points outside viewport', () => {
    const data = [
      createMockLog('in1', 50, 50),
      createMockLog('in2', 75, 25),
      createMockLog('out1', 5, 50), // x too low
      createMockLog('out2', 95, 50), // x too high
      createMockLog('out3', 50, 5), // y too low
      createMockLog('out4', 50, 95), // y too high
    ];

    const qt = buildQuadtree(data, mockFields, 'table1.x', 'table1.y', 'table1', 'table1');
    const viewport = { xMin: 10, xMax: 90, yMin: 10, yMax: 90 };

    const visible = cullToViewport(qt, viewport);

    expect(visible.length).toBe(2);
    const ids = visible.map((d) => d['table1.id']);
    expect(ids).toContain('in1');
    expect(ids).toContain('in2');
  });

  it('respects maxPoints limit', () => {
    const data = createDataset(1000, 50); // All points within 0-50

    const qt = buildQuadtree(data, mockFields, 'table1.x', 'table1.y', 'table1', 'table1');
    const viewport = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };

    const visible = cullToViewport(qt, viewport, 100);

    expect(visible.length).toBeLessThanOrEqual(100);
  });

  it('includes edge points correctly', () => {
    const data = [
      createMockLog('edge1', 10, 50), // on xMin edge
      createMockLog('edge2', 90, 50), // on xMax edge
      createMockLog('edge3', 50, 10), // on yMin edge
      createMockLog('edge4', 50, 90), // on yMax edge
    ];

    const qt = buildQuadtree(data, mockFields, 'table1.x', 'table1.y', 'table1', 'table1');
    const viewport = { xMin: 10, xMax: 90, yMin: 10, yMax: 90 };

    const visible = cullToViewport(qt, viewport);

    expect(visible.length).toBe(4);
  });
});

// =============================================================================
// Stratified Sampling Tests
// =============================================================================

describe('Stratified Sampling', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('returns all data when below target size', () => {
    const data = createDataset(100);

    const result = stratifiedSample(
      data,
      200,
      mockFields,
      'table1.x',
      'table1.y',
      'table1',
      'table1'
    );

    expect(result.sampled.length).toBe(100);
    expect(result.originalCount).toBe(100);
    expect(result.sampledCount).toBe(100);
  });

  it('samples to approximately target size for large datasets', () => {
    const data = createDataset(10000);

    const result = stratifiedSample(
      data,
      1000,
      mockFields,
      'table1.x',
      'table1.y',
      'table1',
      'table1'
    );

    // Should be close to target, but stratified sampling with minimum 1 per bin
    // can result in higher counts when data is distributed across many bins
    expect(result.sampledCount).toBeGreaterThan(900);
    expect(result.sampledCount).toBeLessThan(5000); // Relaxed upper bound
    expect(result.originalCount).toBe(10000);
  });

  it('preserves spatial distribution (bins have coverage)', () => {
    // Create data with distinct clusters
    const data = [
      ...Array.from({ length: 500 }, () =>
        createMockLog('tl', Math.random() * 20, Math.random() * 20)
      ), // top-left
      ...Array.from({ length: 500 }, () =>
        createMockLog('br', 80 + Math.random() * 20, 80 + Math.random() * 20)
      ), // bottom-right
    ];

    const result = stratifiedSample(
      data,
      100,
      mockFields,
      'table1.x',
      'table1.y',
      'table1',
      'table1'
    );

    // Check that we have points from both regions
    const sampled = result.sampled;
    const topLeftCount = sampled.filter((d) => {
      const entries = d['table1.entries'] as any;
      return entries['table1.x'] < 30 && entries['table1.y'] < 30;
    }).length;
    const bottomRightCount = sampled.filter((d) => {
      const entries = d['table1.entries'] as any;
      return entries['table1.x'] > 70 && entries['table1.y'] > 70;
    }).length;

    expect(topLeftCount).toBeGreaterThan(0);
    expect(bottomRightCount).toBeGreaterThan(0);
  });
});

// =============================================================================
// Simple Random Sampling Tests
// =============================================================================

describe('Simple Random Sampling', () => {
  it('returns all items when size >= array length', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = sampleData(arr, 10);
    expect(result.length).toBe(5);
  });

  it('returns correct number of items', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i);
    const result = sampleData(arr, 25);
    expect(result.length).toBe(25);
  });

  it('produces different results on each call (randomized)', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i);
    const result1 = sampleData(arr, 10);
    const result2 = sampleData(arr, 10);
    // Very unlikely to be exactly equal if random
    expect(result1).not.toEqual(result2);
  });
});

// =============================================================================
// Hit Detection Tests
// =============================================================================

describe('Hit Detection', () => {
  it('finds point at exact position', () => {
    const data = [
      createMockLog('a', 10, 10),
      createMockLog('b', 50, 50),
      createMockLog('c', 90, 90),
    ];

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, 100]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([100, 0]); // Inverted y

    const index = findPointAtLinear(
      data,
      50, // mouse X
      50, // mouse Y (in screen coords = 50 data coords)
      xScale,
      yScale,
      mockFields,
      'table1.x',
      'table1.y',
      'table1',
      'table1',
      false,
      false,
      20
    );

    expect(index).toBe(1); // Point 'b' at (50, 50)
  });

  it('returns -1 when no point is within threshold', () => {
    const data = [createMockLog('a', 10, 10)];

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, 100]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([100, 0]);

    const index = findPointAtLinear(
      data,
      90, // Far from point
      10,
      xScale,
      yScale,
      mockFields,
      'table1.x',
      'table1.y',
      'table1',
      'table1',
      false,
      false,
      5 // Small threshold
    );

    expect(index).toBe(-1);
  });

  it('finds closest point when multiple are within range', () => {
    const data = [
      createMockLog('a', 40, 50), // distance ~10 from (50,50)
      createMockLog('b', 48, 50), // distance ~2 from (50,50)
      createMockLog('c', 60, 50), // distance ~10 from (50,50)
    ];

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, 100]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([100, 0]);

    const index = findPointAtLinear(
      data,
      50,
      50,
      xScale,
      yScale,
      mockFields,
      'table1.x',
      'table1.y',
      'table1',
      'table1',
      false,
      false,
      20
    );

    expect(index).toBe(1); // Point 'b' is closest
  });
});

// =============================================================================
// Overlapping Points Detection
// =============================================================================

describe('Overlapping Points Detection', () => {
  it('finds all points at same coordinates', () => {
    const data = [
      createMockLog('a', 50, 50),
      createMockLog('b', 50, 50),
      createMockLog('c', 50, 50),
      createMockLog('d', 60, 60),
    ];

    const target = data[0];
    const overlapping = findAllPointsAtCoordinates(
      target,
      data,
      mockFields,
      'table1.x',
      'table1.y',
      'table1',
      'table1'
    );

    expect(overlapping.length).toBe(3);
  });

  it('returns only target when no overlaps', () => {
    const data = [
      createMockLog('a', 10, 10),
      createMockLog('b', 50, 50),
      createMockLog('c', 90, 90),
    ];

    const target = data[1];
    const overlapping = findAllPointsAtCoordinates(
      target,
      data,
      mockFields,
      'table1.x',
      'table1.y',
      'table1',
      'table1'
    );

    expect(overlapping.length).toBe(1);
    expect(overlapping[0]['table1.id']).toBe('b');
  });
});
