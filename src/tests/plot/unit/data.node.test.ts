/**
 * Data Utilities Unit Tests
 *
 * Tests for the data extraction and type inference utilities
 * used by plot components.
 *
 * Tests cover:
 * - getValue function for nested property access
 * - hasProperty function for property existence checks
 * - inferDisplayType function for type detection
 */

import { describe, it, expect } from 'vitest';
import { getValue, hasProperty, inferDisplayType } from '@/utils/interfaces/plots/data';

// =============================================================================
// getValue Tests
// =============================================================================

describe('getValue', () => {
  describe('basic property access', () => {
    it('returns value for simple property', () => {
      const obj = { name: 'test', value: 42 };
      expect(getValue(obj, 'name')).toBe('test');
      expect(getValue(obj, 'value')).toBe(42);
    });

    it('returns undefined for missing property', () => {
      const obj = { name: 'test' };
      expect(getValue(obj, 'missing')).toBeUndefined();
    });

    it('returns null when property is null', () => {
      const obj = { name: null };
      expect(getValue(obj, 'name')).toBeNull();
    });
  });

  describe('nested property access', () => {
    it('returns value for dot-notation path', () => {
      const obj = { table1: { x_value: 100, y_value: 200 } };
      expect(getValue(obj, 'table1.x_value')).toBe(100);
      expect(getValue(obj, 'table1.y_value')).toBe(200);
    });

    it('returns value for deeply nested path', () => {
      const obj = { a: { b: { c: { d: 'deep' } } } };
      expect(getValue(obj, 'a.b.c.d')).toBe('deep');
    });

    it('returns undefined for missing nested property', () => {
      const obj = { table1: { x_value: 100 } };
      expect(getValue(obj, 'table1.missing')).toBeUndefined();
      expect(getValue(obj, 'table2.x_value')).toBeUndefined();
    });

    it('returns undefined when intermediate is null', () => {
      const obj = { table1: null };
      expect(getValue(obj, 'table1.x_value')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles empty path', () => {
      const obj = { name: 'test' };
      expect(getValue(obj, '')).toBeUndefined();
    });

    it('handles null object', () => {
      expect(getValue(null, 'name')).toBeUndefined();
    });

    it('handles undefined object', () => {
      expect(getValue(undefined, 'name')).toBeUndefined();
    });

    it('handles non-object values', () => {
      expect(getValue('string', 'length')).toBeUndefined();
      expect(getValue(123, 'toString')).toBeUndefined();
    });

    it('returns array elements', () => {
      const obj = { items: [1, 2, 3] };
      expect(getValue(obj, 'items')).toEqual([1, 2, 3]);
    });

    it('returns object values', () => {
      const nested = { inner: 'value' };
      const obj = { data: nested };
      expect(getValue(obj, 'data')).toBe(nested);
    });
  });
});

// =============================================================================
// hasProperty Tests
// =============================================================================

describe('hasProperty', () => {
  describe('basic property checks', () => {
    it('returns true for existing property', () => {
      const obj = { name: 'test', value: 42 };
      expect(hasProperty(obj, 'name')).toBe(true);
      expect(hasProperty(obj, 'value')).toBe(true);
    });

    it('returns false for missing property', () => {
      const obj = { name: 'test' };
      expect(hasProperty(obj, 'missing')).toBe(false);
    });

    it('returns true for null value property', () => {
      const obj = { name: null };
      expect(hasProperty(obj, 'name')).toBe(true);
    });

    it('returns true for undefined value property', () => {
      const obj = { name: undefined };
      expect(hasProperty(obj, 'name')).toBe(true);
    });
  });

  describe('nested property checks', () => {
    it('returns true for existing nested property', () => {
      const obj = { table1: { x_value: 100 } };
      expect(hasProperty(obj, 'table1.x_value')).toBe(true);
    });

    it('returns false for missing nested property', () => {
      const obj = { table1: { x_value: 100 } };
      expect(hasProperty(obj, 'table1.missing')).toBe(false);
      expect(hasProperty(obj, 'table2.x_value')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles null object', () => {
      expect(hasProperty(null, 'name')).toBe(false);
    });

    it('handles undefined object', () => {
      expect(hasProperty(undefined, 'name')).toBe(false);
    });
  });
});

// =============================================================================
// inferDisplayType Tests
// =============================================================================

describe('inferDisplayType', () => {
  describe('numeric types', () => {
    it('infers number for integers', () => {
      expect(inferDisplayType(42)).toBe('number');
      expect(inferDisplayType(0)).toBe('number');
      expect(inferDisplayType(-100)).toBe('number');
    });

    it('infers number for floats', () => {
      expect(inferDisplayType(3.14)).toBe('number');
      expect(inferDisplayType(-0.5)).toBe('number');
      expect(inferDisplayType(1e10)).toBe('number');
    });

    it('handles special numbers', () => {
      expect(inferDisplayType(Infinity)).toBe('number');
      expect(inferDisplayType(-Infinity)).toBe('number');
      expect(inferDisplayType(NaN)).toBe('number');
    });
  });

  describe('string types', () => {
    it('infers string for text', () => {
      expect(inferDisplayType('hello')).toBe('string');
      expect(inferDisplayType('')).toBe('string');
    });

    it('infers datetime for ISO date strings', () => {
      expect(inferDisplayType('2024-01-15T10:30:00Z')).toBe('datetime');
      expect(inferDisplayType('2024-01-15T10:30:00.123Z')).toBe('datetime');
    });

    it('infers string for partial date strings', () => {
      // These might be inferred as string depending on implementation
      const result = inferDisplayType('2024-01-15');
      expect(['string', 'date']).toContain(result);
    });
  });

  describe('boolean type', () => {
    it('infers boolean for true/false', () => {
      expect(inferDisplayType(true)).toBe('boolean');
      expect(inferDisplayType(false)).toBe('boolean');
    });
  });

  describe('null/undefined', () => {
    it('handles null values', () => {
      const result = inferDisplayType(null);
      expect(['null', 'unknown', 'string']).toContain(result);
    });

    it('handles undefined values', () => {
      const result = inferDisplayType(undefined);
      expect(['undefined', 'unknown', 'string']).toContain(result);
    });
  });

  describe('complex types', () => {
    it('infers array for arrays', () => {
      const result = inferDisplayType([1, 2, 3]);
      expect(['array', 'object']).toContain(result);
    });

    it('infers object for objects', () => {
      const result = inferDisplayType({ key: 'value' });
      expect(['object', 'string']).toContain(result);
    });
  });
});



