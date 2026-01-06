import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  buildPlotDataItem, 
  getUsedTableNames,
  convertMetricsToDataLabels,
  convertMetricsToGroupedDataLabels,
} from '@/utils/data/buildPlotDataItem';
import {
  TileData,
  LogsActions,
  TilePosition,
} from '@/types/interfaces/grid';
import {
  LogFieldsResponseProps,
  PlotArguments,
} from '@/types/interfaces/logs';

const makePosition = (): TilePosition => ({ x: 0, y: 0, width: 4, height: 4 });

// Mock fetch globally for these tests since buildPlotDataItem uses relative URLs
// which don't work in Node.js without a base URL
const mockFetch = vi.fn();

// Dummy logsActions - not used by implementation but required by type
const dummyLogsActions = {
  get: vi.fn(),
  getMetrics: vi.fn(),
} as unknown as LogsActions;

describe('buildPlotDataItem', () => {
  const baseFields: LogFieldsResponseProps = {
    'entries/val': {
      data_type: 'float',
      field_type: 'entry',
      artifacts: '',
      mutable: 'false',
      created_at: '',
    },
  };

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getUsedTableNames extracts table names from axis and group settings', () => {
    const plotTile: TileData = {
      id: 'plot-1',
      name: 'Plot 1',
      type: 'Plot',
      position: makePosition(),
      plot_tile: {
        x_axis: 'TableA.col1',
        y_axis: 'TableB.col2',
        plot_group_by: 'TableA.col3',
      },
    };

    const names = getUsedTableNames(plotTile);
    expect(names).toContain('TableA');
    expect(names).toContain('TableB');
    expect(names).toHaveLength(2); // Unique names
  });

  it('buildPlotDataItem returns empty structure if no tables are used', async () => {
    const plotTile: TileData = {
      id: 'plot-empty',
      name: 'Empty Plot',
      type: 'Plot',
      position: makePosition(),
      plot_tile: {}, // No axes configured
    };

    const result = await buildPlotDataItem(
      plotTile,
      [],
      {},
      [],
      'proj-1',
      dummyLogsActions
    );

    expect(result.plotLogs).toEqual([]);
    expect(result.plotFields).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled(); // No fetch when no tables
  });

  it('buildPlotDataItem returns merged logs from used tables', async () => {
    const plotTile: TileData = {
      id: 'plot-1',
      name: 'Plot 1',
      type: 'Plot',
      position: makePosition(),
      plot_tile: {
        x_axis: 'TableA.x',
        y_axis: 'TableA.y',
      },
    };

    const tableTiles: TileData[] = [
      {
        id: 'table-a',
        name: 'TableA',
        type: 'Table',
        position: makePosition(),
      },
    ];

    const plotArguments: PlotArguments = {
      TableA: {
        subset: 'x&y',
      } as any,
    };

    // Mock successful fetch response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        logs: [
          { type: 'ungrouped', id: 1, entries: { x: 1, y: 10 }, params: {} },
          { type: 'ungrouped', id: 2, entries: { x: 2, y: 20 }, params: {} },
        ],
        count: 2,
        params: {},
        groups: [],
      }),
    });

    const result = await buildPlotDataItem(
      plotTile,
      tableTiles,
      plotArguments,
      [baseFields], // Fields for TableA
      'proj-1',
      dummyLogsActions
    );

    // Verify fetch was called with correct URL pattern
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('/api/logs');
    expect(fetchUrl).toContain('project=proj-1');
    expect(fetchUrl).toContain('from_fields=x%26y'); // URL encoded

    expect(result.plotLogs).toHaveLength(2);
    const log1 = result.plotLogs[0] as any;
    expect(log1['TableA.entries']).toBeDefined();
    expect(log1['TableA.entries']['TableA.x']).toBe(1);
    expect(log1['TableA.entries']['TableA.y']).toBe(10);
    
    expect(result.plotFields).toHaveProperty('TableA.entries/val');
  });

  it('buildPlotDataItem handles aggregated metrics from API', async () => {
    const plotTile: TileData = {
      id: 'plot-agg',
      name: 'Agg Plot',
      type: 'Plot',
      position: makePosition(),
      plot_tile: {
        x_axis: 'TableA.x',
        y_axis: 'TableA.y',
        plot_group_by: 'TableA.g',
        plot_aggregate: 'TableA.g', // Trigger aggregation path
      },
    };

    const tableTiles: TileData[] = [
      {
        id: 'table-a',
        name: 'TableA',
        type: 'Table',
        position: makePosition(),
        context: 'test-context',
      },
    ];

    const plotArguments: PlotArguments = {
      TableA: {
        grouping: 'g',
        metric: 'mean',
      } as any,
    };

    // Mock metrics endpoint response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'group1': {
          mean: 50,
          count: 10,
        },
        'group2': {
          mean: 75,
          count: 5,
        }
      }),
    });

    const result = await buildPlotDataItem(
      plotTile,
      tableTiles,
      plotArguments,
      [baseFields],
      'proj-1',
      dummyLogsActions
    );

    // Verify fetch was called with metrics endpoint
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('/api/logs/mean'); // metric name in URL

    expect(result).toBeDefined();
    expect(result.plotLogs).toBeDefined();
  });

  it('buildPlotDataItem handles API failures gracefully', async () => {
    const plotTile: TileData = {
      id: 'plot-error',
      name: 'Error Plot',
      type: 'Plot',
      position: makePosition(),
      plot_tile: {
        x_axis: 'TableA.x',
        y_axis: 'TableA.y',
      },
    };

    const tableTiles: TileData[] = [
      {
        id: 'table-a',
        name: 'TableA',
        type: 'Table',
        position: makePosition(),
      },
    ];

    const plotArguments: PlotArguments = {
      TableA: {
        subset: 'x&y',
      } as any,
    };

    // Mock API to return error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'API Error' }),
    });

    await expect(buildPlotDataItem(
      plotTile,
      tableTiles,
      plotArguments,
      [baseFields],
      'proj-1',
      dummyLogsActions
    )).rejects.toThrow('Failed to fetch plot logs: 500');
  });

  it('buildPlotDataItem handles network failures', async () => {
    const plotTile: TileData = {
      id: 'plot-network-error',
      name: 'Network Error Plot',
      type: 'Plot',
      position: makePosition(),
      plot_tile: {
        x_axis: 'TableA.x',
        y_axis: 'TableA.y',
      },
    };

    const tableTiles: TileData[] = [
      {
        id: 'table-a',
        name: 'TableA',
        type: 'Table',
        position: makePosition(),
      },
    ];

    const plotArguments: PlotArguments = {
      TableA: {
        subset: 'x&y',
      } as any,
    };

    // Mock network error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(buildPlotDataItem(
      plotTile,
      tableTiles,
      plotArguments,
      [baseFields],
      'proj-1',
      dummyLogsActions
    )).rejects.toThrow('Network error');
  });
});

