/**
 * Key (Legend) Utilities Unit Tests
 *
 * Tests for grouping key/legend generation utilities
 * used by plot components.
 *
 * Tests cover:
 * - keyTemplate function for HTML generation
 * - GroupingColors handling
 */

import { describe, it, expect } from 'vitest';
import { keyTemplate } from '@/utils/interfaces/plots/key';
import type { GroupingColors } from '@/types/interfaces/plot';

// =============================================================================
// keyTemplate Tests
// =============================================================================

describe('keyTemplate', () => {
  describe('basic functionality', () => {
    it('generates HTML for single color entry', () => {
      const colors: GroupingColors = [
        { key: 'Category A', color: '#ff0000' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('Category A');
      expect(html).toContain('#ff0000');
    });

    it('generates HTML for multiple color entries', () => {
      const colors: GroupingColors = [
        { key: 'Category A', color: '#ff0000' },
        { key: 'Category B', color: '#00ff00' },
        { key: 'Category C', color: '#0000ff' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('Category A');
      expect(html).toContain('Category B');
      expect(html).toContain('Category C');
      expect(html).toContain('#ff0000');
      expect(html).toContain('#00ff00');
      expect(html).toContain('#0000ff');
    });

    it('creates correct structure for each entry', () => {
      const colors: GroupingColors = [
        { key: 'Test', color: '#123456' },
      ];

      const html = keyTemplate(colors);

      // Should have the key container
      expect(html).toContain('class="key');
      // Should have the color dot
      expect(html).toContain('rounded-full');
      expect(html).toContain('background-color: #123456');
      // Should have the text
      expect(html).toContain('Test');
    });
  });

  describe('null and empty handling', () => {
    it('handles null key value', () => {
      const colors: GroupingColors = [
        { key: null, color: '#ff0000' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('null');
    });

    it('handles empty colors array', () => {
      const colors: GroupingColors = [];

      const html = keyTemplate(colors);

      expect(html).toBe('');
    });
  });

  describe('key value formatting', () => {
    it('strips quotes from JSON stringified keys', () => {
      const colors: GroupingColors = [
        { key: '"Quoted Value"', color: '#ff0000' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('Quoted Value');
      // Should not have the outer quotes
      expect(html).not.toContain('"Quoted Value"');
    });

    it('handles numeric keys as strings', () => {
      const colors: GroupingColors = [
        { key: '123', color: '#ff0000' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('123');
    });

    it('handles special characters in keys', () => {
      const colors: GroupingColors = [
        { key: 'Test & Category', color: '#ff0000' },
        { key: 'Category <1>', color: '#00ff00' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('Test & Category');
      expect(html).toContain('Category <1>');
    });
  });

  describe('styling', () => {
    it('applies truncate class for long text', () => {
      const colors: GroupingColors = [
        { key: 'Very Long Category Name That Should Be Truncated', color: '#ff0000' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('truncate');
    });

    it('applies correct sizing to color dot', () => {
      const colors: GroupingColors = [
        { key: 'Test', color: '#ff0000' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('h-2');
      expect(html).toContain('w-2');
    });

    it('applies shrink-0 to prevent dot resizing', () => {
      const colors: GroupingColors = [
        { key: 'Test', color: '#ff0000' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('shrink-0');
    });
  });

  describe('multiple entries ordering', () => {
    it('preserves order of entries', () => {
      const colors: GroupingColors = [
        { key: 'First', color: '#ff0000' },
        { key: 'Second', color: '#00ff00' },
        { key: 'Third', color: '#0000ff' },
      ];

      const html = keyTemplate(colors);

      const firstIndex = html.indexOf('First');
      const secondIndex = html.indexOf('Second');
      const thirdIndex = html.indexOf('Third');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });
  });

  describe('color format handling', () => {
    it('handles hex colors', () => {
      const colors: GroupingColors = [
        { key: 'Test', color: '#ff5733' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('#ff5733');
    });

    it('handles rgb colors', () => {
      const colors: GroupingColors = [
        { key: 'Test', color: 'rgb(255, 87, 51)' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('rgb(255, 87, 51)');
    });

    it('handles named colors', () => {
      const colors: GroupingColors = [
        { key: 'Test', color: 'red' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('background-color: red');
    });

    it('handles hsl colors', () => {
      const colors: GroupingColors = [
        { key: 'Test', color: 'hsl(14, 100%, 60%)' },
      ];

      const html = keyTemplate(colors);

      expect(html).toContain('hsl(14, 100%, 60%)');
    });
  });
});


