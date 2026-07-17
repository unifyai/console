import { describe, it, expect } from 'vitest';
import {
  separateFunctionFilters,
  searchParamToFilters,
  filtersToExpression,
  compileClausesToExpression,
  buildFilterExpression,
  toRelativeDate,
  toAbsoluteDate,
  rebaseDate,
  initFilters,
  combineFilters,
  now,
  defaultRelativeDate,
  defaultAbsoluteDate,
} from '@/utils/interfaces/table/filters';
import { LogFieldsResponseProps } from '@/types/interfaces/logs';
import { AbsoluteDateString, RelativeDateString } from '@/types/interfaces/filters';

describe('filters', () => {
  const mockFields: LogFieldsResponseProps = {
    'entries/val': {
      dataType: 'float',
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: '',
    },
    'entries/str': {
      dataType: 'string',
      fieldType: 'entry',
      artifacts: '',
      mutable: 'false',
      createdAt: '',
    },
  };

  describe('separateFunctionFilters', () => {
    it('separates filters joined by && and ||', () => {
      const input = 'first || second && third';
      const expected = ['first', '||', 'second', '&&', 'third'];
      expect(separateFunctionFilters(input)).toEqual(expected);
    });

    it('handles leading empty strings', () => {
      const input = ' || first';
      const expected = ['||', 'first'];
      expect(separateFunctionFilters(input)).toEqual(expected);
    });
  });

  describe('searchParamToFilters', () => {
    it('converts search expression to nested filter object', () => {
      const input = 'col1~eq~val1§col2~gt~5';
      const expected = {
        col1: { eq: 'val1' },
        col2: { gt: '5' },
      };
      expect(searchParamToFilters(input, undefined)).toEqual(expected);
    });

    it('merges multiple filters for same column', () => {
      const input = 'col1~gt~5§col1~lt~10';
      const expected = {
        col1: { gt: '5', lt: '10' },
      };
      expect(searchParamToFilters(input, undefined)).toEqual(expected);
    });

    it('applies column context if provided', () => {
      const input = 'col1~eq~val1';
      const result = searchParamToFilters(input, 'ctx');
      expect(result).toHaveProperty('ctx/col1');
    });
  });

  describe('filtersToExpression', () => {
    it('converts filter object to string expression', () => {
      const filters = {
        'entries/val': { '>': '5', '<': '10' },
      };
      const result = filtersToExpression(filters, mockFields);
      expect(result).toContain('(entries/val > 5) and (entries/val < 10)');
    });

    it('handles expression mode', () => {
      const filters = {
        'entries/val': { expression: 'x > 5' },
      };
      const result = filtersToExpression(filters, mockFields);
      expect(result).toContain('(x > 5)');
    });

    it('compiles structured clauses with grouped or spans', () => {
      const clauses = [
        { fn: 'in', value: '"Ada"' },
        { fn: 'in', value: '"Alan"', join: 'or' as const, grouped: true },
        { fn: '!=', value: '"x"', join: 'and' as const, grouped: false },
        { fn: '!=', value: '"y"', join: 'or' as const, grouped: true },
      ];
      const compiled = compileClausesToExpression(clauses, 'entries/str', mockFields);
      expect(compiled).toBe(
        `("Ada" in entries/str or "Alan" in entries/str) and (entries/str != "x" or entries/str != "y")`
      );

      const filters = {
        'entries/str': { clauses: JSON.stringify(clauses) },
      };
      const result = filtersToExpression(filters, mockFields);
      expect(result).toContain(compiled);
    });
  });

  describe('buildFilterExpression', () => {
    // Debugging test to isolate the failure
    it('debug chain', () => {
      const filters = 'entries/val~>~5';
      const parsed = searchParamToFilters(filters, undefined);
      // console.log('Parsed:', JSON.stringify(parsed));
      const expr = filtersToExpression(parsed, mockFields);
      // console.log('Expr:', expr);
      expect(expr).toContain('entries/val > 5');
    });

    it('combines column filters, common filters, and freeze', () => {
      const filters = 'entries/val~>~5';
      const common = 'search§term'; // mode§value
      const freeze = '2025-01-01T00:00:00Z';

      const result = buildFilterExpression(filters, common, undefined, freeze, mockFields);

      expect(result).not.toBeNull();
      // Expect result to contain all parts.
      // Note: filtersToExpression might add parens.

      // Checking for the presence of the column filter part
      expect(result).toContain('entries/val > 5');
      // Checking for the presence of the common filter part (search term)
      // It should search in string representations of columns.
      // Note: The implementation puts common filter FIRST if both exist.
      // Expected order based on impl: common AND column AND freeze

      // Logic:
      // 1. columnFiltersExpression calculated.
      // 2. commonFiltersExpression calculated.
      // 3. if (common) expr = common + " and " + column
      // 4. if (freeze) expr = expr + " and " + freeze

      // So "common" comes before "column".

      expect(result).toContain('entries/val > 5');
      expect(result).toContain('"term" in str(entries/val)');
      expect(result).toContain(`createdAt < "${freeze}"`);
    });

    it('returns null/empty string if no inputs', () => {
      expect(
        buildFilterExpression(undefined, undefined, undefined, undefined, mockFields)
      ).toBeNull();
    });
  });

  describe('Date Utils', () => {
    const baseDate = new Date('2024-01-01T12:00:00.000Z');

    describe('toRelativeDate', () => {
      it('calculates exact difference', () => {
        // 1 year, 1 month, 1 day later
        const target = new Date('2025-02-02T12:00:00.000Z');
        const relative = toRelativeDate(target.toISOString() as AbsoluteDateString, baseDate);
        // Expect: 1Y;1M;1D;0h;0m;0s;0ms
        expect(relative).toBe('1Y;1M;1D;0h;0m;0s;0ms');
      });

      it('calculates time difference', () => {
        // 1 hour, 30 minutes, 15 seconds later
        const target = new Date('2024-01-01T13:30:15.000Z');
        const relative = toRelativeDate(target.toISOString() as AbsoluteDateString, baseDate);
        expect(relative).toBe('0Y;0M;0D;1h;30m;15s;0ms');
      });

      it('handles same date', () => {
        const relative = toRelativeDate(baseDate.toISOString() as AbsoluteDateString, baseDate);
        expect(relative).toBe(defaultRelativeDate);
      });
    });

    describe('toAbsoluteDate', () => {
      // Note: toAbsoluteDate uses global 'now' from the module, which is fixed at import time.
      // To test this reliably without mocking the module-level const, we might need to
      // verify it subtracts correctly from *that* 'now'.

      it('converts relative zero to current time (approx)', () => {
        const abs = toAbsoluteDate(defaultRelativeDate);
        // Should be very close to 'now' - allow up to 5 seconds tolerance
        // for module load time and test execution time differences
        const absTime = new Date(abs).getTime();
        const nowTime = now.getTime();
        expect(Math.abs(absTime - nowTime)).toBeLessThan(5000);
      });

      it('subtracts offsets correctly', () => {
        // 1 Year ago
        const relative = '1Y;0M;0D;0h;0m;0s;0ms' as RelativeDateString;
        const abs = toAbsoluteDate(relative);
        const date = new Date(abs);

        // Check year difference
        expect(date.getFullYear()).toBe(now.getFullYear() - 1);
        // Check other fields match 'now'
        expect(date.getMonth()).toBe(now.getMonth());
        expect(date.getDate()).toBe(now.getDate());
      });
    });

    describe('rebaseDate', () => {
      it('converts absolute to relative using module now', () => {
        const target = new Date(now);
        target.setFullYear(target.getFullYear() - 1); // 1 year ago

        const result = rebaseDate(target.toISOString() as AbsoluteDateString, 'relative');
        // Should be roughly 1Y... (ignoring small ms diffs execution time)
        expect(result).toMatch(/^1Y;0M;0D;/);
      });

      it('converts relative to absolute', () => {
        const relative = '1Y;0M;0D;0h;0m;0s;0ms' as RelativeDateString;
        const result = rebaseDate(relative, 'absolute');
        const date = new Date(result);
        expect(date.getFullYear()).toBe(now.getFullYear() - 1);
      });

      it('returns input if already in target format', () => {
        const abs = defaultAbsoluteDate;
        expect(rebaseDate(abs, 'absolute')).toBe(abs);

        const rel = defaultRelativeDate;
        expect(rebaseDate(rel, 'relative')).toBe(rel);
      });
    });
  });

  describe('UI Filter Helpers', () => {
    describe('initFilters', () => {
      it('parses simple filter string into UI objects', () => {
        const columnFilters = {
          col1: { contains: 'foo' },
        };
        const initialValues: any[] = [];

        initFilters('col1', columnFilters, initialValues, ['contains']);

        expect(initialValues).toHaveLength(1);
        expect(initialValues[0]).toEqual({
          key: 0,
          mode: 'contains',
          join: '&&',
          value: 'foo',
        });
      });

      it('parses complex joined filter string', () => {
        const columnFilters = {
          col1: { contains: 'foo || bar' },
        };
        const initialValues: any[] = [];

        initFilters('col1', columnFilters, initialValues, ['contains']);

        expect(initialValues).toHaveLength(2);
        expect(initialValues[0].value).toBe('foo');
        expect(initialValues[1]).toEqual({
          key: 1,
          mode: 'contains',
          join: '||',
          value: 'bar',
        });
      });
    });

    describe('combineFilters', () => {
      it('combines UI objects back into string', () => {
        const newFilters = [
          { key: 0, mode: 'contains', join: '&&' as const, value: 'foo' },
          { key: 1, mode: 'contains', join: '||' as const, value: 'bar' },
        ];

        const result = combineFilters(newFilters, ['contains']);

        expect(result).toEqual({
          contains: 'foo || bar',
        });
      });

      it('handles multiple modes separately', () => {
        const newFilters = [
          { key: 0, mode: 'contains', join: '&&' as const, value: 'foo' },
          { key: 1, mode: 'equals', join: '&&' as const, value: 'baz' },
        ];

        const result = combineFilters(newFilters, ['contains', 'equals']);

        expect(result).toEqual({
          contains: 'foo',
          equals: 'baz',
        });
      });
    });
  });
});
