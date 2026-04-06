'use client';

/**
 * SpendingLimitCard Component
 *
 * Displays current spending against monthly limits with progress bars.
 * Can show multiple limits (e.g., org limit + member limit).
 * Each limit can independently be editable or read-only, with its own edit button.
 *
 * Scenarios:
 * - Personal workspace: one "My Limit" row (editable)
 * - Org admin: "Org Limit" (editable) + "My Limit" (editable)
 * - Org member: "Org Limit" (read-only) + "My Limit" (read-only)
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/UI/card';
import { Button } from '@/components/UI/button';
import { formatCostForDisplay } from '@/utils/usage/formatters';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpendingLimitDialog } from '@/components/Pages/Assistants/Profile/SpendingLimitDialog';

export interface SpendingLimitData {
  /** Type of limit being displayed */
  type: 'user' | 'org' | 'member' | 'assistant';
  /** Monthly spending limit (null = unlimited) */
  limit: number | null;
  /** Label for the limit type */
  label: string;
  /** Actual cumulative spend for the current billing month */
  currentSpend: number;
  /** Whether this specific limit is editable */
  canEdit?: boolean;
  /** Callback to save this specific limit */
  onSave?: (newLimit: number | null) => Promise<{ success: boolean; error?: string }>;
}

interface SpendingLimitCardProps {
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
 * Single limit row with mini progress bar and optional edit button
 */
function LimitRow({ limit, onEditClick }: { limit: SpendingLimitData; onEditClick?: () => void }) {
  const status = getSpendingStatus(limit.currentSpend, limit.limit);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{limit.label}</span>
        <div className="flex items-center gap-1">
          <span className={cn('font-medium', status.color)}>
            {limit.limit !== null ? (
              <>
                {formatCostForDisplay(limit.limit)}
                <span className="ml-1 text-muted-foreground">
                  ({status.percentUsed.toFixed(0)}%)
                </span>
              </>
            ) : (
              'No limit'
            )}
          </span>
          {limit.canEdit && onEditClick && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={onEditClick}
              data-testid={`edit-${limit.type}-limit-button`}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
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

export function SpendingLimitCard({ spendingLimits, isLoading = false }: SpendingLimitCardProps) {
  const [editingLimit, setEditingLimit] = React.useState<SpendingLimitData | null>(null);

  // Filter out limits that are null (unlimited) for display purposes
  const limitsWithValues = spendingLimits.filter((l) => l.limit !== null);
  const hasAnyLimit = limitsWithValues.length > 0;
  const hasAnyEditable = spendingLimits.some((l) => l.canEdit);

  // Don't render if no limits and not loading and none are editable
  if (spendingLimits.length === 0 && !isLoading && !hasAnyEditable) {
    return null;
  }

  return (
    <Card className="xl:flex-1" data-testid="spending-limit-card">
      <CardContent className="p-4">
        <div>
          {/* Title */}
          <p className="text-label text-muted-foreground">Current Month Limits</p>

          {isLoading ? (
            <div className="mt-1 space-y-2">
              <div className="h-6 w-20 animate-pulse rounded bg-muted" />
              <div className="h-1.5 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : hasAnyLimit || hasAnyEditable ? (
            <div className="mt-1 space-y-2">
              {spendingLimits.map((limit) => (
                <LimitRow
                  key={limit.type}
                  limit={limit}
                  onEditClick={
                    limit.canEdit && limit.onSave ? () => setEditingLimit(limit) : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-display text-bold text-foreground">
                {formatCostForDisplay(spendingLimits[0]?.currentSpend ?? 0)}
              </p>
              <p className="text-caption text-muted-foreground">No limits configured</p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Spending Limit Edit Dialog — opens for whichever limit is being edited */}
      {editingLimit?.onSave && (
        <SpendingLimitDialog
          open={!!editingLimit}
          onOpenChange={(open) => {
            if (!open) setEditingLimit(null);
          }}
          currentLimit={editingLimit.limit}
          currentSpend={editingLimit.currentSpend}
          onSave={editingLimit.onSave}
        />
      )}
    </Card>
  );
}

export default SpendingLimitCard;
