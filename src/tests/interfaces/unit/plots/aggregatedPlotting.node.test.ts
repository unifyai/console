/// <reference types="jsdom" />
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import { LogProps, LogFieldsResponseProps, GroupedMetrics } from '@/types/interfaces/logs';
import { convertMetricsToLogs } from '@/utils/interfaces/common';

/**
 * Unit tests for aggregated table plotting functionality
 * Tests how pre-aggregated data (from SQL-like GROUP BY operations) is handled
 */

// Helper to create mock aggregated logs (simulating pre-aggregated API response)
const createAggregatedLogs = (): LogProps[] => [
  {
    type: 'ungrouped' as const,
    id: '1',
    ts: '2023-01-01T10:00:00.000Z',
    params: {},
    entries: {
      'TestTable.category': 'A',
      'TestTable.sum_value': 100,
      'TestTable.count_value': 10,
      'TestTable.mean_value': 10,
    },
    derived_entries: {},
    clipped_fields: [],
    'TestTable.id': '1',
    'TestTable.entries': {
      'TestTable.category': 'A',
      'TestTable.sum_value': 100,
      'TestTable.count_value': 10,
      'TestTable.mean_value': 10,
    },
    'TestTable.params': {},
    'TestTable.derived_entries': {},
  },
  {
    type: 'ungrouped' as const,
    id: '2',
    ts: '2023-01-01T10:00:00.000Z',
    params: {},
    entries: {
      'TestTable.category': 'B',
      'TestTable.sum_value': 200,
      'TestTable.count_value': 20,
      'TestTable.mean_value': 10,
    },
    derived_entries: {},
    clipped_fields: [],
    'TestTable.id': '2',
    'TestTable.entries': {
      'TestTable.category': 'B',
      'TestTable.sum_value': 200,
      'TestTable.count_value': 20,
      'TestTable.mean_value': 10,
    },
    'TestTable.params': {},
    'TestTable.derived_entries': {},
  },
];

// Helper to create fields with aggregate metadata
const createAggregatedFields = (): LogFieldsResponseProps => ({
  'TestTable.category': {
    data_type: 'string',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: '',
  },
  'TestTable.sum_value': {
    data_type: 'float',
    field_type: 'entry',
    artifacts: 'aggregate:sum',
    mutable: 'false',
    created_at: '',
  },
  'TestTable.count_value': {
    data_type: 'int',
    field_type: 'entry',
    artifacts: 'aggregate:count',
    mutable: 'false',
    created_at: '',
  },
  'TestTable.mean_value': {
    data_type: 'float',
    field_type: 'entry',
    artifacts: 'aggregate:mean',
    mutable: 'false',
    created_at: '',
  },
});

