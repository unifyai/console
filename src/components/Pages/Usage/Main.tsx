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
import { SpendingLimitCard, type SpendingLimitData } from './SpendingLimitCard';
import { useUsageFilters } from '@/hooks/Usage/useUsageFilters';
import { useUsageData } from '@/hooks/Usage/useUsageData';
import { useUsageSummary } from '@/hooks/Usage/useUsageSummary';
import { Assistant } from '@/types/assistants/assistant';
import { UsageActions, SpendingLimitInfo } from '@/lib/usage/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/UI/alert';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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
  const [limitRefreshKey, setLimitRefreshKey] = React.useState(0);

  // Type guard for spending limit response
  const isSpendingLimit = React.useCallback(
    (result: SpendingLimitInfo | { detail?: string }): result is SpendingLimitInfo => {
      return 'type' in result && 'limit' in result && 'label' in result;
    },
    []
  );

  // Per-limit save handlers — each limit type has its own save function
  const handleSaveUserLimit = React.useCallback(
    async (newLimit: number | null): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await usageActions.setUserSpendingLimit(newLimit);
        if ('detail' in result) {
          return { success: false, error: (result as { detail: string }).detail };
        }
        toast.success('Spending limit updated');
        setLimitRefreshKey((k) => k + 1);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update spending limit';
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [usageActions]
  );

  const handleSaveOrgLimit = React.useCallback(
    async (newLimit: number | null): Promise<{ success: boolean; error?: string }> => {
      if (!orgId) return { success: false, error: 'No organization context' };
      try {
        const result = await usageActions.setOrgSpendingLimit(orgId, newLimit);
        if ('detail' in result) {
          return { success: false, error: (result as { detail: string }).detail };
        }
        toast.success('Organization spending limit updated');
        setLimitRefreshKey((k) => k + 1);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update spending limit';
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [usageActions, orgId]
  );

  // Determine which member's limit to show/edit based on filter selection
  const activeMemberId =
    filters.userScope === 'member' && filters.selectedUserId
      ? filters.selectedUserId
      : currentUserId;

  const activeMemberName = React.useMemo(() => {
    if (activeMemberId === currentUserId) return 'My Limit';
    const member = orgMembers.find((m) => m.userId === activeMemberId);
    return member ? `${member.name}'s Limit` : 'Member Limit';
  }, [activeMemberId, currentUserId, orgMembers]);

  const handleSaveMemberLimit = React.useCallback(
    async (newLimit: number | null): Promise<{ success: boolean; error?: string }> => {
      if (!orgId) return { success: false, error: 'No organization context' };
      try {
        const result = await usageActions.setMemberSpendingLimit(orgId, activeMemberId, newLimit);
        if ('detail' in result) {
          return { success: false, error: (result as { detail: string }).detail };
        }
        toast.success('Member spending limit updated');
        setLimitRefreshKey((k) => k + 1);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update spending limit';
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [usageActions, orgId, activeMemberId]
  );

  // Fetch spending limits based on current context
  // In org context: always show org limit + current user's member limit
  // In personal workspace: show user limit only
  React.useEffect(() => {
    const fetchSpendingLimits = async () => {
      setIsLoadingLimits(true);
      const limits: SpendingLimitData[] = [];

      try {
        if (orgId) {
          // Org context — always show both org limit and the user's member limit
          const [orgResult, memberResult] = await Promise.all([
            usageActions.getOrgSpendingLimit(orgId),
            usageActions.getMemberSpendingLimit(orgId, activeMemberId),
          ]);

          if (orgResult && isSpendingLimit(orgResult)) {
            limits.push({
              ...orgResult,
              canEdit: isAdmin,
              onSave: isAdmin ? handleSaveOrgLimit : undefined,
            });
          }

          if (memberResult && isSpendingLimit(memberResult)) {
            limits.push({
              ...memberResult,
              label: activeMemberName,
              canEdit: isAdmin,
              onSave: isAdmin ? handleSaveMemberLimit : undefined,
            });
          }
        } else {
          // Personal workspace — show user limit
          const scopeResult = await usageActions.getUserSpendingLimit();
          if (scopeResult && isSpendingLimit(scopeResult)) {
            limits.push({
              ...scopeResult,
              canEdit: true,
              onSave: handleSaveUserLimit,
            });
          }
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
    activeMemberId,
    activeMemberName,
    isAdmin,
    filters.assistantId,
    isSpendingLimit,
    limitRefreshKey,
    handleSaveOrgLimit,
    handleSaveMemberLimit,
    handleSaveUserLimit,
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
