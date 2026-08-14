/**
 * Axis Customization Unit Tests
 *
 * Tests for AxisCustomization interface and related utility functions.
 *
 * Tests cover:
 * - AxisCustomization type structure
 * - Label visibility options
 * - Custom label overrides
 * - Tick formatters
 * - Group by and aggregate labels
 */

import { describe, it, expect } from 'vitest';
import type { AxisCustomization, HighlightTarget } from '@/types/interfaces/plot';

// =============================================================================
// AxisCustomization Type Tests
// =============================================================================

describe('AxisCustomization', () => {
  describe('type structure', () => {
    it('allows empty object (all optional fields)', () => {
      const config: AxisCustomization = {};
      expect(config).toBeDefined();
    });

    it('accepts all fields', () => {
      const config: AxisCustomization = {
        showXAxisLabel: true,
        showYAxisLabel: false,
        xAxisLabel: 'Custom X',
        yAxisLabel: 'Custom Y',
        xTickFormatter: (v) => `${v}`,
        yTickFormatter: (v) => `$${v}`,
        groupByLabel: 'Category',
        aggregateLabel: 'Total',
        highlightTarget: { type: 'none' },
        onGroupsChange: () => {},
        onDatapointPin: () => {},
      };

      expect(config.showXAxisLabel).toBe(true);
      expect(config.showYAxisLabel).toBe(false);
      expect(config.xAxisLabel).toBe('Custom X');
      expect(config.yAxisLabel).toBe('Custom Y');
      expect(config.groupByLabel).toBe('Category');
      expect(config.aggregateLabel).toBe('Total');
    });
  });

  describe('label visibility options', () => {
    it('showXAxisLabel defaults to undefined (falsy in implementation)', () => {
      const config: AxisCustomization = {};
      expect(config.showXAxisLabel).toBeUndefined();
    });

    it('showYAxisLabel defaults to undefined (falsy in implementation)', () => {
      const config: AxisCustomization = {};
      expect(config.showYAxisLabel).toBeUndefined();
    });

    it('accepts boolean values for visibility', () => {
      const hiddenConfig: AxisCustomization = {
        showXAxisLabel: false,
        showYAxisLabel: false,
      };

      expect(hiddenConfig.showXAxisLabel).toBe(false);
      expect(hiddenConfig.showYAxisLabel).toBe(false);

      const visibleConfig: AxisCustomization = {
        showXAxisLabel: true,
        showYAxisLabel: true,
      };

      expect(visibleConfig.showXAxisLabel).toBe(true);
      expect(visibleConfig.showYAxisLabel).toBe(true);
    });
  });

  describe('custom label overrides', () => {
    it('xAxisLabel overrides field name', () => {
      const config: AxisCustomization = {
        xAxisLabel: 'Time (Hours)',
      };

      expect(config.xAxisLabel).toBe('Time (Hours)');
    });

    it('yAxisLabel overrides field name', () => {
      const config: AxisCustomization = {
        yAxisLabel: 'Revenue ($)',
      };

      expect(config.yAxisLabel).toBe('Revenue ($)');
    });

    it('groupByLabel overrides group field name', () => {
      const config: AxisCustomization = {
        groupByLabel: 'Product Category',
      };

      expect(config.groupByLabel).toBe('Product Category');
    });

    it('aggregateLabel overrides aggregate function name', () => {
      const config: AxisCustomization = {
        aggregateLabel: 'Total Revenue',
      };

      expect(config.aggregateLabel).toBe('Total Revenue');
    });

    it('labels can be empty strings', () => {
      const config: AxisCustomization = {
        xAxisLabel: '',
        yAxisLabel: '',
      };

      expect(config.xAxisLabel).toBe('');
      expect(config.yAxisLabel).toBe('');
    });
  });

  describe('tick formatters', () => {
    it('xTickFormatter can format numbers', () => {
      const config: AxisCustomization = {
        xTickFormatter: (value: unknown) => `${Number(value).toFixed(2)}`,
      };

      expect(config.xTickFormatter!(10.5)).toBe('10.50');
      expect(config.xTickFormatter!(100)).toBe('100.00');
    });

    it('yTickFormatter can format currency', () => {
      const config: AxisCustomization = {
        yTickFormatter: (value: unknown) => `$${Number(value).toLocaleString()}`,
      };

      expect(config.yTickFormatter!(1000)).toBe('$1,000');
      expect(config.yTickFormatter!(1234567)).toBe('$1,234,567');
    });

    it('tick formatters can handle various input types', () => {
      const config: AxisCustomization = {
        xTickFormatter: (value: unknown) => {
          if (typeof value === 'string') return value;
          if (typeof value === 'number') return value.toString();
          return String(value);
        },
      };

      expect(config.xTickFormatter!('hello')).toBe('hello');
      expect(config.xTickFormatter!(42)).toBe('42');
      expect(config.xTickFormatter!(null)).toBe('null');
    });

    it('percentage formatter example', () => {
      const config: AxisCustomization = {
        yTickFormatter: (value: unknown) => `${Number(value)}%`,
      };

      expect(config.yTickFormatter!(75)).toBe('75%');
      expect(config.yTickFormatter!(100)).toBe('100%');
    });

    it('date formatter example', () => {
      const config: AxisCustomization = {
        xTickFormatter: (value: unknown) => {
          const date = new Date(Number(value));
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        },
      };

      // January 15, 2024, constructed in local time because toLocaleDateString
      // renders in local time; parsing '2024-01-15' would pin UTC midnight,
      // which renders as Jan 14 in zones west of UTC.
      const timestamp = new Date(2024, 0, 15).getTime();
      expect(config.xTickFormatter!(timestamp)).toBe('Jan 15');
    });
  });

  describe('highlight target', () => {
    it('accepts none highlight target', () => {
      const config: AxisCustomization = {
        highlightTarget: { type: 'none' },
      };

      expect(config.highlightTarget?.type).toBe('none');
    });

    it('accepts group highlight target', () => {
      const config: AxisCustomization = {
        highlightTarget: { type: 'group', groupKey: 'Category A' },
      };

      expect(config.highlightTarget?.type).toBe('group');
      if (config.highlightTarget?.type === 'group') {
        expect(config.highlightTarget.groupKey).toBe('Category A');
      }
    });

    it('accepts datapoint highlight target', () => {
      const config: AxisCustomization = {
        highlightTarget: { type: 'datapoint', datapointId: 'dp-123' },
      };

      expect(config.highlightTarget?.type).toBe('datapoint');
      if (config.highlightTarget?.type === 'datapoint') {
        expect(config.highlightTarget.datapointId).toBe('dp-123');
      }
    });
  });

  describe('callbacks', () => {
    it('onGroupsChange receives groups array', () => {
      let receivedGroups: Array<{ key: string; color: string }> = [];

      const config: AxisCustomization = {
        onGroupsChange: (groups) => {
          receivedGroups = groups;
        },
      };

      config.onGroupsChange!([
        { key: 'A', color: '#ff0000' },
        { key: 'B', color: '#00ff00' },
      ]);

      expect(receivedGroups).toHaveLength(2);
      expect(receivedGroups[0].key).toBe('A');
      expect(receivedGroups[1].color).toBe('#00ff00');
    });

    it('onDatapointPin receives datapoint structure', () => {
      let receivedDatapoint: {
        id: string;
        x: { label: string; value: string | number };
        y: { label: string; value: string | number };
        group?: { label: string; value: string };
      } | null = null;

      const config: AxisCustomization = {
        onDatapointPin: (datapoint) => {
          receivedDatapoint = datapoint;
        },
      };

      config.onDatapointPin!({
        id: 'dp-123',
        x: { label: 'X Axis', value: 10 },
        y: { label: 'Y Axis', value: 20 },
        group: { label: 'Category', value: 'A' },
      });

      expect(receivedDatapoint).not.toBeNull();
      expect(receivedDatapoint!.id).toBe('dp-123');
      expect(receivedDatapoint!.x.label).toBe('X Axis');
      expect(receivedDatapoint!.y.value).toBe(20);
      expect(receivedDatapoint!.group?.value).toBe('A');
    });

    it('onDatapointPin works without group', () => {
      let receivedDatapoint: {
        id: string;
        x: { label: string; value: string | number };
        y: { label: string; value: string | number };
        group?: { label: string; value: string };
      } | null = null;

      const config: AxisCustomization = {
        onDatapointPin: (datapoint) => {
          receivedDatapoint = datapoint;
        },
      };

      config.onDatapointPin!({
        id: 'dp-456',
        x: { label: 'Time', value: '2024-01-15' },
        y: { label: 'Count', value: 100 },
      });

      expect(receivedDatapoint!.group).toBeUndefined();
    });
  });
});