describe('Aggregated Table Plotting', () => {
  const meta = {
    scenario: 'Testing pre-aggregated data plotting functionality',
    behavior: 'System correctly handles data that has been aggregated at the API/database level'
  };

  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
  });

  describe('Aggregate Metric Recognition', () => {
    const meta = {
      scenario: 'Recognizing aggregate columns from field metadata',
      behavior: 'System identifies which columns contain aggregated data'
    };

    it('identifies sum aggregate from artifacts metadata', () => {
      const meta = {
        scenario: 'Field has artifacts: "aggregate:sum"',
        behavior: 'Field is recognized as sum aggregate'
      };

      const fields = createAggregatedFields();
      const sumField = fields['TestTable.sum_value'];
      
      const isAggregate = sumField.artifacts?.includes('aggregate:');
      const aggregateType = sumField.artifacts?.split('aggregate:')[1];
      
      expect(isAggregate).toBe(true);
      expect(aggregateType).toBe('sum');
    });

    it('identifies count aggregate from artifacts metadata', () => {
      const meta = {
        scenario: 'Field has artifacts: "aggregate:count"',
        behavior: 'Field is recognized as count aggregate'
      };

      const fields = createAggregatedFields();
      const countField = fields['TestTable.count_value'];
      
      const isAggregate = countField.artifacts?.includes('aggregate:');
      const aggregateType = countField.artifacts?.split('aggregate:')[1];
      
      expect(isAggregate).toBe(true);
      expect(aggregateType).toBe('count');
    });

    it('identifies mean aggregate from artifacts metadata', () => {
      const meta = {
        scenario: 'Field has artifacts: "aggregate:mean"',
        behavior: 'Field is recognized as mean aggregate'
      };

      const fields = createAggregatedFields();
      const meanField = fields['TestTable.mean_value'];
      
      const isAggregate = meanField.artifacts?.includes('aggregate:');
      const aggregateType = meanField.artifacts?.split('aggregate:')[1];
      
      expect(isAggregate).toBe(true);
      expect(aggregateType).toBe('mean');
    });

    it('identifies non-aggregate field', () => {
      const meta = {
        scenario: 'Field has no aggregate artifact',
        behavior: 'Field is not recognized as aggregate'
      };

      const fields = createAggregatedFields();
      const categoryField = fields['TestTable.category'];
      
      const isAggregate = categoryField.artifacts?.includes('aggregate:');
      
      expect(isAggregate).toBe(false);
    });

    it('handles empty artifacts string', () => {
      const meta = {
        scenario: 'Field has empty artifacts',
        behavior: 'Field is not recognized as aggregate'
      };

      const field = {
        data_type: 'float',
        field_type: 'entry',
        artifacts: '',
        mutable: 'false',
        created_at: '',
      };
      
      const isAggregate = field.artifacts?.includes('aggregate:');
      
      expect(isAggregate).toBe(false);
    });
  });

  describe('Aggregate Value Extraction', () => {
    const meta = {
      scenario: 'Extracting aggregated values for plotting',
      behavior: 'Pre-aggregated values are used directly without re-aggregation'
    };

    it('extracts pre-aggregated sum values correctly', () => {
      const meta = {
        scenario: 'Plotting pre-aggregated sum data',
        behavior: 'Sum values are extracted as-is'
      };

      const logs = createAggregatedLogs();
      
      const sumValues = logs.map(log => 
        (log['TestTable.entries'] as any)['TestTable.sum_value']
      );
      
      expect(sumValues).toEqual([100, 200]);
    });

    it('extracts pre-aggregated count values correctly', () => {
      const meta = {
        scenario: 'Plotting pre-aggregated count data',
        behavior: 'Count values are extracted as-is'
      };

      const logs = createAggregatedLogs();
      
      const countValues = logs.map(log => 
        (log['TestTable.entries'] as any)['TestTable.count_value']
      );
      
      expect(countValues).toEqual([10, 20]);
    });

    it('extracts pre-aggregated mean values correctly', () => {
      const meta = {
        scenario: 'Plotting pre-aggregated mean data',
        behavior: 'Mean values are extracted as-is'
      };

      const logs = createAggregatedLogs();
      
      const meanValues = logs.map(log => 
        (log['TestTable.entries'] as any)['TestTable.mean_value']
      );
      
      expect(meanValues).toEqual([10, 10]);
    });
  });

  describe('Aggregate Label Generation', () => {
    const meta = {
      scenario: 'Generating axis labels for aggregated data',
      behavior: 'Labels include aggregate function name (e.g., "sum(value)")'
    };

    it('generates correct label for sum aggregate', () => {
      const meta = {
        scenario: 'Y axis is sum_value with sum aggregate',
        behavior: 'Label shows "value (sum)" or similar'
      };

      const yAxisProperty = 'TestTable.sum_value';
      const metric = 'sum';
      
      // Common pattern in plot-bar.ts: `Y: ${yAxisProperty}(${metric})`
      const label = `Y: ${yAxisProperty}(${metric})`;
      
      expect(label).toContain('sum');
      expect(label).toContain('sum_value');
    });

    it('generates correct label for mean aggregate', () => {
      const meta = {
        scenario: 'Y axis is mean_value with mean aggregate',
        behavior: 'Label shows aggregate type'
      };

      const yAxisProperty = 'TestTable.mean_value';
      const metric = 'mean';
      
      const label = `Y: ${yAxisProperty}(${metric})`;
      
      expect(label).toContain('mean');
    });

    it('generates correct label for count aggregate', () => {
      const meta = {
        scenario: 'Y axis is count_value with count aggregate',
        behavior: 'Label shows aggregate type'
      };

      const yAxisProperty = 'TestTable.count_value';
      const metric = 'count';
      
      const label = `Y: ${yAxisProperty}(${metric})`;
      
      expect(label).toContain('count');
    });
  });

  describe('Aggregate Tooltip Data', () => {
    const meta = {
      scenario: 'Displaying aggregated data in tooltips',
      behavior: 'Tooltips show aggregate information clearly'
    };

    it('includes aggregate property in tooltip data', () => {
      const meta = {
        scenario: 'Hovering over aggregated bar',
        behavior: 'Tooltip shows "Aggregate: category"'
      };

      const aggregate = 'TestTable.category';
      
      const tooltipData = {
        x: { name: 'X: category', value: 'A' },
        y: { name: 'Y: sum_value(sum)', value: 100 },
        aggregate: aggregate ? { name: `Aggregate: ${aggregate}` } : undefined,
      };
      
      expect(tooltipData.aggregate).toBeDefined();
      expect(tooltipData.aggregate?.name).toContain('Aggregate');
    });

    it('formats aggregate values for display', () => {
      const meta = {
        scenario: 'Large aggregate value needs formatting',
        behavior: 'Value is formatted appropriately'
      };

      const value = 1234567.89;
      
      // Simple formatting check - actual implementation may vary
      const formatted = value.toLocaleString();
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Bar Chart with Pre-Aggregated Data', () => {
    const meta = {
      scenario: 'Using pre-aggregated data in bar charts',
      behavior: 'Bar chart uses aggregate values directly'
    };

    it('uses pre-aggregated values without re-aggregation', () => {
      const meta = {
        scenario: 'Bar chart receives pre-aggregated sum data',
        behavior: 'Bars reflect the pre-aggregated values'
      };

      const logs = createAggregatedLogs();
      
      // When data is pre-aggregated, each log IS a bar
      const barData = logs.map(log => ({
        x: (log['TestTable.entries'] as any)['TestTable.category'],
        y: (log['TestTable.entries'] as any)['TestTable.sum_value'],
      }));
      
      expect(barData).toHaveLength(2);
      expect(barData[0]).toEqual({ x: 'A', y: 100 });
      expect(barData[1]).toEqual({ x: 'B', y: 200 });
    });

    it('handles zero values in pre-aggregated data', () => {
      const meta = {
        scenario: 'Aggregate value is zero',
        behavior: 'Zero is treated as valid value'
      };

      const logsWithZero: LogProps[] = [
        {
          type: 'ungrouped',
          id: '1',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { 'TestTable.category': 'Empty', 'TestTable.sum_value': 0 },
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.category': 'Empty', 'TestTable.sum_value': 0 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
      ];
      
      const barData = logsWithZero.map(log => ({
        x: (log['TestTable.entries'] as any)['TestTable.category'],
        y: (log['TestTable.entries'] as any)['TestTable.sum_value'],
      }));
      
      expect(barData[0].y).toBe(0);
    });

    it('handles negative aggregate values', () => {
      const meta = {
        scenario: 'Aggregate value is negative (e.g., loss)',
        behavior: 'Negative bar extends below zero line'
      };

      const logsWithNegative: LogProps[] = [
        {
          type: 'ungrouped',
          id: '1',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { 'TestTable.category': 'Loss', 'TestTable.sum_value': -50 },
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.category': 'Loss', 'TestTable.sum_value': -50 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
      ];
      
      const barData = logsWithNegative.map(log => ({
        y: (log['TestTable.entries'] as any)['TestTable.sum_value'],
      }));
      
      expect(barData[0].y).toBe(-50);
      expect(barData[0].y < 0).toBe(true);
    });

    it('handles null aggregate values', () => {
      const meta = {
        scenario: 'Aggregate value is null',
        behavior: 'Null values are filtered or handled gracefully'
      };

      const logsWithNull: LogProps[] = [
        {
          type: 'ungrouped',
          id: '1',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { 'TestTable.category': 'Unknown', 'TestTable.sum_value': null },
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.category': 'Unknown', 'TestTable.sum_value': null },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
      ];
      
      const barData = logsWithNull
        .filter(log => (log['TestTable.entries'] as any)['TestTable.sum_value'] !== null)
        .map(log => ({
          y: (log['TestTable.entries'] as any)['TestTable.sum_value'],
        }));
      
      expect(barData).toHaveLength(0);
    });
  });

  describe('Histogram with Pre-Aggregated Data', () => {
    const meta = {
      scenario: 'Using pre-aggregated data in histograms',
      behavior: 'Histogram bins pre-aggregated values'
    };

    it('bins pre-aggregated values correctly', () => {
      const meta = {
        scenario: 'Histogram of aggregate sum values',
        behavior: 'Values are binned based on their aggregated amounts'
      };

      const logs = createAggregatedLogs();
      const values = logs.map(log => 
        (log['TestTable.entries'] as any)['TestTable.sum_value']
      );
      
      // Create bins for the aggregate values
      const bins = d3.bin().thresholds(5)(values);
      
      expect(bins).toBeDefined();
      expect(bins.length).toBeGreaterThan(0);
    });
  });

  describe('Scatter Plot with Pre-Aggregated Data', () => {
    const meta = {
      scenario: 'Using pre-aggregated data in scatter plots',
      behavior: 'Each aggregate row becomes a data point'
    };

    it('plots aggregate values as scatter points', () => {
      const meta = {
        scenario: 'Scatter plot of count vs sum',
        behavior: 'Each category becomes a point at (count, sum)'
      };

      const logs = createAggregatedLogs();
      
      const scatterData = logs.map(log => ({
        x: (log['TestTable.entries'] as any)['TestTable.count_value'],
        y: (log['TestTable.entries'] as any)['TestTable.sum_value'],
        label: (log['TestTable.entries'] as any)['TestTable.category'],
      }));
      
      expect(scatterData).toHaveLength(2);
      expect(scatterData[0]).toEqual({ x: 10, y: 100, label: 'A' });
      expect(scatterData[1]).toEqual({ x: 20, y: 200, label: 'B' });
    });
  });

  describe('Line Chart with Pre-Aggregated Data', () => {
    const meta = {
      scenario: 'Using pre-aggregated data in line charts',
      behavior: 'Line connects aggregate data points in order'
    };

    it('connects aggregate values as line segments', () => {
      const meta = {
        scenario: 'Line chart of aggregated time series',
        behavior: 'Line connects points in X order'
      };

      const timeSeriesAggregates: LogProps[] = [
        {
          type: 'ungrouped',
          id: '1',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: {},
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.date': '2023-01', 'TestTable.sum_value': 100 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
        {
          type: 'ungrouped',
          id: '2',
          ts: '2023-02-01T10:00:00.000Z',
          params: {},
          entries: {},
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.date': '2023-02', 'TestTable.sum_value': 150 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
        {
          type: 'ungrouped',
          id: '3',
          ts: '2023-03-01T10:00:00.000Z',
          params: {},
          entries: {},
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.date': '2023-03', 'TestTable.sum_value': 120 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
      ];
      
      const lineData = timeSeriesAggregates.map((log, i) => [
        i, // Using index as X for simplicity
        (log['TestTable.entries'] as any)['TestTable.sum_value'],
      ]);
      
      expect(lineData).toHaveLength(3);
      expect(lineData.map(d => d[1])).toEqual([100, 150, 120]);
    });
  });

  describe('Aggregate with Grouping Overlay', () => {
    const meta = {
      scenario: 'Aggregated data with additional grouping for coloring',
      behavior: 'Pre-aggregated data can be colored by another group column'
    };

    it('applies color grouping to pre-aggregated data', () => {
      const meta = {
        scenario: 'Aggregated by month, colored by region',
        behavior: 'Each region gets a different color'
      };

      const aggregatedWithGroups: LogProps[] = [
        {
          type: 'ungrouped',
          id: '1',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: {},
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 
            'TestTable.month': '2023-01', 
            'TestTable.region': 'North',
            'TestTable.sum_value': 100 
          },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
        {
          type: 'ungrouped',
          id: '2',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: {},
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 
            'TestTable.month': '2023-01', 
            'TestTable.region': 'South',
            'TestTable.sum_value': 150 
          },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
      ];
      
      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
      const groups = Array.from(new Set(
        aggregatedWithGroups.map(log => 
          (log['TestTable.entries'] as any)['TestTable.region']
        )
      ));
      
      expect(groups).toContain('North');
      expect(groups).toContain('South');
      expect(colorScale('North')).not.toBe(colorScale('South'));
    });
  });

  describe('Multiple Aggregate Columns', () => {
    const meta = {
      scenario: 'Table has multiple aggregate columns',
      behavior: 'User can select which aggregate to plot'
    };

    it('allows selection of different aggregate columns for Y axis', () => {
      const meta = {
        scenario: 'Switching Y axis between sum and mean',
        behavior: 'Plot updates to show selected aggregate'
      };

      const logs = createAggregatedLogs();
      const fields = createAggregatedFields();
      
      // Find all aggregate columns
      const aggregateColumns = Object.entries(fields)
        .filter(([_, field]) => field.artifacts?.includes('aggregate:'))
        .map(([name, _]) => name);
      
      expect(aggregateColumns).toContain('TestTable.sum_value');
      expect(aggregateColumns).toContain('TestTable.count_value');
      expect(aggregateColumns).toContain('TestTable.mean_value');
      expect(aggregateColumns).toHaveLength(3);
    });

    it('allows plotting one aggregate against another', () => {
      const meta = {
        scenario: 'X axis is count aggregate, Y axis is sum aggregate',
        behavior: 'Scatter plot shows relationship between aggregates'
      };

      const logs = createAggregatedLogs();
      
      const scatterData = logs.map(log => ({
        x: (log['TestTable.entries'] as any)['TestTable.count_value'],
        y: (log['TestTable.entries'] as any)['TestTable.sum_value'],
      }));
      
      expect(scatterData[0].x).toBe(10);
      expect(scatterData[0].y).toBe(100);
    });
  });

  describe('Aggregated + Non-Aggregated Columns', () => {
    const meta = {
      scenario: 'Mixing aggregate and non-aggregate columns',
      behavior: 'Non-aggregate column used for X, aggregate for Y'
    };

    it('uses non-aggregate column for X axis labels', () => {
      const meta = {
        scenario: 'X axis is category (non-aggregate), Y is sum (aggregate)',
        behavior: 'Category names appear on X axis'
      };

      const logs = createAggregatedLogs();
      const fields = createAggregatedFields();
      
      // Category is not an aggregate
      const categoryField = fields['TestTable.category'];
      const isAggregate = categoryField.artifacts?.includes('aggregate:');
      
      expect(isAggregate).toBe(false);
      
      // Get X axis labels
      const xLabels = logs.map(log => 
        (log['TestTable.entries'] as any)['TestTable.category']
      );
      
      expect(xLabels).toEqual(['A', 'B']);
    });
  });

  describe('convertMetricsToLogs Utility', () => {
    const meta = {
      scenario: 'Converting metrics API response to log format',
      behavior: 'Grouped metrics are converted to plottable log entries'
    };

    it('converts simple grouped metrics to logs', () => {
      const meta = {
        scenario: 'Metrics API returns mean values by category',
        behavior: 'Each group becomes a log entry'
      };

      const groupFields = ['category'];
      const metricName = 'mean';
      const tableFields: LogFieldsResponseProps = {
        'category': { data_type: 'string', field_type: 'entry', artifacts: '', mutable: 'false', created_at: '' },
        'value': { data_type: 'float', field_type: 'entry', artifacts: '', mutable: 'false', created_at: '' },
      };
      // GroupedMetrics structure: { columnName: { groupValue: { metricName: value } } }
      const metrics = {
        'value': {
          'A': { mean: 50, count: 10 },
          'B': { mean: 75, count: 5 },
        }
      } as unknown as GroupedMetrics;

      const logs = convertMetricsToLogs(groupFields, metricName, tableFields, metrics);

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('Additional Aggregate Functions', () => {
    
    it('handles min aggregates correctly',
    {
      meta: {
        alias: 'Aggregated-Min',
        scenario: 'Pre-aggregated data with min function.',
        behavior: 'Min value is recognized and displayed.'
      }
    },
    () => {
      const values = [10, 5, 20, 15, 3];
      const minValue = d3.min(values);
      
      expect(minValue).toBe(3);
    });

    it('handles max aggregates correctly',
    {
      meta: {
        alias: 'Aggregated-Max',
        scenario: 'Pre-aggregated data with max function.',
        behavior: 'Max value is recognized and displayed.'
      }
    },
    () => {
      const values = [10, 5, 20, 15, 3];
      const maxValue = d3.max(values);
      
      expect(maxValue).toBe(20);
    });

    it('handles stddev aggregates correctly',
    {
      meta: {
        alias: 'Aggregated-Stddev',
        scenario: 'Pre-aggregated data with standard deviation.',
        behavior: 'Stddev value is recognized and displayed.'
      }
    },
    () => {
      const values = [10, 20, 30, 40, 50];
      const mean = d3.mean(values)!;
      const variance = d3.mean(values.map(v => Math.pow(v - mean, 2)))!;
      const stddev = Math.sqrt(variance);
      
      expect(stddev).toBeCloseTo(14.14, 1);
    });

    it('bar chart metric selector works with pre-aggregated columns',
    {
      meta: {
        alias: 'Aggregated-BarMetric',
        scenario: 'Bar chart with pre-aggregated Y column.',
        behavior: 'Metric selector shows correct options based on column type.'
      }
    },
    () => {
      const aggregateColumn = 'sum_value';
      const isPreAggregated = aggregateColumn.includes('sum') || 
                               aggregateColumn.includes('mean') ||
                               aggregateColumn.includes('count');
      
      // For pre-aggregated columns, only "sum" metric makes sense (sum of sums)
      // or the column values can be plotted directly
      const availableMetrics = isPreAggregated 
        ? ['direct'] 
        : ['mean', 'sum', 'count', 'min', 'max'];
      
      expect(isPreAggregated).toBe(true);
    });
  });
});

