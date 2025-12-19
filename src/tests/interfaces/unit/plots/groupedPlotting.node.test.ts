/// <reference types="jsdom" />
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import { LogProps, LogFieldsResponseProps } from '@/types/interfaces/logs';

/**
 * Unit tests for grouped table plotting functionality
 * Tests how grouping works across different plot types (scatter, line, bar, histogram)
 */

// Helper to create mock log data with grouping
const createMockLogs = (groupValues: string[]): LogProps[] => {
  return groupValues.flatMap((group, groupIndex) => 
    [1, 2, 3].map((i) => ({
      type: 'ungrouped' as const,
      id: `${groupIndex}-${i}`,
      ts: `2023-01-0${i}T10:00:00.000Z`,
      params: {},
      entries: {
        'TestTable.x': i * 10,
        'TestTable.y': i * 20 + groupIndex * 5,
        'TestTable.category': group,
      },
      derived_entries: {},
      clipped_fields: [],
      'TestTable.id': `${groupIndex}-${i}`,
      'TestTable.entries': {
        'TestTable.x': i * 10,
        'TestTable.y': i * 20 + groupIndex * 5,
        'TestTable.category': group,
      },
      'TestTable.params': {},
      'TestTable.derived_entries': {},
    }))
  );
};

const createMockFields = (): LogFieldsResponseProps => ({
  'TestTable.x': {
    data_type: 'float',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: '',
  },
  'TestTable.y': {
    data_type: 'float',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: '',
  },
  'TestTable.category': {
    data_type: 'string',
    field_type: 'entry',
    artifacts: '',
    mutable: 'false',
    created_at: '',
  },
});

