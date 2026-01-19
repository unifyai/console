/**
 * useUsageFilters Hook
 *
 * Manages filter state for the usage page.
 * Computes derived values like context path and filter expressions.
 *
 * Uses ID-based filtering for robust user/assistant selection:
 * - _user_id field for filtering by user
 * - _assistant_id field for filtering by assistant
 * - Always uses All/Events/LLM context path for simplicity
 */

import { useState, useMemo, useCallback } from 'react';
import { UsageFiltersState, UserScope, TimeGranularity, DEFAULT_FILTERS } from '@/types/usage';
import { Assistant } from '@/types/assistants/assistant';
import { getDefaultDateRange } from '@/utils/usage/dateUtils';
import { buildUsageFilterExpression } from '@/utils/usage/filterExpressions';

/** LLM Events context path - always the same regardless of filters */
const LLM_EVENTS_CONTEXT = 'All/Events/LLM';

/** Simplified org member type for the usage page */
export interface OrgMember {
  userId: string;
  name: string;
  email?: string;
}

/**
 * Props for useUsageFilters hook
 */
export interface UseUsageFiltersProps {
  /** Current user's ID */
  currentUserId: string;
  /** List of available assistants */
  assistants: Assistant[];
  /** List of organization members (for admins) */
  orgMembers?: OrgMember[];
  /** Whether user is admin/owner (can view org and members) */
  isAdmin?: boolean;
  /** Initial filter values (optional) */
  initialFilters?: Partial<UsageFiltersState>;
}

/**
 * Return type for useUsageFilters hook
 */
export interface UseUsageFiltersReturn {
  /** Current filter state */
  filters: UsageFiltersState;
  /** Update user scope */
  setUserScope: (scope: UserScope) => void;
  /** Update selected member (sets scope to 'member' and user ID) */
  setSelectedMember: (userId: string | null) => void;
  /** Update selected user ID (for member scope) */
  setSelectedUserId: (userId: string | null) => void;
  /** Update selected assistant */
  setAssistantId: (assistantId: string) => void;
  /** Update start date */
  setStartDate: (date: string) => void;
  /** Update end date */
  setEndDate: (date: string) => void;
  /** Update granularity */
  setGranularity: (granularity: TimeGranularity) => void;
  /** Update date range (both dates at once) */
  setDateRange: (startDate: string, endDate: string) => void;
  /** Reset filters to defaults */
  resetFilters: () => void;
  /** Computed context path for API calls (always All/Events/LLM) */
  contextPath: string;
  /** Computed filter expression for API calls */
  filterExpression: string;
  /** Whether user can view org-wide data */
  canViewOrg: boolean;
  /** Whether user can view other members */
  canViewMembers: boolean;
}

/**
 * Hook to manage filter state and compute derived values.
 *
 * The hook now uses a simplified approach:
 * - Context path is always `All/Events/LLM`
 * - Filtering is done via filter expressions using _user_id and _assistant_id fields
 * - This avoids issues with name collisions (two users with same name, etc.)
 *
 * @param props Hook props
 * @returns Filter state and setters
 *
 * @example
 * ```tsx
 * const {
 *   filters,
 *   setGranularity,
 *   contextPath,
 *   filterExpression,
 * } = useUsageFilters({ currentUserId: 'user_123', assistants: [], isAdmin: true });
 *
 * // Use contextPath and filterExpression for API calls
 * const data = await fetchUsageMetrics(contextPath, filterExpression);
 * ```
 */