describe('convertMetricsToDataLabels', () => {
  it('converts backend metrics response to DataLabel array', () => {
    const metricsResponse = {
      'sales': {
        'CategoryA': { mean: 42.5, count: 10 },
        'CategoryB': { mean: 31.2, count: 5 },
        'CategoryC': { mean: 55.8, count: 8 },
      },
    };

    const result = convertMetricsToDataLabels(metricsResponse, 'sales', 'mean');

    expect(result).toHaveLength(3);
    expect(result).toContainEqual(['CategoryA', 42.5]);
    expect(result).toContainEqual(['CategoryB', 31.2]);
    expect(result).toContainEqual(['CategoryC', 55.8]);
  });

  it('uses shared_value when present', () => {
    const metricsResponse = {
      'sales': {
        'CategoryA': { mean: 42.5, shared_value: 100 },
        'CategoryB': { mean: 31.2, shared_value: null },
      },
    };

    const result = convertMetricsToDataLabels(metricsResponse, 'sales', 'mean');

    expect(result).toContainEqual(['CategoryA', 100]); // Uses shared_value
    expect(result).toContainEqual(['CategoryB', 31.2]); // Falls back to metric
  });

  it('returns empty array for missing field', () => {
    const metricsResponse = {
      'other_field': {
        'CategoryA': { mean: 42.5 },
      },
    };

    const result = convertMetricsToDataLabels(metricsResponse, 'sales', 'mean');

    expect(result).toEqual([]);
  });

  it('handles zero values correctly', () => {
    const metricsResponse = {
      'sales': {
        'CategoryA': { mean: 0 },
        'CategoryB': { mean: 42.5 },
      },
    };

    const result = convertMetricsToDataLabels(metricsResponse, 'sales', 'mean');

    expect(result).toContainEqual(['CategoryA', 0]);
    expect(result).toContainEqual(['CategoryB', 42.5]);
  });
});

describe('convertMetricsToGroupedDataLabels', () => {
  it('converts nested backend metrics to GroupedDataLabel array', () => {
    const metricsResponse = {
      'sales': {
        'GroupA': {
          'Cat1': { mean: 10 },
          'Cat2': { mean: 20 },
        },
        'GroupB': {
          'Cat1': { mean: 15 },
          'Cat2': { mean: 25 },
        },
      },
    };

    const result = convertMetricsToGroupedDataLabels(metricsResponse, 'sales', 'mean');

    expect(result).toHaveLength(4);
    expect(result).toContainEqual(['GroupA', ['Cat1', 10]]);
    expect(result).toContainEqual(['GroupA', ['Cat2', 20]]);
    expect(result).toContainEqual(['GroupB', ['Cat1', 15]]);
    expect(result).toContainEqual(['GroupB', ['Cat2', 25]]);
  });

  it('uses shared_value when present in nested structure', () => {
    const metricsResponse = {
      'sales': {
        'GroupA': {
          'Cat1': { mean: 10, shared_value: 100 },
        },
      },
    };

    const result = convertMetricsToGroupedDataLabels(metricsResponse, 'sales', 'mean');

    expect(result).toContainEqual(['GroupA', ['Cat1', 100]]);
  });

  it('returns empty array for missing field', () => {
    const metricsResponse = {
      'other_field': {
        'GroupA': {
          'Cat1': { mean: 10 },
        },
      },
    };

    const result = convertMetricsToGroupedDataLabels(metricsResponse, 'sales', 'mean');

    expect(result).toEqual([]);
  });

  it('handles single group with multiple categories', () => {
    const metricsResponse = {
      'sales': {
        'OnlyGroup': {
          'A': { sum: 100 },
          'B': { sum: 200 },
          'C': { sum: 300 },
        },
      },
    };

    const result = convertMetricsToGroupedDataLabels(metricsResponse, 'sales', 'sum');

    expect(result).toHaveLength(3);
    expect(result.every(r => r[0] === 'OnlyGroup')).toBe(true);
  });
});
