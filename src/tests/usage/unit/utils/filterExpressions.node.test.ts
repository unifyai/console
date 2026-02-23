/**
 * Filter Expressions Tests
 *
 * Tests for filter expression building functions.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDateRangeFilter,
  combineFilters,
  buildModelFilter,
  buildProviderFilter,
  escapeFilterValue,
  buildUserIdFilter,
  buildAssistantIdFilter,
  buildUsageFilterExpression,
} from '@/utils/usage/filterExpressions';

describe('filterExpressions', () => {
  describe('buildDateRangeFilter', () => {
    it('builds a filter expression with date range', () => {
      const result = buildDateRangeFilter('2026-01-01', '2026-01-31');
      expect(result).toBe("event_timestamp >= '2026-01-01' and event_timestamp < '2026-02-01'");
    });

    it('adds one day to end date for inclusive range', () => {
      const result = buildDateRangeFilter('2026-01-15', '2026-01-15');
      // Same start and end date should include that entire day
      expect(result).toBe("event_timestamp >= '2026-01-15' and event_timestamp < '2026-01-16'");
    });

    it('handles month boundary correctly', () => {
      const result = buildDateRangeFilter('2026-01-15', '2026-01-31');
      expect(result).toBe("event_timestamp >= '2026-01-15' and event_timestamp < '2026-02-01'");
    });

    it('handles year boundary correctly', () => {
      const result = buildDateRangeFilter('2025-12-01', '2025-12-31');
      expect(result).toBe("event_timestamp >= '2025-12-01' and event_timestamp < '2026-01-01'");
    });

    it('handles February correctly', () => {
      const result = buildDateRangeFilter('2026-02-01', '2026-02-28');
      expect(result).toBe("event_timestamp >= '2026-02-01' and event_timestamp < '2026-03-01'");
    });

    it('handles leap year February correctly', () => {
      const result = buildDateRangeFilter('2024-02-01', '2024-02-29');
      expect(result).toBe("event_timestamp >= '2024-02-01' and event_timestamp < '2024-03-01'");
    });
  });

  describe('combineFilters', () => {
    it('combines multiple filters with AND', () => {
      const result = combineFilters(["field1 == 'value1'", "field2 == 'value2'"]);
      expect(result).toBe("(field1 == 'value1') and (field2 == 'value2')");
    });

    it('returns single filter without parentheses', () => {
      const result = combineFilters(["field1 == 'value1'"]);
      expect(result).toBe("field1 == 'value1'");
    });

    it('returns empty string for empty array', () => {
      const result = combineFilters([]);
      expect(result).toBe('');
    });

    it('filters out null values', () => {
      const result = combineFilters(["field1 == 'value1'", null, "field2 == 'value2'"]);
      expect(result).toBe("(field1 == 'value1') and (field2 == 'value2')");
    });

    it('filters out undefined values', () => {
      const result = combineFilters(["field1 == 'value1'", undefined, "field2 == 'value2'"]);
      expect(result).toBe("(field1 == 'value1') and (field2 == 'value2')");
    });

    it('filters out empty strings', () => {
      const result = combineFilters(["field1 == 'value1'", '', "field2 == 'value2'"]);
      expect(result).toBe("(field1 == 'value1') and (field2 == 'value2')");
    });

    it('filters out whitespace-only strings', () => {
      const result = combineFilters(["field1 == 'value1'", '   ', "field2 == 'value2'"]);
      expect(result).toBe("(field1 == 'value1') and (field2 == 'value2')");
    });

    it('returns empty string when all values are invalid', () => {
      const result = combineFilters([null, undefined, '', '  ']);
      expect(result).toBe('');
    });

    it('combines three or more filters', () => {
      const result = combineFilters(['a == 1', 'b == 2', 'c == 3']);
      expect(result).toBe('(a == 1) and (b == 2) and (c == 3)');
    });
  });

  describe('buildModelFilter', () => {
    it('builds a model filter expression', () => {
      const result = buildModelFilter('gpt-4');
      expect(result).toBe("model == 'gpt-4'");
    });

    it('escapes single quotes in model name', () => {
      const result = buildModelFilter("model's-name");
      expect(result).toBe("model == 'model\\'s-name'");
    });

    it('handles empty string', () => {
      const result = buildModelFilter('');
      expect(result).toBe("model == ''");
    });
  });

  describe('buildProviderFilter', () => {
    it('builds a provider filter expression', () => {
      const result = buildProviderFilter('openai');
      expect(result).toBe("provider == 'openai'");
    });

    it('escapes single quotes in provider name', () => {
      const result = buildProviderFilter("provider's-name");
      expect(result).toBe("provider == 'provider\\'s-name'");
    });
  });

  describe('escapeFilterValue', () => {
    it('escapes single quotes', () => {
      const result = escapeFilterValue("it's a test");
      expect(result).toBe("it\\'s a test");
    });

    it('escapes backslashes', () => {
      const result = escapeFilterValue('path\\to\\file');
      expect(result).toBe('path\\\\to\\\\file');
    });

    it('escapes both single quotes and backslashes', () => {
      const result = escapeFilterValue("it's a path\\test");
      expect(result).toBe("it\\'s a path\\\\test");
    });

    it('handles empty string', () => {
      const result = escapeFilterValue('');
      expect(result).toBe('');
    });

    it('handles string with no special characters', () => {
      const result = escapeFilterValue('normal string');
      expect(result).toBe('normal string');
    });

    it('handles multiple single quotes', () => {
      const result = escapeFilterValue("it's Mike's test");
      expect(result).toBe("it\\'s Mike\\'s test");
    });
  });

  describe('buildUserIdFilter', () => {
    it('builds a user ID filter expression', () => {
      const result = buildUserIdFilter('user_123');
      expect(result).toBe("_user_id == 'user_123'");
    });

    it('escapes special characters in user ID', () => {
      const result = buildUserIdFilter("user's_id");
      expect(result).toBe("_user_id == 'user\\'s_id'");
    });

    it('handles empty string', () => {
      const result = buildUserIdFilter('');
      expect(result).toBe("_user_id == ''");
    });

    it('handles UUID format', () => {
      const result = buildUserIdFilter('550e8400-e29b-41d4-a716-446655440000');
      expect(result).toBe("_user_id == '550e8400-e29b-41d4-a716-446655440000'");
    });
  });

  describe('buildAssistantIdFilter', () => {
    it('builds an assistant ID filter expression', () => {
      const result = buildAssistantIdFilter('asst_abc123');
      expect(result).toBe("_assistant_id == 'asst_abc123'");
    });

    it('escapes special characters in assistant ID', () => {
      const result = buildAssistantIdFilter("asst's_id");
      expect(result).toBe("_assistant_id == 'asst\\'s_id'");
    });

    it('handles empty string', () => {
      const result = buildAssistantIdFilter('');
      expect(result).toBe("_assistant_id == ''");
    });

    it('handles agent_id format', () => {
      const result = buildAssistantIdFilter('agent_550e8400');
      expect(result).toBe("_assistant_id == 'agent_550e8400'");
    });
  });

  describe('buildUsageFilterExpression', () => {
    it('builds filter with just date range', () => {
      const result = buildUsageFilterExpression('2026-01-01', '2026-01-31');
      expect(result).toBe("event_timestamp >= '2026-01-01' and event_timestamp < '2026-02-01'");
    });

    it('builds filter with date range and user ID', () => {
      const result = buildUsageFilterExpression('2026-01-01', '2026-01-31', 'user_123');
      expect(result).toBe(
        "(event_timestamp >= '2026-01-01' and event_timestamp < '2026-02-01') and (_user_id == 'user_123')"
      );
    });

    it('builds filter with date range and assistant ID', () => {
      const result = buildUsageFilterExpression('2026-01-01', '2026-01-31', undefined, 'asst_456');
      expect(result).toBe(
        "(event_timestamp >= '2026-01-01' and event_timestamp < '2026-02-01') and (_assistant_id == 'asst_456')"
      );
    });

    it('builds filter with date range, user ID, and assistant ID', () => {
      const result = buildUsageFilterExpression('2026-01-01', '2026-01-31', 'user_123', 'asst_456');
      expect(result).toBe(
        "(event_timestamp >= '2026-01-01' and event_timestamp < '2026-02-01') and (_user_id == 'user_123') and (_assistant_id == 'asst_456')"
      );
    });

    it('ignores "all" assistant ID', () => {
      const result = buildUsageFilterExpression('2026-01-01', '2026-01-31', 'user_123', 'all');
      expect(result).toBe(
        "(event_timestamp >= '2026-01-01' and event_timestamp < '2026-02-01') and (_user_id == 'user_123')"
      );
    });

    it('ignores undefined user ID', () => {
      const result = buildUsageFilterExpression('2026-01-01', '2026-01-31', undefined, undefined);
      expect(result).toBe("event_timestamp >= '2026-01-01' and event_timestamp < '2026-02-01'");
    });
  });
});