export function useUsageFilters({
  currentUserId,
  assistants,
  orgMembers = [],
  isAdmin = false,
  initialFilters = {},
}: UseUsageFiltersProps): UseUsageFiltersReturn {
  // Get default date range
  const defaultDateRange = useMemo(() => getDefaultDateRange(), []);

  // Initialize filter state
  const [filters, setFilters] = useState<UsageFiltersState>(() => ({
    ...DEFAULT_FILTERS,
    startDate: defaultDateRange.startDate,
    endDate: defaultDateRange.endDate,
    ...initialFilters,
  }));

  // Individual setters
  const setUserScope = useCallback((userScope: UserScope) => {
    setFilters((prev) => ({
      ...prev,
      userScope,
      // Reset selected user when changing scope (unless it's 'member')
      selectedUserId: userScope === 'member' ? prev.selectedUserId : null,
    }));
  }, []);

  const setSelectedUserId = useCallback((selectedUserId: string | null) => {
    setFilters((prev) => ({ ...prev, selectedUserId }));
  }, []);

  // Convenience method to select a specific member
  const setSelectedMember = useCallback((userId: string | null) => {
    if (userId === null) {
      // Clear member selection, revert to self
      setFilters((prev) => ({
        ...prev,
        userScope: 'self',
        selectedUserId: null,
      }));
    } else {
      setFilters((prev) => ({
        ...prev,
        userScope: 'member',
        selectedUserId: userId,
      }));
    }
  }, []);

  const setAssistantId = useCallback((assistantId: string) => {
    setFilters((prev) => ({ ...prev, assistantId }));
  }, []);

  const setStartDate = useCallback((startDate: string) => {
    setFilters((prev) => ({ ...prev, startDate }));
  }, []);

  const setEndDate = useCallback((endDate: string) => {
    setFilters((prev) => ({ ...prev, endDate }));
  }, []);

  const setGranularity = useCallback((granularity: TimeGranularity) => {
    setFilters((prev) => ({ ...prev, granularity }));
  }, []);

  const setDateRange = useCallback((startDate: string, endDate: string) => {
    setFilters((prev) => ({ ...prev, startDate, endDate }));
  }, []);

  const resetFilters = useCallback(() => {
    const newDefaultRange = getDefaultDateRange();
    setFilters({
      ...DEFAULT_FILTERS,
      startDate: newDefaultRange.startDate,
      endDate: newDefaultRange.endDate,
    });
  }, []);

  // Computed permissions
  const canViewOrg = isAdmin;
  const canViewMembers = isAdmin;

  // Context path is always the same - we filter via filter expression instead
  const contextPath = LLM_EVENTS_CONTEXT;

  // Compute the effective user ID for filtering
  const effectiveUserId = useMemo(() => {
    // If user can't view org/members, always filter by current user
    if (!isAdmin) {
      return currentUserId;
    }

    // Based on scope, determine which user to filter by
    switch (filters.userScope) {
      case 'org':
        // Org-wide: no user filter
        return undefined;
      case 'member':
        // Specific member selected
        return filters.selectedUserId || currentUserId;
      case 'self':
      default:
        // Self: current user
        return currentUserId;
    }
  }, [isAdmin, filters.userScope, filters.selectedUserId, currentUserId]);

  // Get the assistant ID for filtering (only if not "all")
  const effectiveAssistantId = useMemo(() => {
    if (filters.assistantId === 'all') {
      return undefined;
    }
    // Verify the assistant exists in the list
    const assistant = assistants.find((a) => a.agentId === filters.assistantId);
    return assistant ? filters.assistantId : undefined;
  }, [filters.assistantId, assistants]);

  // Compute filter expression with user and assistant ID filters
  const filterExpression = useMemo(() => {
    return buildUsageFilterExpression(
      filters.startDate,
      filters.endDate,
      effectiveUserId,
      effectiveAssistantId
    );
  }, [filters.startDate, filters.endDate, effectiveUserId, effectiveAssistantId]);

  return {
    filters,
    setUserScope,
    setSelectedMember,
    setSelectedUserId,
    setAssistantId,
    setStartDate,
    setEndDate,
    setGranularity,
    setDateRange,
    resetFilters,
    contextPath,
    filterExpression,
    canViewOrg,
    canViewMembers,
  };
}

export default useUsageFilters;