// =============================================================================
// HighlightTarget Type Tests
// =============================================================================

describe('HighlightTarget', () => {
  describe('type discrimination', () => {
    it('none type has no additional properties', () => {
      const target: HighlightTarget = { type: 'none' };
      expect(target.type).toBe('none');
      expect(Object.keys(target)).toEqual(['type']);
    });

    it('group type has groupKey property', () => {
      const target: HighlightTarget = { type: 'group', groupKey: 'Category A' };
      expect(target.type).toBe('group');
      expect(target.groupKey).toBe('Category A');
    });

    it('datapoint type has datapointId property', () => {
      const target: HighlightTarget = { type: 'datapoint', datapointId: 'dp-123' };
      expect(target.type).toBe('datapoint');
      expect(target.datapointId).toBe('dp-123');
    });
  });

  describe('type narrowing', () => {
    it('can narrow by type discriminator', () => {
      function getHighlightInfo(target: HighlightTarget): string {
        switch (target.type) {
          case 'none':
            return 'No highlight';
          case 'group':
            return `Highlighting group: ${target.groupKey}`;
          case 'datapoint':
            return `Highlighting datapoint: ${target.datapointId}`;
        }
      }

      expect(getHighlightInfo({ type: 'none' })).toBe('No highlight');
      expect(getHighlightInfo({ type: 'group', groupKey: 'A' })).toBe('Highlighting group: A');
      expect(getHighlightInfo({ type: 'datapoint', datapointId: 'dp-1' })).toBe(
        'Highlighting datapoint: dp-1'
      );
    });
  });

  describe('edge cases', () => {
    it('groupKey can be empty string', () => {
      const target: HighlightTarget = { type: 'group', groupKey: '' };
      expect(target.groupKey).toBe('');
    });

    it('datapointId can contain special characters', () => {
      const target: HighlightTarget = {
        type: 'datapoint',
        datapointId: 'A-2024-01-15-100.5',
      };
      expect(target.datapointId).toBe('A-2024-01-15-100.5');
    });
  });
});

