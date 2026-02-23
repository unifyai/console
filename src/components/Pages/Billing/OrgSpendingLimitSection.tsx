/**
 * OrgSpendingLimitSection - Organization spending limit section for billing page.
 *
 * Features:
 * - Displays organization's current month spending
 * - Shows progress toward spending limit
 * - Allows org admins to edit the spending limit
 * - Loading and error states
 */

'use client';

import * as React from 'react';
import { Loader2, AlertCircle, Building2, Pencil } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import {
  OrgSpend,
  OrgSpendingLimitResponse,
  OrgSpendingLimitRequest,
  SpendingDisplayProps,
  formatSpendAmount,
  getCurrentMonth,
} from '@/types/organization';
import { ResponseProps } from '@/types/common';
import { useOrgSpending } from '@/hooks/Organizations/useOrgSpending';
import { SpendingProgressBar } from '@/components/Pages/Assistants/Assistants/Profile/SpendingProgressBar';
import { SpendingLimitDialog } from '@/components/Pages/Assistants/Assistants/Profile/SpendingLimitDialog';
import { toast } from 'sonner';

/** Type for the getSpend action function */
type GetOrgSpendAction = (orgId: number, month?: string) => Promise<OrgSpend | ResponseProps>;

/** Type for the getLimit action function */
type GetOrgLimitAction = (orgId: number) => Promise<OrgSpendingLimitResponse | ResponseProps>;

/** Type for the setLimit action function */
type SetOrgLimitAction = (
  orgId: number,
  payload: OrgSpendingLimitRequest
) => Promise<(OrgSpendingLimitResponse & ResponseProps) | ResponseProps>;

export interface OrgSpendingLimitSectionProps {
  /** Organization ID */
  orgId: number;
  /** Organization name for display */
  orgName: string;
  /** Whether the current user can edit the spending limit (org admin/owner) */
  canEdit?: boolean;
  /** Server action to fetch organization spend */
  getSpendAction: GetOrgSpendAction;
  /** Server action to fetch organization spending limit */
  getLimitAction: GetOrgLimitAction;
  /** Server action to set organization spending limit */
  setLimitAction: SetOrgLimitAction;
  /** Optional additional class names */
  className?: string;
}

export function OrgSpendingLimitSection({
  orgId,
  orgName,
  canEdit = false,
  getSpendAction,
  getLimitAction,
  setLimitAction,
  className,
}: OrgSpendingLimitSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const {
    spend,
    limit,
    display,
    isLoading,
    isRefreshing,
    error,
    refreshAll,
    updateLimit,
    currentMonth,
  } = useOrgSpending({
    orgId,
    getSpendAction,
    getLimitAction,
    setLimitAction,
  });

  const handleSaveLimit = async (newLimit: number | null) => {
    const result = await updateLimit(newLimit);
    if (result.success) {
      toast.success('Organization spending limit updated!');
      setIsDialogOpen(false);
    } else {
      toast.error(result.error || 'Failed to update spending limit');
    }
    return result;
  };

  // Format month for display (e.g., "January 2026")
  const formatMonthDisplay = (month: string) => {
    try {
      const [year, monthNum] = month.split('-');
      const date = new Date(parseInt(year), parseInt(monthNum) - 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return month;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h3 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Spending Limit
          </h2>
          <p className="text-body-muted mt-1">Monthly spending limit for {orgName}</p>
        </div>
        {canEdit && !isLoading && !error && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
            className="gap-1.5"
          >
            <Pencil className="h-4 w-4" />
            Edit Limit
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex w-full items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-body-muted">Loading...</span>
        </div>
      ) : error ? (
        <div className="border-destructive/50 bg-destructive/10 rounded-md border p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="text-body text-error font-medium">Failed to load spending data</p>
              <p className="text-caption mt-1 text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={refreshAll} className="mt-2">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      ) : display ? (
        <div className="space-y-4 rounded-md border p-4">
          {/* Month indicator */}
          <div className="flex items-center justify-between">
            <span className="text-label">{formatMonthDisplay(currentMonth)}</span>
            {isRefreshing && (
              <span className="text-caption flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Updating...
              </span>
            )}
          </div>

          {/* Progress bar */}
          <SpendingProgressBar display={display} size="md" />

          {/* Additional info */}
          <div className="text-caption text-muted-foreground">
            {display.isUnlimited ? (
              <p>No spending limit is set for this organization.</p>
            ) : display.isOverLimit ? (
              <p className="text-destructive">
                This organization has exceeded its monthly spending limit. Billable activity will be
                blocked immediately.
              </p>
            ) : display.isNearLimit ? (
              <p className="text-amber-600 dark:text-amber-500">
                This organization is approaching its monthly spending limit.
              </p>
            ) : (
              <p>
                This organization has used {Math.round(display.percentUsed)}% of its monthly limit.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-md border p-4">
          <p className="text-body-muted">No spending data available for this month.</p>
        </div>
      )}

      {/* Edit dialog - always render, use fallback values if spend not loaded */}
      <SpendingLimitDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        currentLimit={limit?.monthlySpendingCap ?? null}
        currentSpend={spend?.cumulativeSpend ?? 0}
        onSave={handleSaveLimit}
      />
    </div>
  );
}
