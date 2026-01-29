/**
 * AssistantSpendingSection - Displays spending info in the assistant profile panel.
 *
 * Features:
 * - Shows current month's cumulative spend with progress bar
 * - Displays spending limit (or "Unlimited" if none set)
 * - Click to edit spending limit (if user has write access)
 * - Loading and error states
 * - Link to view detailed usage for this assistant
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/UI/button';
import { Skeleton } from '@/components/UI/skeleton';
import { SpendingProgressBar } from './SpendingProgressBar';
import { SpendingLimitDialog } from './SpendingLimitDialog';
import { SpendingDisplayProps } from '@/types/assistants/spending';

export interface AssistantSpendingSectionProps {
  /** The assistant's ID (agentId) for the View Usage link */
  assistantId: string;
  /** Calculated display properties (null if loading) */
  display: SpendingDisplayProps | null;
  /** Current spending limit in dollars (null = unlimited) */
  currentLimit: number | null;
  /** Current month being displayed (YYYY-MM) */
  currentMonth: string;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether data is refreshing in background */
  isRefreshing?: boolean;
  /** Error message if data fetch failed */
  error: string | null;
  /** Callback to update the spending limit */
  onUpdateLimit: (newLimit: number | null) => Promise<{ success: boolean; error?: string }>;
  /** Callback to refresh data */
  onRefresh: () => void;
  /** Whether the current user can edit the spending limit */
  canEdit?: boolean;
  /** Optional additional class names */
  className?: string;
}

export function AssistantSpendingSection({
  assistantId,
  display,
  currentLimit,
  currentMonth,
  isLoading,
  isRefreshing = false,
  error,
  onUpdateLimit,
  onRefresh,
  canEdit = true,
  className,
}: AssistantSpendingSectionProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  // Build the View Usage URL with assistant filter
  const viewUsageUrl = `/usage?assistant=${encodeURIComponent(assistantId)}`;

  const handleLimitSave = async (newLimit: number | null) => {
    const result = await onUpdateLimit(newLimit);
    if (result.success) {
      setIsDialogOpen(false);
    }
    return result;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-title flex items-center gap-2">Monthly Spending</h3>
        </div>
        {/* Matches SpendingProgressBar layout: labels row + progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Skeleton className="h-4 w-28 bg-muted" /> {/* "$45.00 in January" */}
            <Skeleton className="h-3 w-24 bg-muted" /> {/* "of $100.00 (45%)" */}
          </div>
          <Skeleton className="h-2 w-full rounded-full bg-muted" /> {/* Progress bar */}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-title flex items-center gap-2">Monthly Spending</h3>
        </div>
        <div className="bg-destructive/10 text-body text-error flex items-center gap-2 rounded-md p-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Failed to load spending data</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="ml-auto h-auto px-2 py-1 text-xs"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // No data state (shouldn't happen but handle gracefully)
  if (!display) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-title flex items-center gap-2">Monthly Spending</h3>
        </div>
        <p className="text-body-muted">No spending data available</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-title flex items-center gap-2">
          Monthly Spending
          {isRefreshing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-caption h-auto gap-1 px-2 py-1 hover:text-foreground"
          >
            <Link href={viewUsageUrl} target="_blank" rel="noopener noreferrer">
              View Usage
            </Link>
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDialogOpen(true)}
              className="text-caption h-auto gap-1 p-1 hover:text-foreground"
            >
              Edit Limit
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <SpendingProgressBar display={display} size="md" currentMonth={currentMonth} />

      {/* Edit dialog */}
      <SpendingLimitDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        currentLimit={currentLimit}
        currentSpend={display.currentSpend}
        onSave={handleLimitSave}
      />
    </div>
  );
}
