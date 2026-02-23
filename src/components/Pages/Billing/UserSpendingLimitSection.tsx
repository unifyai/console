/**
 * UserSpendingLimitSection - User spending limit section for billing page.
 *
 * Features:
 * - Displays user's current month personal spending
 * - Shows progress toward spending limit
 * - Allows user to edit their spending limit
 * - Loading and error states
 *
 * This is for the user's personal workspace spending, not organization spending.
 */

'use client';

import * as React from 'react';
import { Loader2, AlertCircle, User, Pencil } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import {
  UserSpend,
  UserSpendingLimitResponse,
  UserSpendingLimitRequest,
  formatSpendAmount,
} from '@/types/user/spending';
import { ResponseProps } from '@/types/common';
import { useUserSpending } from '@/hooks/User/useUserSpending';
import { SpendingProgressBar } from '@/components/Pages/Assistants/Assistants/Profile/SpendingProgressBar';
import { SpendingLimitDialog } from '@/components/Pages/Assistants/Assistants/Profile/SpendingLimitDialog';
import { toast } from 'sonner';

/** Type for the getSpend action function */
type GetUserSpendAction = (month?: string) => Promise<UserSpend | ResponseProps>;

/** Type for the getLimit action function */
type GetUserLimitAction = () => Promise<UserSpendingLimitResponse | ResponseProps>;

/** Type for the setLimit action function */
type SetUserLimitAction = (
  payload: UserSpendingLimitRequest
) => Promise<(UserSpendingLimitResponse & ResponseProps) | ResponseProps>;

export interface UserSpendingLimitSectionProps {
  /** Server action to fetch user spend */
  getSpendAction: GetUserSpendAction;
  /** Server action to fetch user spending limit */
  getLimitAction: GetUserLimitAction;
  /** Server action to set user spending limit */
  setLimitAction: SetUserLimitAction;
  /** Optional additional class names */
  className?: string;
}

export function UserSpendingLimitSection({
  getSpendAction,
  getLimitAction,
  setLimitAction,
  className,
}: UserSpendingLimitSectionProps) {
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
  } = useUserSpending({
    getSpendAction,
    getLimitAction,
    setLimitAction,
  });

  const handleSaveLimit = async (newLimit: number | null) => {
    const result = await updateLimit(newLimit);
    if (result.success) {
      toast.success('Personal spending limit updated!');
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
            <User className="h-5 w-5" />
            Personal Spending Limit
          </h2>
          <p className="text-body-muted mt-1">Monthly spending limit for your personal workspace</p>
        </div>
        {!isLoading && !error && (
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
              <p>No spending limit is set for your personal workspace.</p>
            ) : display.isOverLimit ? (
              <p className="text-destructive">
                You have exceeded your monthly personal spending limit. Billable activity will be
                blocked immediately.
              </p>
            ) : display.isNearLimit ? (
              <p className="text-amber-600 dark:text-amber-500">
                You are approaching your monthly personal spending limit.
              </p>
            ) : (
              <p>You have used {Math.round(display.percentUsed)}% of your monthly limit.</p>
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
