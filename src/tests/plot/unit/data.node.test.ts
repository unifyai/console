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
import type { LogFieldsResponseProps, LogProps } from '@/types/interfaces/logs';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a mock fields object with a single field definition.
 */
function createMockFields(
  fieldName: string,
  dataType: string,
  fieldType: 'entry' | 'param' | 'derived_entry' = 'entry'
): LogFieldsResponseProps {
  return {
    [fieldName]: {
      dataType: dataType,
      fieldType: fieldType,
    },
  } as LogFieldsResponseProps;
}

/**
 * Creates a mock log object with a value at the specified field.
 */
function createMockLog(
  table: string,
  fieldName: string,
  value: unknown,
  fieldType: 'entry' | 'param' | 'derived_entry' = 'entry'
): LogProps {
  const key = fieldType === 'derived_entry'
    ? `${table}.derivedEntries`
    : fieldType === 'param'
      ? `${table}.params`
      : `${table}.entries`;

  return {
    [key]: {
      [fieldName]: value,
    },
  } as LogProps;
}

// =============================================================================
// hasProperty Tests
// =============================================================================

describe('hasProperty', () => {
  const table = 'table1';
  const fieldName = 'test_field';

  describe('basic property checks', () => {
    it('returns true for existing entry property', () => {
      const fields = createMockFields(fieldName, 'float', 'entry');
      const log = createMockLog(table, fieldName, 42, 'entry');
      expect(hasProperty(fields, fieldName, log, table)).toBe(true);
    });

    it('returns false for missing property', () => {
      const fields = createMockFields(fieldName, 'float', 'entry');
      const log = createMockLog(table, 'other_field', 42, 'entry');
      expect(hasProperty(fields, fieldName, log, table)).toBe(false);
    });

    it('returns true for null value property', () => {
      const fields = createMockFields(fieldName, 'float', 'entry');
      const log = createMockLog(table, fieldName, null, 'entry');
      // The hasProperty check uses !== undefined, so null is considered "exists"
      expect(hasProperty(fields, fieldName, log, table)).toBe(true);
    });

    it('returns false for undefined value property', () => {
      const fields = createMockFields(fieldName, 'float', 'entry');
      const log = createMockLog(table, fieldName, undefined, 'entry');
      expect(hasProperty(fields, fieldName, log, table)).toBe(false);
    });
  });

  describe('field type handling', () => {
    it('checks derived_entry location', () => {
      const fields = createMockFields(fieldName, 'float', 'derived_entry');
      const log = createMockLog(table, fieldName, 100, 'derived_entry');
      expect(hasProperty(fields, fieldName, log, table)).toBe(true);
    });

    it('checks param location', () => {
      const fields = createMockFields(fieldName, 'string', 'param');
      const log = createMockLog(table, fieldName, 'test', 'param');
      expect(hasProperty(fields, fieldName, log, table)).toBe(true);
    });

    it('returns false when value is in wrong location', () => {
      const fields = createMockFields(fieldName, 'float', 'param');
      const log = createMockLog(table, fieldName, 42, 'entry'); // Value is in entries, not params
      expect(hasProperty(fields, fieldName, log, table)).toBeFalsy();
    });
  });

  describe('edge cases', () => {
    it('handles missing entries object', () => {
      const fields = createMockFields(fieldName, 'float', 'entry');
      const log = {} as LogProps;
      expect(hasProperty(fields, fieldName, log, table)).toBeFalsy();
    });

    it('defaults to entry field type when field not in metadata', () => {
      const fields = {} as LogFieldsResponseProps;
      const log = createMockLog(table, fieldName, 42, 'entry');
      expect(hasProperty(fields, fieldName, log, table)).toBe(true);
    });
  });
});

// =============================================================================
// getValue Tests
// =============================================================================

