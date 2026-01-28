'use client';

/**
 * Usage Page Main Container
 *
 * Orchestrates all usage page components: filters, summary cards, and chart.
 * Uses server actions for API calls (API key never exposed to client).
 */

import * as React from 'react';
import { UsageFiltersBar } from './Filters';
import { UsageSummaryCards } from './UsageSummaryCards';
import { UsageChart } from './UsageChart';
import { useUsageFilters } from '@/hooks/Usage/useUsageFilters';
import { useUsageData } from '@/hooks/Usage/useUsageData';
import { useUsageSummary } from '@/hooks/Usage/useUsageSummary';
import { Assistant } from '@/types/assistants/assistant';
import { UsageActions } from '@/lib/usage/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { AlertCircle } from 'lucide-react';

/** Simplified org member type for the usage page */
export interface OrgMember {
  userId: string;
  name: string;
  email?: string;
}

interface UsageMainProps {
  /** Current user's ID */
  currentUserId: string;
  /** Bound server actions (API key captured on server) */
  usageActions: UsageActions;
  /** List of available assistants */
  assistants: Assistant[];
  /** List of organization members (for admins in org context) */
  orgMembers?: OrgMember[];
  /** Whether the current user is an admin/owner */
  isAdmin?: boolean;
  /** Initial assistant ID to filter by (from URL query param) */
  initialAssistantId?: string;
}

export function UsageMain({
  currentUserId,
  usageActions,
  assistants,
  orgMembers = [],
  isAdmin = false,
  initialAssistantId,
}: UsageMainProps) {
  // Compute initial filters based on URL params
  const initialFilters = React.useMemo(() => {
    if (initialAssistantId) {
      // Verify the assistant exists in the list
      const assistantExists = assistants.some((a) => a.agentId === initialAssistantId);
      if (assistantExists) {
        return { assistantId: initialAssistantId };
      }
    }
    return undefined;
  }, [initialAssistantId, assistants]);

  // Filter state management
  const {
    filters,
    setUserScope,
    setSelectedMember,
    setAssistantId,
    setDateRange,
    setGranularity,
    resetFilters,
    contextPath,
    filterExpression,
    canViewOrg,
  } = useUsageFilters({
    currentUserId,
    assistants,
    orgMembers,
    isAdmin,
    initialFilters,
  });

  // Filter assistants based on selected user scope
  const filteredAssistants = React.useMemo(() => {
    // For org scope, show all assistants
    if (filters.userScope === 'org') {
      return assistants;
    }

    // Determine which user's assistants to show
    const targetUserId =
      filters.userScope === 'member' && filters.selectedUserId
        ? filters.selectedUserId
        : currentUserId;

    // Filter to only assistants belonging to the target user
    return assistants.filter((a) => a.userId === targetUserId);
  }, [assistants, filters.userScope, filters.selectedUserId, currentUserId]);

  // Reset assistant selection when filtered list changes and current selection is invalid
  React.useEffect(() => {
    if (filters.assistantId !== 'all') {
      const isValidSelection = filteredAssistants.some((a) => a.agentId === filters.assistantId);
      if (!isValidSelection) {
        setAssistantId('all');
      }
    }
  }, [filteredAssistants, filters.assistantId, setAssistantId]);

  // Data fetching using bound server actions
  const { data, isLoading, error, hasInitiallyLoaded, refetch } = useUsageData({
    usageActions,
    contextPath,
    granularity: filters.granularity,
    filterExpression,
    enabled: !!contextPath,
  });

  // Summary calculations
  const { summary } = useUsageSummary({ data });

  return (
    <div className="flex h-full flex-col overflow-auto" data-testid="usage-page-main">
      {/* Error Alert */}
      {error && (
        <div className="shrink-0 p-4 pb-0">
          <Alert variant="destructive" data-testid="usage-error-alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error loading usage data</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Filters Bar */}
      <div className="shrink-0 p-4 pb-2">
        <UsageFiltersBar
          userScope={filters.userScope}
          onUserScopeChange={setUserScope}
          selectedMemberId={filters.selectedUserId}
          onMemberChange={setSelectedMember}
          orgMembers={orgMembers}
          currentUserId={currentUserId}
          assistantId={filters.assistantId}
          onAssistantChange={setAssistantId}
          assistants={filteredAssistants}
          startDate={filters.startDate}
          endDate={filters.endDate}
          onDateRangeChange={setDateRange}
          granularity={filters.granularity}
          onGranularityChange={setGranularity}
          onReset={resetFilters}
          onRefresh={refetch}
          canViewOrg={canViewOrg}
          disabled={isLoading}
        />
      </div>

      {/* Summary Cards */}
      <div className="shrink-0 px-4 py-2">
        <UsageSummaryCards
          summary={summary}
          isLoading={isLoading && !hasInitiallyLoaded}
          granularity={filters.granularity}
        />
      </div>

      {/* Chart - fills remaining height with min-height for small screens */}
      <div className="min-h-[300px] flex-1 p-4 pt-2">
        <UsageChart
          data={data}
          granularity={filters.granularity}
          isLoading={isLoading && !hasInitiallyLoaded}
        />
      </div>
    </div>
  );
}

export default UsageMain;
