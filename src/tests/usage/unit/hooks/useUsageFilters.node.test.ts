/**
 * useUsageFilters Hook Tests
 *
 * Tests for the filter state management hook.
 * The hook now uses ID-based filtering via filter expressions,
 * with a simplified constant context path.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUsageFilters } from '@/hooks/Usage/useUsageFilters';
import { DEFAULT_FILTERS } from '@/types/usage';
import { createMockAssistantList, createMockOrgMemberList } from '@/tests/usage/mocks/data';

// Create mock assistants and org members for tests
const mockAssistants = createMockAssistantList(3);
const mockOrgMembers = createMockOrgMemberList(3);
const mockCurrentUserId = 'user_current';

describe('useUsageFilters', () => {
  beforeEach(() => {
    // Mock Date for consistent default date range
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 19)); // Jan 19, 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      expect(result.current.filters.userScope).toBe('self');
      expect(result.current.filters.assistantId).toBe('all');
      expect(result.current.filters.granularity).toBe('time_day');
    });

    it('sets default date range to last 30 days', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      expect(result.current.filters.startDate).toBe('2025-12-20');
      expect(result.current.filters.endDate).toBe('2026-01-19');
    });

    it('accepts initial filter overrides', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          initialFilters: {
            granularity: 'time_hour',
            assistantId: 'asst_123',
          },
        })
      );

      expect(result.current.filters.granularity).toBe('time_hour');
      expect(result.current.filters.assistantId).toBe('asst_123');
    });
  });

  describe('setters', () => {
    it('updates user scope', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
        })
      );

      act(() => {
        result.current.setUserScope('org');
      });

      expect(result.current.filters.userScope).toBe('org');
    });

    it('resets selectedUserId when changing from member scope', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
          initialFilters: {
            userScope: 'member',
            selectedUserId: 'user_123',
          },
        })
      );

      expect(result.current.filters.selectedUserId).toBe('user_123');

      act(() => {
        result.current.setUserScope('self');
      });

      expect(result.current.filters.selectedUserId).toBeNull();
    });

    it('preserves selectedUserId when staying in member scope', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
          initialFilters: {
            userScope: 'member',
            selectedUserId: 'user_123',
          },
        })
      );

      act(() => {
        result.current.setUserScope('member');
      });

      expect(result.current.filters.selectedUserId).toBe('user_123');
    });

    it('updates selected user ID', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
        })
      );

      act(() => {
        result.current.setSelectedUserId('user_456');
      });

      expect(result.current.filters.selectedUserId).toBe('user_456');
    });

    it('setSelectedMember sets scope to member and user ID', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
        })
      );

      act(() => {
        result.current.setSelectedMember('user_789');
      });

      expect(result.current.filters.userScope).toBe('member');
      expect(result.current.filters.selectedUserId).toBe('user_789');
    });

    it('setSelectedMember(null) reverts to self scope', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
          initialFilters: {
            userScope: 'member',
            selectedUserId: 'user_123',
          },
        })
      );

      act(() => {
        result.current.setSelectedMember(null);
      });

      expect(result.current.filters.userScope).toBe('self');
      expect(result.current.filters.selectedUserId).toBeNull();
    });

    it('updates assistant ID', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      act(() => {
        result.current.setAssistantId('asst_789');
      });

      expect(result.current.filters.assistantId).toBe('asst_789');
    });

    it('updates start date', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      act(() => {
        result.current.setStartDate('2026-01-01');
      });

      expect(result.current.filters.startDate).toBe('2026-01-01');
    });

    it('updates end date', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      act(() => {
        result.current.setEndDate('2026-01-31');
      });

      expect(result.current.filters.endDate).toBe('2026-01-31');
    });

    it('updates granularity', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      act(() => {
        result.current.setGranularity('time_hour');
      });

      expect(result.current.filters.granularity).toBe('time_hour');
    });

    it('updates date range together', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      act(() => {
        result.current.setDateRange('2026-02-01', '2026-02-28');
      });

      expect(result.current.filters.startDate).toBe('2026-02-01');
      expect(result.current.filters.endDate).toBe('2026-02-28');
    });
  });

  describe('resetFilters', () => {
    it('resets all filters to defaults', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
          initialFilters: {
            userScope: 'org',
            assistantId: 'asst_123',
            granularity: 'time_hour',
          },
        })
      );

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.userScope).toBe(DEFAULT_FILTERS.userScope);
      expect(result.current.filters.assistantId).toBe(DEFAULT_FILTERS.assistantId);
      expect(result.current.filters.granularity).toBe(DEFAULT_FILTERS.granularity);
    });

    it('resets date range to current 30 days', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          initialFilters: {
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
        })
      );

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.startDate).toBe('2025-12-20');
      expect(result.current.filters.endDate).toBe('2026-01-19');
    });
  });

  describe('computed contextPath', () => {
    it('always returns All/Events/LLM regardless of scope', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: false,
        })
      );

      expect(result.current.contextPath).toBe('All/Events/LLM');
    });

    it('always returns All/Events/LLM for admin with org scope', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
          initialFilters: { userScope: 'org' },
        })
      );

      expect(result.current.contextPath).toBe('All/Events/LLM');
    });

    it('context path does not change when scope changes', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
        })
      );

      expect(result.current.contextPath).toBe('All/Events/LLM');

      act(() => {
        result.current.setUserScope('org');
      });

      expect(result.current.contextPath).toBe('All/Events/LLM');

      act(() => {
        result.current.setUserScope('member');
        result.current.setSelectedUserId('user_123');
      });

      expect(result.current.contextPath).toBe('All/Events/LLM');
    });

    it('context path does not change when assistant changes', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      expect(result.current.contextPath).toBe('All/Events/LLM');

      act(() => {
        result.current.setAssistantId(mockAssistants[0].agentId);
      });

      expect(result.current.contextPath).toBe('All/Events/LLM');
    });
  });

  describe('computed filterExpression', () => {
    it('includes user ID filter for self scope', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          initialFilters: {
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        })
      );

      expect(result.current.filterExpression).toContain(`_attributed_user_id == '${mockCurrentUserId}'`);
      expect(result.current.filterExpression).toContain("event_timestamp >= '2026-01-01'");
    });

    it('includes user ID filter for member scope', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
          initialFilters: {
            userScope: 'member',
            selectedUserId: 'user_other',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        })
      );

      expect(result.current.filterExpression).toContain("_attributed_user_id == 'user_other'");
    });

    it('excludes user ID filter for org scope (admin)', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
          initialFilters: {
            userScope: 'org',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        })
      );

      expect(result.current.filterExpression).not.toContain('_attributed_user_id');
      expect(result.current.filterExpression).toContain("event_timestamp >= '2026-01-01'");
    });

    it('forces user ID filter for non-admin even with org scope set', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: false,
          initialFilters: {
            userScope: 'org', // This should be ignored for non-admin
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        })
      );

      // Non-admin should still have user ID filter
      expect(result.current.filterExpression).toContain(`_attributed_user_id == '${mockCurrentUserId}'`);
    });

    it('includes assistant ID filter when specific assistant selected', () => {
      const assistantId = mockAssistants[0].agentId;

      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          initialFilters: {
            assistantId,
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        })
      );

      expect(result.current.filterExpression).toContain(`_assistant_id == '${assistantId}'`);
    });

    it('excludes assistant ID filter when all assistants selected', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          initialFilters: {
            assistantId: 'all',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        })
      );

      expect(result.current.filterExpression).not.toContain('_assistant_id');
    });

    it('excludes assistant ID filter when assistant not found in list', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          initialFilters: {
            assistantId: 'non_existent_asst',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        })
      );

      expect(result.current.filterExpression).not.toContain('_assistant_id');
    });

    it('updates filter expression when dates change', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      act(() => {
        result.current.setDateRange('2026-03-01', '2026-03-31');
      });

      expect(result.current.filterExpression).toContain("event_timestamp >= '2026-03-01'");
      expect(result.current.filterExpression).toContain("event_timestamp < '2026-04-01'");
    });

    it('updates filter expression when assistant changes', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      expect(result.current.filterExpression).not.toContain('_assistant_id');

      act(() => {
        result.current.setAssistantId(mockAssistants[0].agentId);
      });

      expect(result.current.filterExpression).toContain(
        `_assistant_id == '${mockAssistants[0].agentId}'`
      );
    });

    it('updates filter expression when user scope changes', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
        })
      );

      // Initially self scope - has user ID
      expect(result.current.filterExpression).toContain(`_attributed_user_id == '${mockCurrentUserId}'`);

      act(() => {
        result.current.setUserScope('org');
      });

      // Org scope - no user ID
      expect(result.current.filterExpression).not.toContain('_attributed_user_id');
    });
  });

  describe('permissions', () => {
    it('non-admin cannot view org', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: false,
        })
      );

      expect(result.current.canViewOrg).toBe(false);
      expect(result.current.canViewMembers).toBe(false);
    });

    it('admin can view org and members', () => {
      const { result } = renderHook(() =>
        useUsageFilters({
          currentUserId: mockCurrentUserId,
          assistants: mockAssistants,
          isAdmin: true,
        })
      );

      expect(result.current.canViewOrg).toBe(true);
      expect(result.current.canViewMembers).toBe(true);
    });
  });

  describe('memoization', () => {
    it('returns same setter references across renders', () => {
      const { result, rerender } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      const firstSetGranularity = result.current.setGranularity;
      rerender();
      const secondSetGranularity = result.current.setGranularity;

      expect(firstSetGranularity).toBe(secondSetGranularity);
    });

    it('context path is constant', () => {
      const { result } = renderHook(() =>
        useUsageFilters({ currentUserId: mockCurrentUserId, assistants: mockAssistants })
      );

      const firstContextPath = result.current.contextPath;

      // Change granularity
      act(() => {
        result.current.setGranularity('time_hour');
      });

      // Change assistant
      act(() => {
        result.current.setAssistantId(mockAssistants[0].agentId);
      });

      const secondContextPath = result.current.contextPath;

      expect(firstContextPath).toBe(secondContextPath);
      expect(firstContextPath).toBe('All/Events/LLM');
    });
  });
});