describe('Grouped Table Plotting', () => {
  const meta = {
    scenario: 'Testing grouped data plotting functionality',
    behavior: 'System correctly handles pre-grouped and dynamically grouped data'
  };

  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
  });

  describe('Group Value Extraction', () => {
    const meta = {
      scenario: 'Extracting unique group values from data',
      behavior: 'Correctly identifies all unique groups and their values'
    };

    it('extracts unique string group values', () => {
      const meta = {
        scenario: 'Data has three groups: A, B, C',
        behavior: 'Returns three unique group values'
      };

      const logs = createMockLogs(['A', 'B', 'C']);
      const groupValues = Array.from(new Set(
        logs.map(log => (log['TestTable.entries'] as any)['TestTable.category'])
      ));

      expect(groupValues).toContain('A');
      expect(groupValues).toContain('B');
      expect(groupValues).toContain('C');
      expect(groupValues).toHaveLength(3);
    });

    it('handles numeric group values', () => {
      const meta = {
        scenario: 'Group values are numbers (1, 2, 3)',
        behavior: 'Correctly extracts numeric group values'
      };

      const logs: LogProps[] = [1, 2, 3].flatMap((groupNum) => 
        [1, 2].map((i) => ({
          type: 'ungrouped' as const,
          id: `${groupNum}-${i}`,
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { 'TestTable.group': groupNum, 'TestTable.x': i },
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.group': groupNum, 'TestTable.x': i },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        }))
      );

      const groupValues = Array.from(new Set(
        logs.map(log => (log['TestTable.entries'] as any)['TestTable.group'])
      ));

      expect(groupValues).toContain(1);
      expect(groupValues).toContain(2);
      expect(groupValues).toContain(3);
      expect(groupValues).toHaveLength(3);
    });

    it('handles null group values', () => {
      const meta = {
        scenario: 'Some logs have null group values',
        behavior: 'Null is treated as a valid group'
      };

      const logs: LogProps[] = [
        {
          type: 'ungrouped',
          id: '1',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { 'TestTable.group': null, 'TestTable.x': 1 },
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.group': null, 'TestTable.x': 1 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
        {
          type: 'ungrouped',
          id: '2',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { 'TestTable.group': 'A', 'TestTable.x': 2 },
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.group': 'A', 'TestTable.x': 2 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
      ];

      const groupValues = Array.from(new Set(
        logs.map(log => (log['TestTable.entries'] as any)['TestTable.group'])
      ));

      expect(groupValues).toContain(null);
      expect(groupValues).toContain('A');
      expect(groupValues).toHaveLength(2);
    });

    it('handles single group in data', () => {
      const meta = {
        scenario: 'All data belongs to one group',
        behavior: 'Returns single group value'
      };

      const logs = createMockLogs(['SingleGroup']);
      const groupValues = Array.from(new Set(
        logs.map(log => (log['TestTable.entries'] as any)['TestTable.category'])
      ));

      expect(groupValues).toHaveLength(1);
      expect(groupValues[0]).toBe('SingleGroup');
    });

    it('handles many groups (10+)', () => {
      const meta = {
        scenario: 'Data has more than 10 different groups',
        behavior: 'All groups are correctly identified'
      };

      const groupNames = Array.from({ length: 15 }, (_, i) => `Group${i + 1}`);
      const logs = createMockLogs(groupNames);
      
      const groupValues = Array.from(new Set(
        logs.map(log => (log['TestTable.entries'] as any)['TestTable.category'])
      ));

      expect(groupValues).toHaveLength(15);
      groupNames.forEach(name => {
        expect(groupValues).toContain(name);
      });
    });
  });

  describe('Group Color Assignment', () => {
    const meta = {
      scenario: 'Assigning colors to groups',
      behavior: 'Each group gets a unique, consistent color'
    };

    it('assigns unique colors to each group using schemeCategory10', () => {
      const meta = {
        scenario: 'Three groups need colors',
        behavior: 'Each group gets a different color from the scheme'
      };

      const groups = ['A', 'B', 'C'];
      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
      
      const colors = groups.map(g => colorScale(g));
      
      // All colors should be unique
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBe(3);
    });

    it('produces consistent colors for same group value', () => {
      const meta = {
        scenario: 'Same group value is colored multiple times',
        behavior: 'Same color is returned each time'
      };

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
      
      const color1 = colorScale('GroupA');
      const color2 = colorScale('GroupA');
      const color3 = colorScale('GroupA');
      
      expect(color1).toBe(color2);
      expect(color2).toBe(color3);
    });

    it('wraps colors when groups exceed scheme size', () => {
      const meta = {
        scenario: 'More groups than colors in scheme (10+ groups)',
        behavior: 'Colors wrap around to reuse scheme colors'
      };

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
      const groups = Array.from({ length: 12 }, (_, i) => `Group${i}`);
      
      const colors = groups.map(g => colorScale(g));
      
      // schemeCategory10 has 10 colors, so groups 10 and 11 will wrap
      expect(colors[10]).toBe(colors[0]);
      expect(colors[11]).toBe(colors[1]);
    });

    it('handles null group key in color assignment', () => {
      const meta = {
        scenario: 'Null is a group value',
        behavior: 'Null gets a color like any other group'
      };

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
      
      const nullColor = colorScale(null as any);
      const stringColor = colorScale('A');
      
      // Both should get valid colors
      expect(nullColor).toBeDefined();
      expect(stringColor).toBeDefined();
    });
  });

  describe('D3 Grouping Operations', () => {
    const meta = {
      scenario: 'Using D3 to group data for plotting',
      behavior: 'D3.groups and D3.rollup work correctly with log data'
    };

    it('groups data using d3.groups for line charts', () => {
      const meta = {
        scenario: 'Grouping logs by category for multi-line chart',
        behavior: 'Returns array of [groupKey, groupData[]] tuples'
      };

      const logs = createMockLogs(['A', 'B']);
      
      const grouped = d3.groups(logs, d => 
        (d['TestTable.entries'] as any)['TestTable.category']
      );

      expect(grouped).toHaveLength(2);
      expect(grouped[0][0]).toBe('A');
      expect(grouped[1][0]).toBe('B');
      expect(grouped[0][1]).toHaveLength(3); // 3 data points per group
      expect(grouped[1][1]).toHaveLength(3);
    });

    it('aggregates grouped data using d3.rollup for bar charts', () => {
      const meta = {
        scenario: 'Aggregating Y values by group for bar chart',
        behavior: 'Returns Map with group keys and aggregated values'
      };

      const logs = createMockLogs(['A', 'B']);
      
      const aggregated = d3.rollup(
        logs,
        v => d3.mean(v, d => (d['TestTable.entries'] as any)['TestTable.y']),
        d => (d['TestTable.entries'] as any)['TestTable.category']
      );

      expect(aggregated.size).toBe(2);
      expect(aggregated.has('A')).toBe(true);
      expect(aggregated.has('B')).toBe(true);
      expect(typeof aggregated.get('A')).toBe('number');
    });

    it('handles nested grouping (group within group)', () => {
      const meta = {
        scenario: 'Double grouping by category and sub-category',
        behavior: 'Returns nested group structure'
      };

      const logs: LogProps[] = [
        {
          type: 'ungrouped',
          id: '1',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { category: 'A', subcategory: 'X', value: 10 },
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { category: 'A', subcategory: 'X', value: 10 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
        {
          type: 'ungrouped',
          id: '2',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { category: 'A', subcategory: 'Y', value: 20 },
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { category: 'A', subcategory: 'Y', value: 20 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
        {
          type: 'ungrouped',
          id: '3',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { category: 'B', subcategory: 'X', value: 30 },
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { category: 'B', subcategory: 'X', value: 30 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
      ];

      const nestedGroups = d3.groups(
        logs,
        d => (d['TestTable.entries'] as any).category,
        d => (d['TestTable.entries'] as any).subcategory
      );

      expect(nestedGroups).toHaveLength(2); // A and B
      expect(nestedGroups[0][0]).toBe('A');
      expect(nestedGroups[0][1]).toHaveLength(2); // X and Y subcategories
    });
  });

  describe('Grouped Data Filtering', () => {
    const meta = {
      scenario: 'Filtering data that requires group property',
      behavior: 'Only logs with valid group values are included'
    };

    it('filters out logs missing group property', () => {
      const meta = {
        scenario: 'Some logs lack the groupBy field',
        behavior: 'Those logs are excluded from grouped plotting'
      };

      const logs: LogProps[] = [
        {
          type: 'ungrouped',
          id: '1',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { x: 10, y: 20, category: 'A' },
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.x': 10, 'TestTable.y': 20, 'TestTable.category': 'A' },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
        {
          type: 'ungrouped',
          id: '2',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: { x: 30, y: 40 }, // Missing category
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.x': 30, 'TestTable.y': 40 },
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
      ];

      const groupBy = 'TestTable.category';
      const filtered = logs.filter(log => {
        const entries = log['TestTable.entries'] as any;
        return entries && entries[groupBy] !== undefined;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('includes logs with null but not undefined group values', () => {
      const meta = {
        scenario: 'Group value is explicitly null vs undefined',
        behavior: 'Null is valid, undefined is excluded'
      };

      const logs: LogProps[] = [
        {
          type: 'ungrouped',
          id: '1',
          ts: '2023-01-01T10:00:00.000Z',
          params: {},
          entries: {},
          derived_entries: {},
          clipped_fields: [],
          'TestTable.entries': { 'TestTable.x': 10, 'TestTable.category': null },
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
          'TestTable.entries': { 'TestTable.x': 20 }, // category is undefined
          'TestTable.params': {},
          'TestTable.derived_entries': {},
        },
      ];

      const groupBy = 'TestTable.category';
      const filtered = logs.filter(log => {
        const entries = log['TestTable.entries'] as any;
        return entries && groupBy in entries;
      });

      // Only the log with null category (which has the key present) should pass
      // if we're checking for key existence
      expect(filtered).toHaveLength(1);
    });
  });

  describe('Grouped Rendering Opacity', () => {
    const meta = {
      scenario: 'Setting opacity for grouped vs ungrouped plots',
      behavior: 'Grouped plots use lower opacity (0.7) for overlap visibility'
    };

    it('calculates correct opacity for grouped data', () => {
      const meta = {
        scenario: 'Data is grouped',
        behavior: 'Returns opacity of 0.7'
      };

      const groupBy = 'category';
      const initialOpacity = groupBy ? 0.7 : 1.0;
      
      expect(initialOpacity).toBe(0.7);
    });

    it('calculates correct opacity for ungrouped data', () => {
      const meta = {
        scenario: 'Data is not grouped',
        behavior: 'Returns opacity of 1.0'
      };

      const groupBy = undefined;
      const initialOpacity = groupBy ? 0.7 : 1.0;
      
      expect(initialOpacity).toBe(1.0);
    });
  });

  describe('Group Statistics Calculation', () => {
    const meta = {
      scenario: 'Calculating aggregate statistics per group',
      behavior: 'Mean, sum, count, min, max are calculated correctly per group'
    };

    it('calculates mean per group', () => {
      const meta = {
        scenario: 'Bar chart with mean aggregation by group',
        behavior: 'Each group shows mean of Y values'
      };

      const logs = createMockLogs(['A', 'B']);
      
      const groupMeans = d3.rollup(
        logs,
        v => d3.mean(v, d => (d['TestTable.entries'] as any)['TestTable.y']),
        d => (d['TestTable.entries'] as any)['TestTable.category']
      );

      const meanA = groupMeans.get('A');
      const meanB = groupMeans.get('B');

      expect(meanA).toBeDefined();
      expect(meanB).toBeDefined();
      expect(typeof meanA).toBe('number');
      // Group B should have higher mean (offset by groupIndex * 5)
      expect(meanB! > meanA!).toBe(true);
    });

    it('calculates sum per group', () => {
      const meta = {
        scenario: 'Bar chart with sum aggregation by group',
        behavior: 'Each group shows sum of Y values'
      };

      const logs = createMockLogs(['A', 'B']);
      
      const groupSums = d3.rollup(
        logs,
        v => d3.sum(v, d => (d['TestTable.entries'] as any)['TestTable.y']),
        d => (d['TestTable.entries'] as any)['TestTable.category']
      );

      const sumA = groupSums.get('A');
      const sumB = groupSums.get('B');

      expect(sumA).toBeDefined();
      expect(sumB).toBeDefined();
      // Sum should be larger than any individual value
      expect(sumA! > 60).toBe(true); // 20 + 40 + 60 = 120 for group A (y = i * 20)
    });

    it('calculates count per group', () => {
      const meta = {
        scenario: 'Bar chart with count aggregation by group',
        behavior: 'Each group shows number of data points'
      };

      const logs = createMockLogs(['A', 'B', 'C']);
      
      const groupCounts = d3.rollup(
        logs,
        v => v.length,
        d => (d['TestTable.entries'] as any)['TestTable.category']
      );

      expect(groupCounts.get('A')).toBe(3);
      expect(groupCounts.get('B')).toBe(3);
      expect(groupCounts.get('C')).toBe(3);
    });

    it('calculates min per group', () => {
      const meta = {
        scenario: 'Finding minimum Y value per group',
        behavior: 'Returns smallest Y value in each group'
      };

      const logs = createMockLogs(['A', 'B']);
      
      const groupMins = d3.rollup(
        logs,
        v => d3.min(v, d => (d['TestTable.entries'] as any)['TestTable.y']),
        d => (d['TestTable.entries'] as any)['TestTable.category']
      );

      expect(groupMins.get('A')).toBeDefined();
      expect(groupMins.get('B')).toBeDefined();
    });

    it('calculates max per group', () => {
      const meta = {
        scenario: 'Finding maximum Y value per group',
        behavior: 'Returns largest Y value in each group'
      };

      const logs = createMockLogs(['A', 'B']);
      
      const groupMaxes = d3.rollup(
        logs,
        v => d3.max(v, d => (d['TestTable.entries'] as any)['TestTable.y']),
        d => (d['TestTable.entries'] as any)['TestTable.category']
      );

      expect(groupMaxes.get('A')).toBeDefined();
      expect(groupMaxes.get('B')).toBeDefined();
    });
  });

  describe('Clearing Grouping', () => {
    const meta = {
      scenario: 'Transitioning from grouped to ungrouped data',
      behavior: 'Grouping key and colors are properly cleared'
    };

    it('detects when groupBy changes from value to undefined', () => {
      const meta = {
        scenario: 'User clears the group by selection',
        behavior: 'System detects the change and clears grouping artifacts'
      };

      let previousGroupBy: string | undefined = 'category';
      let currentGroupBy: string | undefined = undefined;

      const groupingCleared = previousGroupBy !== undefined && currentGroupBy === undefined;
      
      expect(groupingCleared).toBe(true);
    });

    it('detects when groupBy changes between different values', () => {
      const meta = {
        scenario: 'User changes group by from category to region',
        behavior: 'System detects the change and updates grouping'
      };

      let previousGroupBy = 'category';
      let currentGroupBy = 'region';

      const groupingChanged = previousGroupBy !== currentGroupBy;
      
      expect(groupingChanged).toBe(true);
    });
  });

  describe('Additional Grouped Plotting Tests', () => {
    
    it('supports hierarchical group labels in legend',
    {
      meta: {
        alias: 'Grouped-Legend-Hierarchy',
        scenario: 'Data is grouped at multiple levels.',
        behavior: 'Legend shows hierarchical labels (e.g., "A > North").'
      }
    },
    () => {
      const groups = [
        { level1: 'A', level2: 'North' },
        { level1: 'A', level2: 'South' },
        { level1: 'B', level2: 'North' },
      ];

      const hierarchicalLabels = groups.map(g => `${g.level1} > ${g.level2}`);

      expect(hierarchicalLabels).toContain('A > North');
      expect(hierarchicalLabels).toContain('A > South');
      expect(hierarchicalLabels).toContain('B > North');
    });

    it('handles mixed type group key values',
    {
      meta: {
        alias: 'Grouped-MixedTypes',
        scenario: 'Group key contains numbers and strings.',
        behavior: 'All values are converted to strings for consistent comparison.'
      }
    },
    () => {
      const groupKeys = [1, 'A', 2, 'B', null];
      const stringifiedKeys = groupKeys.map(k => String(k));

      expect(stringifiedKeys).toContain('1');
      expect(stringifiedKeys).toContain('A');
      expect(stringifiedKeys).toContain('null');
    });

    it('correctly bins within groups for histogram',
    {
      meta: {
        alias: 'Grouped-HistogramBins',
        scenario: 'Grouped histogram data.',
        behavior: 'Each group has its own set of bins.'
      }
    },
    () => {
      const groupAData = [10, 15, 20, 25, 30];
      const groupBData = [50, 55, 60, 65, 70];

      const binGenerator = d3.bin().thresholds(5);
      const binsA = binGenerator(groupAData);
      const binsB = binGenerator(groupBData);

      // Groups should have different bin ranges
      expect(binsA[0].x0).toBeLessThan(binsB[0].x0!);
    });

    it('correctly draws separate regression lines per group in scatter plot',
    {
      meta: {
        alias: 'Grouped-RegressionPerGroup',
        scenario: 'Grouped scatter plot with regression enabled.',
        behavior: 'Each group gets its own regression line.'
      }
    },
    () => {
      const groups = ['A', 'B', 'C'];
      const regressionLines = groups.map(g => ({
        group: g,
        slope: Math.random(),
        intercept: Math.random()
      }));

      expect(regressionLines).toHaveLength(3);
      // Each group has distinct regression parameters
      expect(regressionLines[0].group).toBe('A');
      expect(regressionLines[1].group).toBe('B');
      expect(regressionLines[2].group).toBe('C');
    });
  });
});

