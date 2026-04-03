/**
 * Tooltip Utilities Unit Tests
 *
 * Tests for tooltip generation and positioning utilities
 * used by plot components.
 *
 * Tests cover:
 * - tooltipTemplate function for HTML generation
 * - InfoCardData structure handling
 */

import { describe, it, expect } from 'vitest';
import { tooltipTemplate } from '@/utils/interfaces/plots/tooltip';
import type { InfoCardData } from '@/types/interfaces/plot';

// =============================================================================
// tooltipTemplate Tests
// =============================================================================

describe('tooltipTemplate', () => {
  describe('basic data', () => {
    it('generates HTML with x and y values', () => {
      const data: InfoCardData = {
        x: { name: 'X Axis', value: '10' },
        y: { name: 'Y Axis', value: 20 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('X Axis');
      expect(html).toContain('10');
      expect(html).toContain('Y Axis');
      expect(html).toContain('20');
    });

    it('wraps values in bold tags', () => {
      const data: InfoCardData = {
        x: { name: 'X', value: '100' },
        y: { name: 'Y', value: 200 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('<p class="font-bold">100</p>');
      expect(html).toContain('<p class="font-bold">200</p>');
    });

    it('includes separator divider', () => {
      const data: InfoCardData = {
        x: { name: 'X', value: '100' },
        y: { name: 'Y', value: 200 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('border-bottom');
    });

    it('includes pin instruction', () => {
      const data: InfoCardData = {
        x: { name: 'X', value: '100' },
        y: { name: 'Y', value: 200 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('Click to pin');
    });
  });

  describe('with group data', () => {
    it('includes group information when present', () => {
      const data: InfoCardData = {
        x: { name: 'X Axis', value: '10' },
        y: { name: 'Y Axis', value: 20 },
        group: { name: 'Category', value: 'Group A' },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('Category');
      expect(html).toContain('Group A');
    });

    it('places group before x and y', () => {
      const data: InfoCardData = {
        x: { name: 'X Axis', value: '10' },
        y: { name: 'Y Axis', value: 20 },
        group: { name: 'Category', value: 'Group A' },
      };

      const html = tooltipTemplate(data);

      const groupIndex = html.indexOf('Category');
      const xIndex = html.indexOf('X Axis');

      expect(groupIndex).toBeLessThan(xIndex);
    });
  });

  describe('with aggregate data', () => {
    it('includes aggregate information when present', () => {
      const data: InfoCardData = {
        x: { name: 'X Axis', value: '10' },
        y: { name: 'Y Axis', value: 20 },
        aggregate: { name: 'Mean' },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('Mean');
    });

    it('places aggregate at the top', () => {
      const data: InfoCardData = {
        x: { name: 'X Axis', value: '10' },
        y: { name: 'Y Axis', value: 20 },
        aggregate: { name: 'Sum' },
      };

      const html = tooltipTemplate(data);

      const aggregateIndex = html.indexOf('Sum');
      const xIndex = html.indexOf('X Axis');

      expect(aggregateIndex).toBeLessThan(xIndex);
    });
  });

  describe('with all optional fields', () => {
    it('includes all fields in correct order', () => {
      const data: InfoCardData = {
        x: { name: 'X Axis', value: '10' },
        y: { name: 'Y Axis', value: 20 },
        group: { name: 'Category', value: 'Group A' },
        aggregate: { name: 'Mean' },
      };

      const html = tooltipTemplate(data);

      const aggregateIndex = html.indexOf('Mean');
      const groupIndex = html.indexOf('Category');
      const xIndex = html.indexOf('X Axis');
      const yIndex = html.indexOf('Y Axis');

      // Order should be: aggregate, group, x, y
      expect(aggregateIndex).toBeLessThan(groupIndex);
      expect(groupIndex).toBeLessThan(xIndex);
      expect(xIndex).toBeLessThan(yIndex);
    });
  });

  describe('edge cases', () => {
    it('handles numeric values as strings', () => {
      const data: InfoCardData = {
        x: { name: 'Score', value: '99.5' },
        y: { name: 'Count', value: 1000 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('99.5');
      expect(html).toContain('1000');
    });

    it('handles special characters in values', () => {
      const data: InfoCardData = {
        x: { name: 'Label', value: 'Test <script>alert(1)</script>' },
        y: { name: 'Value', value: 100 },
      };

      const html = tooltipTemplate(data);

      // Should contain the raw text (actual XSS handling depends on rendering)
      expect(html).toContain('Test');
    });

    it('handles empty string values', () => {
      const data: InfoCardData = {
        x: { name: 'X', value: '' },
        y: { name: 'Y', value: 0 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('X');
      expect(html).toContain('Y');
    });

    it('handles long values', () => {
      const longValue = 'A'.repeat(1000);
      const data: InfoCardData = {
        x: { name: 'X', value: longValue },
        y: { name: 'Y', value: 100 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain(longValue);
    });
  });

  // ===========================================================================
  // Custom Label Tests (for AxisCustomization integration)
  // ===========================================================================

  describe('custom labels', () => {
    it('displays custom x label when provided', () => {
      const data: InfoCardData = {
        x: { name: 'Custom Day Label', value: '2024-01-15' },
        y: { name: 'Y Axis', value: 100 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('Custom Day Label');
      expect(html).toContain('2024-01-15');
    });

    it('displays custom y label when provided', () => {
      const data: InfoCardData = {
        x: { name: 'X Axis', value: 10 },
        y: { name: 'Billed Cost', value: 99.99 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('Billed Cost');
      expect(html).toContain('99.99');
    });

    it('displays custom group label when provided', () => {
      const data: InfoCardData = {
        x: { name: 'X Axis', value: 10 },
        y: { name: 'Y Axis', value: 20 },
        group: { name: 'Model Type', value: 'gpt-4o' },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('Model Type');
      expect(html).toContain('gpt-4o');
    });

    it('displays custom aggregate label when provided', () => {
      const data: InfoCardData = {
        x: { name: 'X Axis', value: 10 },
        y: { name: 'Y Axis', value: 20 },
        aggregate: { name: 'Total Revenue' },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('Total Revenue');
    });

    it('falls back to field names when custom labels not provided', () => {
      const data: InfoCardData = {
        x: { name: 'table1.timestamp', value: 1705320000000 },
        y: { name: 'table1.value', value: 100 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('table1.timestamp');
      expect(html).toContain('table1.value');
    });

    it('handles all custom labels together', () => {
      const data: InfoCardData = {
        x: { name: 'Day', value: '2024-01-15' },
        y: { name: 'Billed Cost', value: 150.75 },
        group: { name: 'Model', value: 'claude-3-opus' },
        aggregate: { name: 'Sum of Costs' },
      };

      const html = tooltipTemplate(data);

      // All custom labels should be present
      expect(html).toContain('Day');
      expect(html).toContain('2024-01-15');
      expect(html).toContain('Billed Cost');
      expect(html).toContain('150.75');
      expect(html).toContain('Model');
      expect(html).toContain('claude-3-opus');
      expect(html).toContain('Sum of Costs');
    });
  });

  // ===========================================================================
  // Formatted Values (for tick formatters passed through)
  // ===========================================================================

  describe('formatted values', () => {
    it('displays pre-formatted currency values', () => {
      // When tick formatters are used, values come pre-formatted
      const data: InfoCardData = {
        x: { name: 'Day', value: '2024-01-15' },
        y: { name: 'Cost', value: 1234.56 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('1234.56');
    });

    it('displays pre-formatted percentage values', () => {
      const data: InfoCardData = {
        x: { name: 'Category', value: 'A' },
        y: { name: 'Rate', value: 75 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('75');
    });

    it('displays pre-formatted date strings', () => {
      const data: InfoCardData = {
        x: { name: 'Time', value: 'Jan 15, 2024' },
        y: { name: 'Count', value: 42 },
      };

      const html = tooltipTemplate(data);

      expect(html).toContain('Jan 15, 2024');
    });
  });
});
