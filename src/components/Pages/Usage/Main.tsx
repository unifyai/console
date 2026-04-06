'use client';

/**
 * Usage Page Main Container
 *
 * Orchestrates all usage page components: filters, summary cards, and chart.
 * Uses server actions for API calls (API key never exposed to client).
 */

import * as React from 'react';
import { UsageFiltersBar } from './Filters';
import { UsageChart } from './UsageChart';
import { TransactionLedger } from './TransactionLedger';
import { SpendingLimitCard } from './SpendingLimitCard';
import type { SpendingLimitData } from './SpendingLimitCard';
import { useUsageFilters } from '@/hooks/Usage/useUsageFilters';
import { useUsageLedgerChart } from '@/hooks/Usage/useUsageLedgerChart';
import { useTransactionHistory } from '@/hooks/Usage/useTransactionHistory';
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
    setCategory,
    setDateRange,
    setGranularity,
    resetFilters,
    canViewOrg,
  } = useUsageFilters({
    isAdmin,
    initialFilters,
  });

  // Reset assistant selection when the assistants list changes and current selection is invalid
  React.useEffect(() => {
    if (filters.assistantId !== 'all') {
      const isValidSelection = assistants.some((a) => a.agentId === filters.assistantId);
      if (!isValidSelection) {
        setAssistantId('all');
      }
    }
  }, [assistants, filters.assistantId, setAssistantId]);

  // Chart data from the credit ledger
  const chartAssistantId = filters.assistantId !== 'all' ? filters.assistantId : undefined;
  const chartCategory = filters.category !== 'all' ? filters.category : undefined;
  const chartUserId =
    filters.userScope === 'member' && filters.selectedUserId
      ? filters.selectedUserId
      : filters.userScope === 'self'
        ? currentUserId
        : undefined;

  const { data, isLoading, error, hasInitiallyLoaded, refetch } = useUsageLedgerChart({
    startDate: filters.startDate,
    endDate: filters.endDate,
    granularity: filters.granularity,
    assistantId: chartAssistantId,
    category: chartCategory,
    userId: chartUserId,
    enabled: true,
  });

  // Transaction ledger — scoped to the active user/member selection
  const ledgerUserId =
    filters.userScope === 'member' && filters.selectedUserId
      ? filters.selectedUserId
      : filters.userScope === 'self'
        ? currentUserId
        : undefined;

  const ledger = useTransactionHistory({
    assistantId: filters.assistantId !== 'all' ? filters.assistantId : undefined,
    category: chartCategory,
    userId: ledgerUserId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    enabled: true,
  });

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

  // Save handler for assistant spending limit
  const handleSaveAssistantLimit = React.useCallback(
    async (newLimit: number | null): Promise<{ success: boolean; error?: string }> => {
      if (filters.assistantId === 'all') {
        return { success: false, error: 'No assistant selected' };
      }
      try {
        const result = await usageActions.setAssistantSpendingLimit(filters.assistantId, newLimit);
        if ('detail' in result) {
          return { success: false, error: (result as { detail: string }).detail };
        }
        toast.success('Assistant spending limit updated');
        setLimitRefreshKey((k) => k + 1);
        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to update assistant spending limit';
        toast.error(message);
        return { success: false, error: message };
      }
    },
    [usageActions, filters.assistantId]
  );

  // Get the selected assistant's name for the limit label
  const selectedAssistantName = React.useMemo(() => {
    if (filters.assistantId === 'all') return null;
    const assistant = assistants.find((a) => a.agentId === filters.assistantId);
    return assistant ? `${assistant.firstName}'s Limit` : 'Assistant Limit';
  }, [filters.assistantId, assistants]);

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

        // If filtering by specific assistant, also fetch assistant limit (editable)
        if (filters.assistantId !== 'all') {
          const assistantResult = await usageActions.getAssistantSpendingLimit(filters.assistantId);
          if (assistantResult && isSpendingLimit(assistantResult)) {
            // In personal workspace: user can edit; in org workspace: only admins can edit
            const canEditAssistantLimit = orgId ? isAdmin : true;
            limits.push({
              ...assistantResult,
              label: selectedAssistantName || assistantResult.label,
              canEdit: canEditAssistantLimit,
              onSave: canEditAssistantLimit ? handleSaveAssistantLimit : undefined,
            });
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
    handleSaveAssistantLimit,
    selectedAssistantName,
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
          assistants={assistants}
          category={filters.category}
          onCategoryChange={setCategory}
          startDate={filters.startDate}
          endDate={filters.endDate}
          onDateRangeChange={setDateRange}
          granularity={filters.granularity}
          onGranularityChange={setGranularity}
          onReset={resetFilters}
          onRefresh={() => {
            refetch();
            ledger.refetch();
          }}
          canViewOrg={canViewOrg}
          disabled={isLoading}
        />
      </div>

      {/* Main content area — desktop: two-column, mobile: stacked */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-2 lg:flex-row">
        {/* Left column — spending limits (compact) + transaction ledger (fills remaining) */}
        <div className="flex w-full flex-col gap-3 lg:max-h-[calc(100vh-140px)] lg:w-80 xl:w-96">
          <div className="shrink-0">
            <SpendingLimitCard
              spendingLimits={spendingLimits}
              isLoading={isLoadingLimits || (isLoading && !hasInitiallyLoaded)}
            />
          </div>

          {/* Chart appears here on mobile (between limits and ledger), hidden on desktop */}
          <div className="min-h-[360px] lg:hidden">
            <UsageChart
              data={data}
              granularity={filters.granularity}
              isLoading={isLoading && !hasInitiallyLoaded}
            />
          </div>

          <div className="min-h-[300px] flex-1 overflow-hidden">
            <TransactionLedger
              transactions={ledger.transactions}
              isLoading={ledger.isLoading}
              error={ledger.error}
              hasMore={ledger.hasMore}
              onLoadMore={ledger.loadMore}
            />
          </div>
        </div>

        {/* Right column — bar chart (desktop only, hidden on mobile) */}
        <div className="hidden min-h-[360px] flex-1 lg:block lg:max-h-[calc(100vh-140px)]">
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