describe('getValue', () => {
  const table = 'table1';
  const fieldName = 'test_field';

  describe('basic value retrieval', () => {
    it('returns numeric value for float field', () => {
      const fields = createMockFields(fieldName, 'float', 'entry');
      const log = createMockLog(table, fieldName, 42.5, 'entry');
      expect(getValue(fields, fieldName, log, table)).toBe(42.5);
    });

    it('returns string value for string field', () => {
      const fields = createMockFields(fieldName, 'string', 'entry');
      const log = createMockLog(table, fieldName, 'hello', 'entry');
      expect(getValue(fields, fieldName, log, table)).toBe('hello');
    });

    it('returns undefined for missing property', () => {
      const fields = createMockFields(fieldName, 'float', 'entry');
      const log = createMockLog(table, 'other_field', 42, 'entry');
      expect(getValue(fields, fieldName, log, table)).toBeUndefined();
    });
  });

  describe('field type handling', () => {
    it('retrieves value from derivedEntries', () => {
      const fields = createMockFields(fieldName, 'float', 'derived_entry');
      const log = createMockLog(table, fieldName, 100, 'derived_entry');
      expect(getValue(fields, fieldName, log, table)).toBe(100);
    });

    it('retrieves value from params', () => {
      const fields = createMockFields(fieldName, 'string', 'param');
      const log = createMockLog(table, fieldName, 'param_value', 'param');
      expect(getValue(fields, fieldName, log, table)).toBe('param_value');
    });
  });

  describe('data type conversions', () => {
    it('converts timestamp to milliseconds', () => {
      const fields = createMockFields(fieldName, 'timestamp', 'entry');
      const dateStr = '2024-01-15T10:30:00Z';
      const log = createMockLog(table, fieldName, dateStr, 'entry');
      const result = getValue(fields, fieldName, log, table);
      expect(result).toBe(new Date(dateStr).getTime());
    });

    it('converts date to milliseconds', () => {
      const fields = createMockFields(fieldName, 'date', 'entry');
      const dateStr = '2024-01-15';
      const log = createMockLog(table, fieldName, dateStr, 'entry');
      const result = getValue(fields, fieldName, log, table);
      expect(result).toBe(new Date(dateStr).getTime());
    });

    it('converts boolean true to 1', () => {
      const fields = createMockFields(fieldName, 'bool', 'entry');
      const log = createMockLog(table, fieldName, true, 'entry');
      expect(getValue(fields, fieldName, log, table)).toBe(1);
    });

    it('converts boolean false to 0', () => {
      const fields = createMockFields(fieldName, 'bool', 'entry');
      const log = createMockLog(table, fieldName, false, 'entry');
      expect(getValue(fields, fieldName, log, table)).toBe(0);
    });

    it('converts string "true" to 1 for bool type', () => {
      const fields = createMockFields(fieldName, 'bool', 'entry');
      const log = createMockLog(table, fieldName, 'true', 'entry');
      expect(getValue(fields, fieldName, log, table)).toBe(1);
    });

    it('converts string "false" to 0 for bool type', () => {
      const fields = createMockFields(fieldName, 'bool', 'entry');
      const log = createMockLog(table, fieldName, 'false', 'entry');
      expect(getValue(fields, fieldName, log, table)).toBe(0);
    });
  });

  describe('Any type handling', () => {
    it('parses numeric string for Any type', () => {
      const fields = createMockFields(fieldName, 'Any', 'entry');
      const log = createMockLog(table, fieldName, '123.45', 'entry');
      const result = getValue(fields, fieldName, log, table);
      // Any type tries to parse as date first, then number
      expect(typeof result).toBe('number');
    });

    it('parses date string for Any type', () => {
      const fields = createMockFields(fieldName, 'Any', 'entry');
      const dateStr = '2024-01-15T10:30:00Z';
      const log = createMockLog(table, fieldName, dateStr, 'entry');
      const result = getValue(fields, fieldName, log, table);
      expect(result).toBe(new Date(dateStr).getTime());
    });
  });
});

// =============================================================================
// inferDisplayType Tests
// =============================================================================

describe('inferDisplayType', () => {
  const table = 'table1';
  const fieldName = 'test_field';

  describe('explicit data types', () => {
    it('returns float for float data type', () => {
      const fields = createMockFields(fieldName, 'float', 'entry');
      const logs = [createMockLog(table, fieldName, 42.5, 'entry')];
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('float');
    });

    it('returns int for int data type', () => {
      const fields = createMockFields(fieldName, 'int', 'entry');
      const logs = [createMockLog(table, fieldName, 42, 'entry')];
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('int');
    });

    it('returns string for string data type', () => {
      const fields = createMockFields(fieldName, 'string', 'entry');
      const logs = [createMockLog(table, fieldName, 'hello', 'entry')];
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('string');
    });

    it('returns timestamp for timestamp data type', () => {
      const fields = createMockFields(fieldName, 'timestamp', 'entry');
      const logs = [createMockLog(table, fieldName, '2024-01-15T10:30:00Z', 'entry')];
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('timestamp');
    });

    it('returns bool for bool data type', () => {
      const fields = createMockFields(fieldName, 'bool', 'entry');
      const logs = [createMockLog(table, fieldName, true, 'entry')];
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('bool');
    });
  });

  describe('Any type inference', () => {
    it('infers timestamp for date-like strings', () => {
      const fields = createMockFields(fieldName, 'Any', 'entry');
      const logs = [
        createMockLog(table, fieldName, '2024-01-15T10:30:00Z', 'entry'),
        createMockLog(table, fieldName, '2024-02-20T15:45:00Z', 'entry'),
      ];
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('timestamp');
    });

    it('returns float as default for Any type with non-date values', () => {
      const fields = createMockFields(fieldName, 'Any', 'entry');
      const logs = [
        createMockLog(table, fieldName, 42.5, 'entry'),
        createMockLog(table, fieldName, 100, 'entry'),
      ];
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('float');
    });

    it('handles empty logs array', () => {
      const fields = createMockFields(fieldName, 'Any', 'entry');
      const logs: LogProps[] = [];
      // Should return float as default
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('float');
    });

    it('handles logs with missing field values', () => {
      const fields = createMockFields(fieldName, 'Any', 'entry');
      const logs = [
        createMockLog(table, 'other_field', 42, 'entry'),
        createMockLog(table, 'other_field', 100, 'entry'),
      ];
      // Should return float as default when field not found
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('float');
    });
  });

  describe('edge cases', () => {
    it('handles missing field in metadata', () => {
      const fields = {} as LogFieldsResponseProps;
      const logs = [createMockLog(table, fieldName, 42, 'entry')];
      // Missing field should return float (default)
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('float');
    });

    it('samples up to 5 logs for inference', () => {
      const fields = createMockFields(fieldName, 'Any', 'entry');
      // Create 10 logs - function should only sample first 5
      const logs = Array.from({ length: 10 }, (_, i) =>
        createMockLog(table, fieldName, `2024-01-${(i + 1).toString().padStart(2, '0')}T00:00:00Z`, 'entry')
      );
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('timestamp');
    });

    it('skips null values during inference', () => {
      const fields = createMockFields(fieldName, 'Any', 'entry');
      const logs = [
        createMockLog(table, fieldName, null, 'entry'),
        createMockLog(table, fieldName, '2024-01-15T10:30:00Z', 'entry'),
      ];
      expect(inferDisplayType(fields, fieldName, logs, table)).toBe('timestamp');
    });
  });
});