// =============================================================================
// Usage Patterns
// =============================================================================

describe('AxisCustomization usage patterns', () => {
  it('usage page pattern: hide axes, custom tooltip labels, currency format', () => {
    const usagePageConfig: AxisCustomization = {
      // Hide axis labels (redundant with title)
      showXAxisLabel: false,
      showYAxisLabel: false,
      // Custom labels for tooltip
      xAxisLabel: 'Day',
      yAxisLabel: 'Billed Cost',
      // Format y-axis ticks as currency
      yTickFormatter: (value: unknown) => `$${Number(value).toFixed(2)}`,
      // Custom labels for grouped data
      groupByLabel: 'Model',
      aggregateLabel: 'Total Cost',
    };

    expect(usagePageConfig.showXAxisLabel).toBe(false);
    expect(usagePageConfig.yTickFormatter!(1234.567)).toBe('$1234.57');
  });

  it('scatter plot pattern: visible axes, regression focus', () => {
    const scatterConfig: AxisCustomization = {
      showXAxisLabel: true,
      showYAxisLabel: true,
      xAxisLabel: 'Input Tokens',
      yAxisLabel: 'Latency (ms)',
    };

    expect(scatterConfig.showXAxisLabel).toBe(true);
    expect(scatterConfig.xAxisLabel).toBe('Input Tokens');
  });

  it('histogram pattern: only y-axis label', () => {
    const histogramConfig: AxisCustomization = {
      showXAxisLabel: false, // Bins are self-explanatory
      showYAxisLabel: true,
      yAxisLabel: 'Frequency',
    };

    expect(histogramConfig.showXAxisLabel).toBe(false);
    expect(histogramConfig.yAxisLabel).toBe('Frequency');
  });
});
