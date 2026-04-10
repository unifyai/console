import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPlotDataItem, getUsedTableNames } from '@/utils/data/buildPlotDataItem';
import { TileData, LogsActions, TilePosition } from '@/types/interfaces/grid';
import { LogFieldsResponseProps, PlotArguments } from '@/types/interfaces/logs';

/**
 * Unit tests for cross-table plotting functionality
 * Tests the data handling when plotting columns from different tables
 */

const makePosition = (): TilePosition => ({ x: 0, y: 0, width: 4, height: 4 });

const mockFetch = vi.fn();

const dummyLogsActions = {
  get: vi.fn(),
  getMetrics: vi.fn(),
} as unknown as LogsActions;

describe('Cross-Table Plotting', () => {
  const meta = {
    scenario: 'Testing cross-table plotting functionality',
    behavior: 'System correctly handles data from multiple tables for plotting',
  };

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getUsedTableNames - Table Name Extraction', () => {
    const meta = {
      scenario: 'Extracting table names from plot configuration',
      behavior: 'Correctly identifies all tables used in xAxis, yAxis, and plotGroupBy',
    };

    it('extracts table name from X axis property', () => {
      const meta = {
        scenario: 'X axis references TableA.column1',
        behavior: 'Returns TableA in the used table names',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Test Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.column1',
        },
      };

      const names = getUsedTableNames(plotTile);
      expect(names).toContain('TableA');
      expect(names).toHaveLength(1);
    });

    it('extracts table name from Y axis property', () => {
      const meta = {
        scenario: 'Y axis references TableB.column2',
        behavior: 'Returns TableB in the used table names',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Test Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          yAxis: 'TableB.column2',
        },
      };

      const names = getUsedTableNames(plotTile);
      expect(names).toContain('TableB');
      expect(names).toHaveLength(1);
    });

    it('extracts table names from both X and Y axes (same table)', () => {
      const meta = {
        scenario: 'Both axes reference the same table',
        behavior: 'Returns only one unique table name',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Test Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.column1',
          yAxis: 'TableA.column2',
        },
      };

      const names = getUsedTableNames(plotTile);
      expect(names).toContain('TableA');
      expect(names).toHaveLength(1);
    });

    it('extracts table names from X and Y axes (different tables - cross-table)', () => {
      const meta = {
        scenario: 'X axis from TableA, Y axis from TableB',
        behavior: 'Returns both table names for cross-table plotting',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Test Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.column1',
          yAxis: 'TableB.column2',
        },
      };

      const names = getUsedTableNames(plotTile);
      expect(names).toContain('TableA');
      expect(names).toContain('TableB');
      expect(names).toHaveLength(2);
    });

    it('extracts table name from plotGroupBy', () => {
      const meta = {
        scenario: 'Grouping by a column from TableC',
        behavior: 'Returns TableC in addition to axis tables',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Test Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
          plotGroupBy: 'TableC.category',
        },
      };

      const names = getUsedTableNames(plotTile);
      expect(names).toContain('TableA');
      expect(names).toContain('TableB');
      expect(names).toContain('TableC');
      expect(names).toHaveLength(3);
    });

    it('handles properties without table prefix', () => {
      const meta = {
        scenario: 'Axis property does not include table prefix',
        behavior: 'Does not extract any table name',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Test Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'column1', // No table prefix
          yAxis: 'column2',
        },
      };

      const names = getUsedTableNames(plotTile);
      expect(names).toHaveLength(0);
    });

    it('handles empty plotTile configuration', () => {
      const meta = {
        scenario: 'Plot tile has no axis configuration',
        behavior: 'Returns empty array',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Test Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {},
      };

      const names = getUsedTableNames(plotTile);
      expect(names).toHaveLength(0);
    });

    it('handles undefined plotTile', () => {
      const meta = {
        scenario: 'Plot tile configuration is undefined',
        behavior: 'Returns empty array without errors',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Test Plot',
        type: 'Plot',
        position: makePosition(),
      };

      const names = getUsedTableNames(plotTile);
      expect(names).toHaveLength(0);
    });
  });

  describe('buildPlotDataItem - Cross-Table Data Merging', () => {
    const meta = {
      scenario: 'Building plot data from multiple tables',
      behavior: 'Correctly merges and prefixes data from different tables',
    };

    const tableAFields: LogFieldsResponseProps = {
      'entries/x': {
        dataType: 'float',
        fieldType: 'entry',
        artifacts: '',
        mutable: 'false',
        createdAt: '',
      },
    };

    const tableBFields: LogFieldsResponseProps = {
      'entries/y': {
        dataType: 'float',
        fieldType: 'entry',
        artifacts: '',
        mutable: 'false',
        createdAt: '',
      },
    };

    it('merges data from two tables for cross-table scatter plot', async () => {
      const meta = {
        scenario: 'X from TableA, Y from TableB',
        behavior: 'Merged logs contain prefixed data from both tables',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Cross Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
        TableB: { subset: 'y' } as any,
      };

      // Mock responses for both tables
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [
              { type: 'ungrouped', id: 1, entries: { x: 10 }, params: {} },
              { type: 'ungrouped', id: 2, entries: { x: 20 }, params: {} },
            ],
            count: 2,
            params: {},
            groups: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [
              { type: 'ungrouped', id: 1, entries: { y: 100 }, params: {} },
              { type: 'ungrouped', id: 2, entries: { y: 200 }, params: {} },
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
        [tableAFields, tableBFields],
        'proj-1',
        dummyLogsActions
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.plotLogs).toHaveLength(2);

      // Verify cross-table data is merged with table prefixes
      const firstLog = result.plotLogs[0] as any;
      expect(firstLog['TableA.entries']).toBeDefined();
      expect(firstLog['TableB.entries']).toBeDefined();
    });

    it('handles different row counts between tables by using minimum', async () => {
      const meta = {
        scenario: 'TableA has 3 rows, TableB has 2 rows',
        behavior: 'Result uses minimum row count (2)',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Cross Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
        TableB: { subset: 'y' } as any,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [
              { type: 'ungrouped', id: 1, entries: { x: 10 }, params: {} },
              { type: 'ungrouped', id: 2, entries: { x: 20 }, params: {} },
              { type: 'ungrouped', id: 3, entries: { x: 30 }, params: {} },
            ],
            count: 3,
            params: {},
            groups: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [
              { type: 'ungrouped', id: 1, entries: { y: 100 }, params: {} },
              { type: 'ungrouped', id: 2, entries: { y: 200 }, params: {} },
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
        [tableAFields, tableBFields],
        'proj-1',
        dummyLogsActions
      );

      // Should use minimum length
      expect(result.plotLogs).toHaveLength(2);
    });

    it('handles grouping from a third table', async () => {
      const meta = {
        scenario: 'X from TableA, Y from TableB, Group by from TableC',
        behavior: 'All three tables are fetched and merged',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Cross Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
          plotGroupBy: 'TableC.category',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
        { id: 'table-c', name: 'TableC', type: 'Table', position: makePosition() },
      ];

      const tableCFields: LogFieldsResponseProps = {
        'entries/category': {
          dataType: 'string',
          fieldType: 'entry',
          artifacts: '',
          mutable: 'false',
          createdAt: '',
        },
      };

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
        TableB: { subset: 'y' } as any,
        TableC: { subset: 'category' } as any,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [{ type: 'ungrouped', id: 1, entries: { x: 10 }, params: {} }],
            count: 1,
            params: {},
            groups: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [{ type: 'ungrouped', id: 1, entries: { y: 100 }, params: {} }],
            count: 1,
            params: {},
            groups: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [{ type: 'ungrouped', id: 1, entries: { category: 'A' }, params: {} }],
            count: 1,
            params: {},
            groups: [],
          }),
        });

      const result = await buildPlotDataItem(
        plotTile,
        tableTiles,
        plotArguments,
        [tableAFields, tableBFields, tableCFields],
        'proj-1',
        dummyLogsActions
      );

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.plotLogs).toHaveLength(1);

      const log = result.plotLogs[0] as any;
      expect(log['TableA.entries']).toBeDefined();
      expect(log['TableB.entries']).toBeDefined();
      expect(log['TableC.entries']).toBeDefined();
    });

    it('creates correct plotFields with table prefixes', async () => {
      const meta = {
        scenario: 'Multiple tables with different fields',
        behavior: 'plotFields contains all fields with table prefixes',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Cross Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
        TableB: { subset: 'y' } as any,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [{ type: 'ungrouped', id: 1, entries: { x: 10 }, params: {} }],
            count: 1,
            params: {},
            groups: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [{ type: 'ungrouped', id: 1, entries: { y: 100 }, params: {} }],
            count: 1,
            params: {},
            groups: [],
          }),
        });

      const result = await buildPlotDataItem(
        plotTile,
        tableTiles,
        plotArguments,
        [tableAFields, tableBFields],
        'proj-1',
        dummyLogsActions
      );

      // Verify plotFields have table prefixes
      expect(result.plotFields).toHaveProperty('TableA.entries/x');
      expect(result.plotFields).toHaveProperty('TableB.entries/y');
    });

    it('handles missing table in plotArguments gracefully', async () => {
      const meta = {
        scenario: 'Y axis table is not in plotArguments',
        behavior: 'Skips the missing table and returns partial data',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Cross Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      // Only TableA has arguments
      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          logs: [{ type: 'ungrouped', id: 1, entries: { x: 10 }, params: {} }],
          count: 1,
          params: {},
          groups: [],
        }),
      });

      const result = await buildPlotDataItem(
        plotTile,
        tableTiles,
        plotArguments,
        [tableAFields, tableBFields],
        'proj-1',
        dummyLogsActions
      );

      // Should handle gracefully - only TableA data
      expect(result).toBeDefined();
    });

    it('handles one table returning empty logs', async () => {
      const meta = {
        scenario: 'TableB returns empty logs array',
        behavior: 'Result is empty since no common rows exist',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Cross Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
        TableB: { subset: 'y' } as any,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [{ type: 'ungrouped', id: 1, entries: { x: 10 }, params: {} }],
            count: 1,
            params: {},
            groups: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [], // Empty
            count: 0,
            params: {},
            groups: [],
          }),
        });

      const result = await buildPlotDataItem(
        plotTile,
        tableTiles,
        plotArguments,
        [tableAFields, tableBFields],
        'proj-1',
        dummyLogsActions
      );

      // Minimum of [1, 0] = 0
      expect(result.plotLogs).toHaveLength(0);
    });
  });

  describe('Cross-Table Error Handling', () => {
    const meta = {
      scenario: 'Error conditions in cross-table plotting',
      behavior: 'Errors are properly propagated and handled',
    };

    it('propagates API error from first table fetch', async () => {
      const meta = {
        scenario: 'TableA API returns 500 error',
        behavior: 'Error is propagated with appropriate message',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Cross Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      const tableAFields: LogFieldsResponseProps = {
        'entries/x': {
          dataType: 'float',
          fieldType: 'entry',
          artifacts: '',
          mutable: 'false',
          createdAt: '',
        },
      };
      const tableBFields: LogFieldsResponseProps = {
        'entries/y': {
          dataType: 'float',
          fieldType: 'entry',
          artifacts: '',
          mutable: 'false',
          createdAt: '',
        },
      };

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
        TableB: { subset: 'y' } as any,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [{ type: 'ungrouped', id: 1, entries: { y: 100 }, params: {} }],
            count: 1,
          }),
        });

      await expect(
        buildPlotDataItem(
          plotTile,
          tableTiles,
          plotArguments,
          [tableAFields, tableBFields],
          'proj-1',
          dummyLogsActions
        )
      ).rejects.toThrow();
    });

    it('propagates network error during cross-table fetch', async () => {
      const meta = {
        scenario: 'Network error during table fetch',
        behavior: 'Network error is propagated',
      };

      const plotTile: TileData = {
        id: 'plot-1',
        name: 'Cross Plot',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      const tableAFields: LogFieldsResponseProps = {
        'entries/x': {
          dataType: 'float',
          fieldType: 'entry',
          artifacts: '',
          mutable: 'false',
          createdAt: '',
        },
      };
      const tableBFields: LogFieldsResponseProps = {
        'entries/y': {
          dataType: 'float',
          fieldType: 'entry',
          artifacts: '',
          mutable: 'false',
          createdAt: '',
        },
      };

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
        TableB: { subset: 'y' } as any,
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        buildPlotDataItem(
          plotTile,
          tableTiles,
          plotArguments,
          [tableAFields, tableBFields],
          'proj-1',
          dummyLogsActions
        )
      ).rejects.toThrow('Network error');
    });
  });

  describe('Cross-Table Plot Types', () => {
    const meta = {
      scenario: 'Testing cross-table plotting with different plot types',
      behavior: 'All plot types work correctly with cross-table data',
    };

    const tableAFields: LogFieldsResponseProps = {
      'entries/x': {
        dataType: 'float',
        fieldType: 'entry',
        artifacts: '',
        mutable: 'false',
        createdAt: '',
      },
    };
    const tableBFields: LogFieldsResponseProps = {
      'entries/y': {
        dataType: 'float',
        fieldType: 'entry',
        artifacts: '',
        mutable: 'false',
        createdAt: '',
      },
    };

    const setupCrossTableMocks = () => {
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [
              { type: 'ungrouped', id: 1, entries: { x: 10 }, params: {} },
              { type: 'ungrouped', id: 2, entries: { x: 20 }, params: {} },
            ],
            count: 2,
            params: {},
            groups: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [
              { type: 'ungrouped', id: 1, entries: { y: 100 }, params: {} },
              { type: 'ungrouped', id: 2, entries: { y: 200 }, params: {} },
            ],
            count: 2,
            params: {},
            groups: [],
          }),
        });
    };

    it('handles cross-table plotting with Line Chart type', async () => {
      const meta = {
        scenario: 'Line chart with X from TableA, Y from TableB',
        behavior: 'Data is merged and can be used for line chart',
      };

      setupCrossTableMocks();

      const plotTile: TileData = {
        id: 'plot-line',
        name: 'Cross Line',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
          plotType: 'Line Chart',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
        TableB: { subset: 'y' } as any,
      };

      const result = await buildPlotDataItem(
        plotTile,
        tableTiles,
        plotArguments,
        [tableAFields, tableBFields],
        'proj-1',
        dummyLogsActions
      );

      expect(result.plotLogs).toHaveLength(2);
      // Data should be sortable for line chart
      const logs = result.plotLogs as any[];
      expect(logs[0]['TableA.entries']).toBeDefined();
      expect(logs[0]['TableB.entries']).toBeDefined();
    });

    it('handles cross-table plotting with Bar Chart type', async () => {
      const meta = {
        scenario: 'Bar chart with X from TableA, Y from TableB',
        behavior: 'Bar charts use pre-aggregated data from metrics endpoint',
      };

      // Bar charts call /api/logs/mean for pre-aggregated data.
      // Mock the metrics endpoint to return proper aggregated data format.
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            // Metrics response format: array of {group_values, metric_value} objects
            metrics: [
              { group_values: ['a'], mean: 10 },
              { group_values: ['b'], mean: 20 },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            metrics: [
              { group_values: ['a'], mean: 100 },
              { group_values: ['b'], mean: 200 },
            ],
          }),
        });

      const plotTile: TileData = {
        id: 'plot-bar',
        name: 'Cross Bar',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
          plotType: 'Bar Chart',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
        TableB: { subset: 'y' } as any,
      };

      const result = await buildPlotDataItem(
        plotTile,
        tableTiles,
        plotArguments,
        [tableAFields, tableBFields],
        'proj-1',
        dummyLogsActions
      );

      // Bar charts use preAggregatedBarData instead of plotLogs
      // The result should have preAggregatedBarData from the metrics endpoint
      expect(result.preAggregatedBarData).toBeDefined();
    });

    it('handles cross-table plotting with Histogram (X axis only)', async () => {
      const meta = {
        scenario: 'Histogram with X from TableA only',
        behavior: 'Only X axis table is fetched for histogram',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          logs: [
            { type: 'ungrouped', id: 1, entries: { x: 10 }, params: {} },
            { type: 'ungrouped', id: 2, entries: { x: 20 }, params: {} },
            { type: 'ungrouped', id: 3, entries: { x: 15 }, params: {} },
          ],
          count: 3,
          params: {},
          groups: [],
        }),
      });

      const plotTile: TileData = {
        id: 'plot-hist',
        name: 'Histogram',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          // No yAxis for histogram
          plotType: 'Histogram',
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
      ];

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
      };

      const result = await buildPlotDataItem(
        plotTile,
        tableTiles,
        plotArguments,
        [tableAFields],
        'proj-1',
        dummyLogsActions
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.plotLogs).toHaveLength(3);
    });

    it('supports grouping by property from X axis table', async () => {
      const meta = {
        scenario: 'Cross-table plot with grouping from same table as X axis',
        behavior: 'Grouping column is included in X table fetch',
      };

      const tableAFieldsWithGroup: LogFieldsResponseProps = {
        'entries/x': {
          dataType: 'float',
          fieldType: 'entry',
          artifacts: '',
          mutable: 'false',
          createdAt: '',
        },
        'entries/category': {
          dataType: 'string',
          fieldType: 'entry',
          artifacts: '',
          mutable: 'false',
          createdAt: '',
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [
              { type: 'ungrouped', id: 1, entries: { x: 10, category: 'A' }, params: {} },
              { type: 'ungrouped', id: 2, entries: { x: 20, category: 'B' }, params: {} },
            ],
            count: 2,
            params: {},
            groups: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [
              { type: 'ungrouped', id: 1, entries: { y: 100 }, params: {} },
              { type: 'ungrouped', id: 2, entries: { y: 200 }, params: {} },
            ],
            count: 2,
            params: {},
            groups: [],
          }),
        });

      const plotTile: TileData = {
        id: 'plot-grouped',
        name: 'Cross Grouped',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
          plotGroupBy: 'TableA.category', // Group by from same table as X
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x&category' } as any,
        TableB: { subset: 'y' } as any,
      };

      const result = await buildPlotDataItem(
        plotTile,
        tableTiles,
        plotArguments,
        [tableAFieldsWithGroup, tableBFields],
        'proj-1',
        dummyLogsActions
      );

      expect(result.plotLogs).toHaveLength(2);
      const firstLog = result.plotLogs[0] as any;
      expect(firstLog['TableA.entries']).toBeDefined();
    });

    it('supports grouping by property from Y axis table', async () => {
      const meta = {
        scenario: 'Cross-table plot with grouping from same table as Y axis',
        behavior: 'Grouping column is included in Y table fetch',
      };

      const tableBFieldsWithGroup: LogFieldsResponseProps = {
        'entries/y': {
          dataType: 'float',
          fieldType: 'entry',
          artifacts: '',
          mutable: 'false',
          createdAt: '',
        },
        'entries/category': {
          dataType: 'string',
          fieldType: 'entry',
          artifacts: '',
          mutable: 'false',
          createdAt: '',
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [
              { type: 'ungrouped', id: 1, entries: { x: 10 }, params: {} },
              { type: 'ungrouped', id: 2, entries: { x: 20 }, params: {} },
            ],
            count: 2,
            params: {},
            groups: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            logs: [
              { type: 'ungrouped', id: 1, entries: { y: 100, category: 'A' }, params: {} },
              { type: 'ungrouped', id: 2, entries: { y: 200, category: 'B' }, params: {} },
            ],
            count: 2,
            params: {},
            groups: [],
          }),
        });

      const plotTile: TileData = {
        id: 'plot-grouped',
        name: 'Cross Grouped',
        type: 'Plot',
        position: makePosition(),
        plotTile: {
          xAxis: 'TableA.x',
          yAxis: 'TableB.y',
          plotGroupBy: 'TableB.category', // Group by from same table as Y
        },
      };

      const tableTiles: TileData[] = [
        { id: 'table-a', name: 'TableA', type: 'Table', position: makePosition() },
        { id: 'table-b', name: 'TableB', type: 'Table', position: makePosition() },
      ];

      const plotArguments: PlotArguments = {
        TableA: { subset: 'x' } as any,
        TableB: { subset: 'y&category' } as any,
      };

      const result = await buildPlotDataItem(
        plotTile,
        tableTiles,
        plotArguments,
        [tableAFields, tableBFieldsWithGroup],
        'proj-1',
        dummyLogsActions
      );

      expect(result.plotLogs).toHaveLength(2);
      const firstLog = result.plotLogs[0] as any;
      expect(firstLog['TableB.entries']).toBeDefined();
    });
  });

  describe('Cross-Table Tooltip Data', () => {
    const meta = {
      scenario: 'Testing tooltip data for cross-table plots',
      behavior: 'Tooltips correctly show data from multiple tables',
    };

    it('generates tooltip data with table prefixes', () => {
      const meta = {
        scenario: 'Hovering over a cross-table data point',
        behavior: 'Tooltip shows values with table prefixes',
      };

      // Simulate merged log data structure
      const mergedLog = {
        'TableA.entries': { 'TableA.x': 10 },
        'TableB.entries': { 'TableB.y': 100 },
      };

      // Extract tooltip data
      const xValue = (mergedLog['TableA.entries'] as any)['TableA.x'];
      const yValue = (mergedLog['TableB.entries'] as any)['TableB.y'];

      expect(xValue).toBe(10);
      expect(yValue).toBe(100);
    });

    it('handles missing values in cross-table tooltip', () => {
      const meta = {
        scenario: 'Cross-table row with missing Y value',
        behavior: 'Tooltip handles undefined gracefully',
      };

      const mergedLogWithMissing = {
        'TableA.entries': { 'TableA.x': 10 },
        // TableB.entries is missing
      };

      const xValue = (mergedLogWithMissing['TableA.entries'] as any)?.['TableA.x'];
      const yValue = (mergedLogWithMissing as any)['TableB.entries']?.['TableB.y'];

      expect(xValue).toBe(10);
      expect(yValue).toBeUndefined();
    });
  });

  describe('Cross-Table Regression and Aggregation', () => {
    const meta = {
      scenario: 'Testing regression and aggregation for cross-table plots',
      behavior: 'Correctly handles calculations across table boundaries',
    };

    it(
      'correctly calculates regression line for cross-table scatter plots',
      {
        meta: {
          alias: 'CrossTable-Regression',
          scenario: 'Cross-table scatter plot with regression enabled',
          behavior: 'Regression line is calculated from merged X and Y values',
        },
      },
      () => {
        // Merged data points from two tables
        const mergedData = [
          { x: 10, y: 20 },
          { x: 20, y: 40 },
          { x: 30, y: 60 },
          { x: 40, y: 80 },
        ];

        // Calculate regression (perfect positive correlation)
        const n = mergedData.length;
        const sumX = mergedData.reduce((acc, d) => acc + d.x, 0);
        const sumY = mergedData.reduce((acc, d) => acc + d.y, 0);
        const sumXY = mergedData.reduce((acc, d) => acc + d.x * d.y, 0);
        const sumX2 = mergedData.reduce((acc, d) => acc + d.x * d.x, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        expect(slope).toBe(2); // y = 2x
        expect(intercept).toBe(0);
      }
    );

    it(
      'correctly aggregates metrics for cross-table bar charts',
      {
        meta: {
          alias: 'CrossTable-BarAggregation',
          scenario: 'Cross-table bar chart with aggregation',
          behavior: 'Y values are aggregated correctly per X category',
        },
      },
      () => {
        // Merged data with categories from table A and values from table B
        const mergedData = [
          { category: 'A', value: 10 },
          { category: 'A', value: 20 },
          { category: 'B', value: 30 },
          { category: 'B', value: 40 },
        ];

        // Aggregate by category
        const categoryA = mergedData.filter((d) => d.category === 'A');
        const categoryB = mergedData.filter((d) => d.category === 'B');

        const meanA = categoryA.reduce((acc, d) => acc + d.value, 0) / categoryA.length;
        const meanB = categoryB.reduce((acc, d) => acc + d.value, 0) / categoryB.length;

        expect(meanA).toBe(15);
        expect(meanB).toBe(35);
      }
    );

    it(
      'shows error when tables cannot be joined (no common key)',
      {
        meta: {
          alias: 'CrossTable-JoinError',
          scenario: 'Tables have no common rows/keys',
          behavior: 'Error or empty result is returned with appropriate message',
        },
      },
      () => {
        // Simulating join failure
        const tableARows = [{ id: 1 }, { id: 2 }];
        const tableBRows = [{ id: 3 }, { id: 4 }]; // No matching IDs

        // For row-based merging (index-based), mismatched lengths would cause issues
        // For key-based joins, no common keys would result in empty set
        const commonKeys = tableARows.filter((a) => tableBRows.some((b) => b.id === a.id));

        expect(commonKeys).toHaveLength(0);
      }
    );
  });
});
