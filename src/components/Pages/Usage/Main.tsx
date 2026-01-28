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
import { SpendingLimitCard, SpendingLimitData } from './SpendingLimitCard';
import { useUsageFilters } from '@/hooks/Usage/useUsageFilters';
import { useUsageData } from '@/hooks/Usage/useUsageData';
import { useUsageSummary } from '@/hooks/Usage/useUsageSummary';
import { Assistant } from '@/types/assistants/assistant';
import { UsageActions, SpendingLimitInfo } from '@/lib/usage/actions';
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
  /** Organization ID if in org context (null for personal workspace) */
  orgId?: number | null;
}

export function UsageMain({
  currentUserId,
  usageActions,
  assistants,
  orgMembers = [],
  isAdmin = false,
  initialAssistantId,
  orgId = null,
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

  // Spending limits state (can have multiple: scope limit + assistant limit)
  const [spendingLimits, setSpendingLimits] = React.useState<SpendingLimitData[]>([]);
  const [isLoadingLimits, setIsLoadingLimits] = React.useState(true);

  // Type guard for spending limit response
  const isSpendingLimit = React.useCallback(
    (result: SpendingLimitInfo | { detail?: string }): result is SpendingLimitInfo => {
      return 'type' in result && 'limit' in result && 'label' in result;
    },
    []
  );

  // Fetch spending limits based on current filter context
  React.useEffect(() => {
    const fetchSpendingLimits = async () => {
      setIsLoadingLimits(true);
      const limits: SpendingLimitData[] = [];

      try {
        // Fetch the scope-level limit (user, org, or member)
        let scopeResult: SpendingLimitInfo | { detail?: string } | null = null;

        if (orgId) {
          // Org context
          if (filters.userScope === 'org') {
            // Org-wide view - show org limit
            scopeResult = await usageActions.getOrgSpendingLimit(orgId);
          } else if (filters.userScope === 'member' && filters.selectedUserId) {
            // Specific member - show member limit
            scopeResult = await usageActions.getMemberSpendingLimit(orgId, filters.selectedUserId);
          } else {
            // Self in org - show current user's member limit
            scopeResult = await usageActions.getMemberSpendingLimit(orgId, currentUserId);
          }
        } else {
          // Personal workspace - show user limit
          scopeResult = await usageActions.getUserSpendingLimit();
        }

        if (scopeResult && isSpendingLimit(scopeResult)) {
          limits.push(scopeResult);
        }

        // If filtering by specific assistant, also fetch assistant limit
        if (filters.assistantId !== 'all') {
          const assistantResult = await usageActions.getAssistantSpendingLimit(filters.assistantId);
          if (assistantResult && isSpendingLimit(assistantResult)) {
            limits.push(assistantResult);
          }
        }

        setSpendingLimits(limits);
      } catch (error) {
        console.error('[UsageMain] Error fetching spending limits:', error);
        setSpendingLimits([]);
      } finally {
        setIsLoadingLimits(false);
      }
    };

    fetchSpendingLimits();
  }, [
    usageActions,
    orgId,
    currentUserId,
    filters.userScope,
    filters.selectedUserId,
    filters.assistantId,
    isSpendingLimit,
  ]);

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

      {/* Main content area - responsive layout */}
      {/* At xl+: cards in row above chart (standard layout) */}
      {/* Below xl (high zoom / narrow): cards stacked left, chart on right */}
      <div className="flex min-h-0 flex-1 flex-row gap-4 p-4 pt-2 xl:flex-col">
        {/* Cards sidebar (narrow viewports) / Cards row (wide viewports) */}
        <div className="flex w-64 shrink-0 flex-col gap-3 xl:w-full xl:flex-row xl:gap-4">
          <UsageSummaryCards
            summary={summary}
            isLoading={isLoading && !hasInitiallyLoaded}
            granularity={filters.granularity}
            inline={true}
          />
          <SpendingLimitCard
            currentSpending={summary.total}
            spendingLimits={spendingLimits}
            isLoading={isLoadingLimits || (isLoading && !hasInitiallyLoaded)}
          />
        </div>

        {/* Chart - fills remaining space */}
        <div className="min-h-[300px] flex-1">
          <UsageChart
            data={data}
            granularity={filters.granularity}
            isLoading={isLoading && !hasInitiallyLoaded}
          />
        </div>
      </div>
    </div>
  );
}

export default UsageMain;
