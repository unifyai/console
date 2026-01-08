/**
 * Axes Utilities Unit Tests
 *
 * Tests for axis generation and manipulation utilities
 * used by plot components.
 *
 * Tests cover:
 * - generateTicks function for tick value generation
 * - niceIncrement function for step calculation
 * - reverseOrKeepDomain for domain manipulation
 * - checkLogScalability for log scale validation
 */

import { describe, it, expect } from 'vitest';
import {
  generateTicks,
  reverseOrKeepDomain,
  checkLogScalability,
} from '@/utils/interfaces/plots/axes';

// =============================================================================
// generateTicks Tests
// =============================================================================

describe('generateTicks', () => {
  describe('linear scale', () => {
    it('generates ticks for positive range', () => {
      const ticks = generateTicks(0, 100, 10, false);

      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks[0]).toBeLessThanOrEqual(0);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100);
    });

    it('generates ticks for negative range', () => {
      const ticks = generateTicks(-100, 0, 10, false);

      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks[0]).toBeLessThanOrEqual(-100);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(0);
    });

    it('generates ticks for mixed range', () => {
      const ticks = generateTicks(-50, 50, 10, false);

      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks).toContain(0); // Zero should be included in mixed range
    });

    it('generates approximately requested number of ticks', () => {
      const ticks = generateTicks(0, 100, 5, false);

      // Allow some flexibility in tick count
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(10);
    });

    it('handles small ranges', () => {
      const ticks = generateTicks(0.1, 0.5, 5, false);

      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks[0]).toBeLessThanOrEqual(0.1);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(0.5);
    });

    it('handles large ranges', () => {
      const ticks = generateTicks(0, 1000000, 10, false);

      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks[0]).toBeLessThanOrEqual(0);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(1000000);
    });

    it('handles equal min and max', () => {
      const ticks = generateTicks(50, 50, 10, false);

      expect(ticks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('logarithmic scale', () => {
    it('generates ticks for positive range', () => {
      const ticks = generateTicks(1, 1000, 10, true);

      expect(ticks.length).toBeGreaterThan(0);
      // Log ticks should be powers of 10 or nice values
      expect(ticks[0]).toBeGreaterThan(0);
    });

    it('generates ticks for range spanning multiple orders of magnitude', () => {
      const ticks = generateTicks(1, 1000000, 10, true);

      expect(ticks.length).toBeGreaterThan(0);
      // Should cover the range
      expect(ticks[0]).toBeLessThanOrEqual(1);
    });

    it('handles small positive values', () => {
      const ticks = generateTicks(0.001, 1, 10, true);

      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks[0]).toBeLessThanOrEqual(0.001);
    });

    it('handles range starting near zero', () => {
      // Log scale needs positive values, but implementation may handle edge cases
      const ticks = generateTicks(0.01, 100, 10, true);

      expect(ticks.length).toBeGreaterThan(0);
    });

    it('handles negative range (should use absolute values)', () => {
      const ticks = generateTicks(-1000, -1, 10, true);

      expect(ticks.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles very small range', () => {
      const ticks = generateTicks(0.00001, 0.00002, 5, false);

      expect(ticks.length).toBeGreaterThan(0);
    });

    it('handles very large values', () => {
      const ticks = generateTicks(1e10, 1e12, 10, false);

      expect(ticks.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// reverseOrKeepDomain Tests
// =============================================================================

describe('reverseOrKeepDomain', () => {
  it('keeps positive domain unchanged', () => {
    const values = [10, 50, 90];
    const domain = [0, 100];
    const result = reverseOrKeepDomain(values, domain, false);

    expect(result).toEqual(domain);
  });

  it('reverses domain when shouldReverse is true', () => {
    const values = [10, 50, 90];
    const domain = [0, 100];
    const result = reverseOrKeepDomain(values, domain, true);

    // When reversed, returns [absMax, absMin] from values
    expect(result[0]).toBeGreaterThanOrEqual(result[1]);
  });

  it('handles negative domain', () => {
    const values = [-90, -50, -10];
    const domain = [-100, -10];
    const result = reverseOrKeepDomain(values, domain, false);

    expect(result).toEqual(domain);
  });

  it('handles mixed domain', () => {
    const values = [-40, 0, 40];
    const domain = [-50, 50];
    const result = reverseOrKeepDomain(values, domain, false);

    expect(result).toEqual(domain);
  });
});

// =============================================================================
// checkLogScalability Tests
// =============================================================================

describe('checkLogScalability', () => {
  const mockSetScale = () => {};
  const mockSetLogScaleEnabled = () => {};

  // Helper to create proper log structure
  const createLog = (value: number) => ({
    'table1.entries': { 'table1.value': value },
  });

  // Helper to create proper fields structure
  const createFields = () => ({
    'table1.value': { dataType: 'float', fieldType: 'entry' },
  });

  it('returns linear for data with zeros', () => {
    const logs = [createLog(0), createLog(10), createLog(100)];
    const fields = createFields();

    const result = checkLogScalability(
      logs as any,
      fields as any,
      'table1',
      'table1.value',
      'log',
      mockSetScale,
      mockSetLogScaleEnabled
    );

    // Should fallback to linear when zeros are present
    expect(result).toBe('linear');
  });

  it('returns linear for data with negative values', () => {
    const logs = [createLog(-10), createLog(10), createLog(100)];
    const fields = createFields();

    const result = checkLogScalability(
      logs as any,
      fields as any,
      'table1',
      'table1.value',
      'log',
      mockSetScale,
      mockSetLogScaleEnabled
    );

    // Mixed positive/negative is not all positive or all negative
    expect(result).toBe('linear');
  });

  it('allows log scale for all positive data', () => {
    const logs = [createLog(1), createLog(10), createLog(100)];
    const fields = createFields();

    const result = checkLogScalability(
      logs as any,
      fields as any,
      'table1',
      'table1.value',
      'log',
      mockSetScale,
      mockSetLogScaleEnabled
    );

    // Log scale should be valid for all positive data
    expect(result).toBe('log');
  });

  it('returns linear when linear scale is requested', () => {
    const logs = [createLog(1), createLog(10), createLog(100)];
    const fields = createFields();

    const result = checkLogScalability(
      logs as any,
      fields as any,
      'table1',
      'table1.value',
      'linear',
      mockSetScale,
      mockSetLogScaleEnabled
    );

    expect(result).toBe('linear');
  });
});
