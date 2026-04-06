'use client';

/**
 * UsageFiltersBar Component
 *
 * Container component that arranges all usage filter controls.
 * Includes a Refresh button on the far right.
 */

import * as React from 'react';
import { GranularityFilter } from './GranularityFilter';
import { TimeframeFilter } from './TimeframeFilter';
import { AssistantFilter } from './AssistantFilter';
import { CategoryFilter } from './CategoryFilter';
import { UserScopeFilter } from './UserScopeFilter';
import { TimeGranularity, UserScope } from '@/types/usage';
import { Assistant } from '@/types/assistants/assistant';
import { OrgMember } from '../Main';
import { Button } from '@/components/UI/button';
import { RefreshCw } from 'lucide-react';

interface UsageFiltersBarProps {
  /** Current user scope */
  userScope: UserScope;
  /** Callback when user scope changes */
  onUserScopeChange: (scope: UserScope) => void;
  /** Currently selected member ID (for member scope) */
  selectedMemberId: string | null;
  /** Callback when member selection changes */
  onMemberChange: (memberId: string | null) => void;
  /** List of org members (for admins) */
  orgMembers: OrgMember[];
  /** Current user's ID */
  currentUserId: string;
  /** Selected assistant ID */
  assistantId: string;
  /** Callback when assistant selection changes */
  onAssistantChange: (assistantId: string) => void;
  /** List of available assistants */
  assistants: Assistant[];
  /** Selected category */
  category: string;
  /** Callback when category selection changes */
  onCategoryChange: (category: string) => void;
  /** Start date in ISO format */
  startDate: string;
  /** End date in ISO format */
  endDate: string;
  /** Callback when date range changes */
  onDateRangeChange: (startDate: string, endDate: string) => void;
  /** Current granularity */
  granularity: TimeGranularity;
  /** Callback when granularity changes */
  onGranularityChange: (granularity: TimeGranularity) => void;
  /** Callback to reset filters */
  onReset: () => void;
  /** Callback to refresh/refetch data */
  onRefresh: () => void;
  /** Whether user can view org-wide data */
  canViewOrg?: boolean;
  /** Whether filters are disabled (loading) */
  disabled?: boolean;
}

export function UsageFiltersBar({
  userScope,
  onUserScopeChange,
  selectedMemberId,
  onMemberChange,
  orgMembers,
  currentUserId,
  assistantId,
  onAssistantChange,
  assistants,
  category,
  onCategoryChange,
  startDate,
  endDate,
  onDateRangeChange,
  granularity,
  onGranularityChange,
  onRefresh,
  canViewOrg = false,
  disabled = false,
}: UsageFiltersBarProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      // Add a small delay so the animation is visible
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
      data-testid="usage-filters-bar"
    >
      {/* User Scope Filter - only visible for admins */}
      <UserScopeFilter
        value={userScope}
        onChange={onUserScopeChange}
        selectedMemberId={selectedMemberId}
        onMemberChange={onMemberChange}
        orgMembers={orgMembers}
        currentUserId={currentUserId}
        disabled={disabled}
        visible={canViewOrg}
      />

      {/* Assistant Filter */}
      <AssistantFilter
        assistants={assistants}
        value={assistantId}
        onChange={onAssistantChange}
        disabled={disabled}
      />

      {/* Category Filter */}
      <CategoryFilter value={category} onChange={onCategoryChange} disabled={disabled} />

      {/* Timeframe Filter */}
      <TimeframeFilter
        startDate={startDate}
        endDate={endDate}
        onDateRangeChange={onDateRangeChange}
        disabled={disabled}
      />

      {/* Granularity Filter */}
      <GranularityFilter value={granularity} onChange={onGranularityChange} disabled={disabled} />

      {/* Spacer to push refresh button to the right */}
      <div className="flex-1" />

      {/* Refresh Button - on far right */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={disabled || isRefreshing}
        className="h-8"
        data-testid="refresh-button"
      >
        <RefreshCw className={`mr-1 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );
}

export default UsageFiltersBar;
