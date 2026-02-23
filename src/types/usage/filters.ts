/**
 * Usage Filters Types
 *
 * Types for the usage page filter state and configuration.
 */

import { TimeGranularity } from './api';

/**
 * User scope options for filtering usage data.
 * - 'self': Current user's own usage
 * - 'member': A specific team member's usage (org admins only)
 * - 'org': Organization-wide aggregate (org admins only)
 */
export type UserScope = 'self' | 'member' | 'org';

/**
 * Complete filter state for the usage page.
 */
export interface UsageFiltersState {
  /** Which user scope to view */
  userScope: UserScope;
  /** Selected user ID when userScope is 'member' */
  selectedUserId: string | null;
  /** Selected assistant ID or 'all' for aggregate */
  assistantId: string | 'all';
  /** Start date in ISO format (YYYY-MM-DD) */
  startDate: string;
  /** End date in ISO format (YYYY-MM-DD) */
  endDate: string;
  /** Time granularity for data aggregation */
  granularity: TimeGranularity;
}

/**
 * Default filter values
 */
export const DEFAULT_FILTERS: UsageFiltersState = {
  userScope: 'self',
  selectedUserId: null,
  assistantId: 'all',
  startDate: '', // Will be computed dynamically (30 days ago)
  endDate: '', // Will be computed dynamically (today)
  granularity: 'time_day',
};

/**
 * User scope option for the dropdown
 */
export interface UserScopeOption {
  value: UserScope;
  label: string;
  description?: string;
}

/**
 * Available user scope options with improved labels
 */
export const USER_SCOPE_OPTIONS: UserScopeOption[] = [
  { value: 'self', label: 'My Usage', description: 'View your own usage' },
  {
    value: 'org',
    label: 'All Organization',
    description: 'View organization-wide usage',
  },
];
