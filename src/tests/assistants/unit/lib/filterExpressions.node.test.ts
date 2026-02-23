/**
 * Unit tests for src/utils/assistants/filterExpressions.ts
 *
 * Tests the filter expression builder functions used for security filtering.
 *
 * @group unit
 */

import { describe, it, expect } from 'vitest';
import {
  escapeFilterValue,
  buildUserIdFilter,
  buildAssistantIdFilter,
  combineFilters,
} from '@/utils/assistants/filterExpressions';

describe('filterExpressions', () => {
  describe('escapeFilterValue', () => {
    it('escapes single quotes', () => {
      expect(escapeFilterValue("John's")).toBe("John\\'s");
      expect(escapeFilterValue("test'value'here")).toBe("test\\'value\\'here");
    });

    it('escapes backslashes', () => {
      expect(escapeFilterValue('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('escapes backslashes before single quotes', () => {
      expect(escapeFilterValue("test\\'value")).toBe("test\\\\\\'value");
    });

    it('returns unchanged string if no special characters', () => {
      expect(escapeFilterValue('simple-value')).toBe('simple-value');
      expect(escapeFilterValue('user-id-123')).toBe('user-id-123');
    });
  });

  describe('buildUserIdFilter', () => {
    it('builds correct filter expression', () => {
      expect(buildUserIdFilter('user-123')).toBe("_user_id == 'user-123'");
    });

    it('escapes special characters in user ID', () => {
      expect(buildUserIdFilter("user'with'quotes")).toBe("_user_id == 'user\\'with\\'quotes'");
    });

    it('handles UUID format', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(buildUserIdFilter(uuid)).toBe(`_user_id == '${uuid}'`);
    });
  });

  describe('buildAssistantIdFilter', () => {
    it('builds correct filter expression', () => {
      expect(buildAssistantIdFilter('assistant-456')).toBe("_assistant_id == 'assistant-456'");
    });

    it('escapes special characters in assistant ID', () => {
      expect(buildAssistantIdFilter("asst'id")).toBe("_assistant_id == 'asst\\'id'");
    });

    it('handles agent ID format', () => {
      const agentId = 'agent_abc123xyz';
      expect(buildAssistantIdFilter(agentId)).toBe(`_assistant_id == '${agentId}'`);
    });
  });

  describe('combineFilters', () => {
    it('returns empty string for empty array', () => {
      expect(combineFilters([])).toBe('');
    });

    it('returns empty string for array with only empty/null values', () => {
      expect(combineFilters([null, undefined, '', '   '])).toBe('');
    });

    it('returns single expression unwrapped', () => {
      const filter = "_user_id == 'user-123'";
      expect(combineFilters([filter])).toBe(filter);
    });

    it('combines two expressions with AND', () => {
      const result = combineFilters(["_user_id == 'user-123'", "_assistant_id == 'asst-456'"]);
      expect(result).toBe("(_user_id == 'user-123') and (_assistant_id == 'asst-456')");
    });

    it('combines multiple expressions with AND', () => {
      const result = combineFilters([
        "_user_id == 'u1'",
        "_assistant_id == 'a1'",
        "status == 'active'",
      ]);
      expect(result).toBe(
        "(_user_id == 'u1') and (_assistant_id == 'a1') and (status == 'active')"
      );
    });

    it('filters out null and undefined values', () => {
      const result = combineFilters([
        "_user_id == 'user-123'",
        null,
        "_assistant_id == 'asst-456'",
        undefined,
      ]);
      expect(result).toBe("(_user_id == 'user-123') and (_assistant_id == 'asst-456')");
    });

    it('filters out empty strings', () => {
      const result = combineFilters([
        "_user_id == 'user-123'",
        '',
        '   ',
        "_assistant_id == 'asst-456'",
      ]);
      expect(result).toBe("(_user_id == 'user-123') and (_assistant_id == 'asst-456')");
    });
  });
});
