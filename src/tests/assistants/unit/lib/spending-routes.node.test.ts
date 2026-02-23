/**
 * Unit tests for spending route validation logic.
 *
 * These tests verify the validation logic used in the spending API routes
 * without making actual HTTP calls. They test the same validation patterns
 * that the routes use.
 */

import { describe, it, expect } from 'vitest';

// =============================================================================
// Month Validation (mirrors route logic)
// =============================================================================

/**
 * Validate month format YYYY-MM
 */
function isValidMonthFormat(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

describe('spending route validation', () => {
  describe('month format validation', () => {
    it('accepts valid month format YYYY-MM', () => {
      expect(isValidMonthFormat('2026-01')).toBe(true);
      expect(isValidMonthFormat('2026-12')).toBe(true);
      expect(isValidMonthFormat('2025-06')).toBe(true);
    });

    it('rejects month without leading zero', () => {
      expect(isValidMonthFormat('2026-1')).toBe(false);
      expect(isValidMonthFormat('2026-9')).toBe(false);
    });

    it('rejects invalid month numbers', () => {
      expect(isValidMonthFormat('2026-00')).toBe(false);
      expect(isValidMonthFormat('2026-13')).toBe(false);
      expect(isValidMonthFormat('2026-99')).toBe(false);
    });

    it('rejects invalid year formats', () => {
      expect(isValidMonthFormat('26-01')).toBe(false);
      expect(isValidMonthFormat('202-01')).toBe(false);
      expect(isValidMonthFormat('20260-01')).toBe(false);
    });

    it('rejects invalid separators', () => {
      expect(isValidMonthFormat('2026/01')).toBe(false);
      expect(isValidMonthFormat('2026.01')).toBe(false);
      expect(isValidMonthFormat('202601')).toBe(false);
    });

    it('rejects empty and null-like values', () => {
      expect(isValidMonthFormat('')).toBe(false);
      expect(isValidMonthFormat(' ')).toBe(false);
    });

    it('rejects full date formats', () => {
      expect(isValidMonthFormat('2026-01-15')).toBe(false);
      expect(isValidMonthFormat('2026-01-01T00:00:00Z')).toBe(false);
    });
  });

  // ===========================================================================
  // Spending Limit Validation (mirrors route logic)
  // ===========================================================================

  describe('spending limit validation', () => {
    interface ValidationResult {
      valid: boolean;
      error?: string;
    }

    /**
     * Validate spending limit request body
     */
    function validateSpendingLimitBody(body: unknown): ValidationResult {
      if (!body || typeof body !== 'object') {
        return { valid: false, error: 'Invalid request body' };
      }

      const typedBody = body as Record<string, unknown>;

      if (!('monthlySpendingCap' in typedBody)) {
        return { valid: false, error: 'Missing required field: monthlySpendingCap' };
      }

      const { monthlySpendingCap } = typedBody;

      if (monthlySpendingCap !== null && typeof monthlySpendingCap !== 'number') {
        return { valid: false, error: 'monthlySpendingCap must be a number or null' };
      }

      if (monthlySpendingCap !== null && (monthlySpendingCap as number) < 0) {
        return { valid: false, error: 'monthlySpendingCap must be non-negative' };
      }

      return { valid: true };
    }

    it('accepts valid number for monthlySpendingCap', () => {
      expect(validateSpendingLimitBody({ monthlySpendingCap: 100 })).toEqual({ valid: true });
      expect(validateSpendingLimitBody({ monthlySpendingCap: 0 })).toEqual({ valid: true });
      expect(validateSpendingLimitBody({ monthlySpendingCap: 99.99 })).toEqual({ valid: true });
      expect(validateSpendingLimitBody({ monthlySpendingCap: 1000000 })).toEqual({ valid: true });
    });

    it('accepts null for monthlySpendingCap (removes limit)', () => {
      expect(validateSpendingLimitBody({ monthlySpendingCap: null })).toEqual({ valid: true });
    });

    it('rejects missing monthlySpendingCap field', () => {
      const result = validateSpendingLimitBody({});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('monthlySpendingCap');
    });

    it('rejects string value for monthlySpendingCap', () => {
      const result = validateSpendingLimitBody({ monthlySpendingCap: '100' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });

    it('rejects negative value for monthlySpendingCap', () => {
      const result = validateSpendingLimitBody({ monthlySpendingCap: -1 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-negative');
    });

    it('rejects undefined value for monthlySpendingCap', () => {
      const result = validateSpendingLimitBody({ monthlySpendingCap: undefined });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });

    it('rejects boolean value for monthlySpendingCap', () => {
      const result = validateSpendingLimitBody({ monthlySpendingCap: true });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });

    it('rejects array value for monthlySpendingCap', () => {
      const result = validateSpendingLimitBody({ monthlySpendingCap: [100] });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });

    it('rejects object value for monthlySpendingCap', () => {
      const result = validateSpendingLimitBody({ monthlySpendingCap: { value: 100 } });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('number');
    });

    it('accepts body with extra fields (ignores them)', () => {
      const result = validateSpendingLimitBody({
        monthlySpendingCap: 100,
        extraField: 'ignored',
        anotherField: 123,
      });
      expect(result.valid).toBe(true);
    });

    it('rejects invalid body types', () => {
      expect(validateSpendingLimitBody(null).valid).toBe(false);
      expect(validateSpendingLimitBody(undefined).valid).toBe(false);
      expect(validateSpendingLimitBody('string').valid).toBe(false);
      expect(validateSpendingLimitBody(123).valid).toBe(false);
      expect(validateSpendingLimitBody([]).valid).toBe(false);
    });
  });

  // ===========================================================================
  // Response Transformation (mirrors route logic)
  // ===========================================================================

  describe('response transformation', () => {
    /**
     * Mock snake_case to camelCase transformation
     */
    function snakeToCamel(str: string): string {
      return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    function transformKeys(obj: Record<string, unknown>): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(obj)) {
        const camelKey = snakeToCamel(key);
        result[camelKey] = obj[key];
      }
      return result;
    }

    it('transforms spending response keys to camelCase', () => {
      const orchestraResponse = {
        agent_id: '123',
        month: '2026-01',
        cumulative_spend: 50.0,
        limit: 100.0,
        percent_used: 50.0,
      };

      const transformed = transformKeys(orchestraResponse);

      expect(transformed).toEqual({
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 50.0,
        limit: 100.0,
        percentUsed: 50.0,
      });
    });

    it('transforms spending limit response keys to camelCase', () => {
      const orchestraResponse = {
        agent_id: '456',
        monthly_spending_cap: 200.0,
        effective_limit: 150.0,
      };

      const transformed = transformKeys(orchestraResponse);

      expect(transformed).toEqual({
        agentId: '456',
        monthlySpendingCap: 200.0,
        effectiveLimit: 150.0,
      });
    });

    it('handles null values in transformation', () => {
      const orchestraResponse = {
        agent_id: '789',
        monthly_spending_cap: null,
        effective_limit: null,
      };

      const transformed = transformKeys(orchestraResponse);

      expect(transformed).toEqual({
        agentId: '789',
        monthlySpendingCap: null,
        effectiveLimit: null,
      });
    });

    it('preserves keys that are already camelCase', () => {
      const mixedResponse = {
        agent_id: '123',
        alreadyCamel: 'value',
        another_snake: 'other',
      };

      const transformed = transformKeys(mixedResponse);

      expect(transformed.alreadyCamel).toBe('value');
      expect(transformed.anotherSnake).toBe('other');
    });
  });
});
