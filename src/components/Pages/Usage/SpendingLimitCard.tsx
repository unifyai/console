'use client';

/**
 * SpendingLimitCard Component
 *
 * Displays current spending against monthly limits with progress bars.
 * Can show multiple limits (e.g., org limit + assistant limit).
 * Designed to fit in the same row as the other summary cards.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/UI/card';
import { formatCostForDisplay } from '@/utils/usage/formatters';
import { Target, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SpendingLimitData {
  /** Type of limit being displayed */
  type: 'user' | 'org' | 'member' | 'assistant';
  /** Monthly spending limit (null = unlimited) */
  limit: number | null;
  /** Label for the limit type */
  label: string;
}

interface SpendingLimitCardProps {
  /** Current total spending for the selected period */
  currentSpending: number;
  /** Array of spending limits to display (can be multiple) */
  spendingLimits: SpendingLimitData[];
  /** Whether data is loading */
  isLoading?: boolean;
}

/**
 * Calculate spending status and styling for a single limit
 */
function getSpendingStatus(current: number, limit: number | null) {
  if (limit === null) {
    return {
      status: 'unlimited' as const,
      percentUsed: 0,
      color: 'text-muted-foreground',
      progressColor: 'bg-muted-foreground/30',
    };
  }

  const percentUsed = limit > 0 ? (current / limit) * 100 : 0;

  if (percentUsed >= 100) {
    return {
      status: 'exceeded' as const,
      percentUsed: Math.min(percentUsed, 100),
      color: 'text-destructive',
      progressColor: 'bg-destructive',
    };
  }

  if (percentUsed >= 80) {
    return {
      status: 'warning' as const,
      percentUsed,
      color: 'text-amber-500',
      progressColor: 'bg-amber-500',
    };
  }

  return {
    status: 'ok' as const,
    percentUsed,
    color: 'text-emerald-500',
    progressColor: 'bg-emerald-500',
  };
}

/**
 * Get the most severe status from all limits
 */
function getOverallStatus(limits: SpendingLimitData[], currentSpending: number) {
  const statuses = limits
    .filter((l) => l.limit !== null)
    .map((l) => getSpendingStatus(currentSpending, l.limit));

  if (statuses.some((s) => s.status === 'exceeded')) {
    return { status: 'exceeded', color: 'text-destructive', bgColor: 'bg-destructive/10' };
  }
  if (statuses.some((s) => s.status === 'warning')) {
    return { status: 'warning', color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
  }
  if (statuses.some((s) => s.status === 'ok')) {
    return { status: 'ok', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
  }
  return { status: 'unlimited', color: 'text-muted-foreground', bgColor: 'bg-muted' };
}

/**
 * Single limit row with mini progress bar
 */
function LimitRow({
  limit,
  currentSpending,
}: {
  limit: SpendingLimitData;
  currentSpending: number;
}) {
  const status = getSpendingStatus(currentSpending, limit.limit);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{limit.label}</span>
        <span className={cn('font-medium', status.color)}>
          {limit.limit !== null ? (
            <>
              {formatCostForDisplay(limit.limit)}
              <span className="ml-1 text-muted-foreground">({status.percentUsed.toFixed(0)}%)</span>
            </>
          ) : (
            'No limit'
          )}
        </span>
      </div>
      {limit.limit !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full transition-all duration-500', status.progressColor)}
            style={{ width: `${Math.min(status.percentUsed, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function SpendingLimitCard({
  currentSpending,
  spendingLimits,
  isLoading = false,
}: SpendingLimitCardProps) {
  // Filter out limits that are null (unlimited) for display purposes
  const limitsWithValues = spendingLimits.filter((l) => l.limit !== null);
  const hasAnyLimit = limitsWithValues.length > 0;

  // Get overall status for the icon
  const overall = getOverallStatus(spendingLimits, currentSpending);
  const StatusIcon =
    overall.status === 'exceeded' || overall.status === 'warning' ? AlertTriangle : CheckCircle2;

  // Don't render if no limits and not loading
  if (spendingLimits.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Card className="xl:flex-1" data-testid="spending-limit-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Title */}
            <p className="text-label text-muted-foreground">Current Month Limits</p>

            {isLoading ? (
              <div className="mt-1 space-y-2">
                <div className="h-6 w-20 animate-pulse rounded bg-muted" />
                <div className="h-1.5 w-full animate-pulse rounded bg-muted" />
              </div>
            ) : hasAnyLimit ? (
              <div className="mt-1 space-y-2">
                {/* Limit rows */}
                <div className="space-y-2">
                  {spendingLimits.map((limit) => (
                    <LimitRow key={limit.type} limit={limit} currentSpending={currentSpending} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-1">
                <p className="text-display text-bold text-foreground">
                  {formatCostForDisplay(currentSpending)}
                </p>
                <p className="text-caption text-muted-foreground">No limits configured</p>
              </div>
            )}
          </div>

          {/* Icon */}
          <div
            className={cn(
              'shrink-0 rounded-full p-2',
              isLoading ? 'bg-muted text-muted-foreground' : overall.bgColor,
              !isLoading && overall.color
            )}
          >
            {hasAnyLimit && !isLoading ? (
              <StatusIcon className="h-5 w-5" />
            ) : (
              <Target className="h-5 w-5" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SpendingLimitCard;
