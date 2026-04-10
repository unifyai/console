/**
 * useUsageFilters Hook
 *
 * Manages filter state for the usage page.
 */

import { useState, useMemo, useCallback } from 'react';
import { UsageFiltersState, UserScope, TimeGranularity, DEFAULT_FILTERS } from '@/types/usage';
import { getDefaultDateRange } from '@/utils/usage/dateUtils';

/**
 * Props for useUsageFilters hook
 */
export interface UseUsageFiltersProps {
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
  /** Update selected category */
  setCategory: (category: string) => void;
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
  /** Whether user can view org-wide data */
  canViewOrg: boolean;
  /** Whether user can view other members */
  canViewMembers: boolean;
}

/**
 * Hook to manage usage page filter state.
 *
 * @param props Hook props
 * @returns Filter state and setters
 */
export function useUsageFilters({
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

  const setCategory = useCallback((category: string) => {
    setFilters((prev) => ({ ...prev, category }));
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

  return {
    filters,
    setUserScope,
    setSelectedMember,
    setSelectedUserId,
    setAssistantId,
    setCategory,
    setStartDate,
    setEndDate,
    setGranularity,
    setDateRange,
    resetFilters,
    canViewOrg,
    canViewMembers,
  };
}

export default useUsageFilters;
