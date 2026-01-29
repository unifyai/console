/**
 * SpendingProgressBar - Visual progress indicator for spending limits.
 *
 * Features:
 * - Color-coded based on spend percentage (green → amber → red)
 * - Shows "Unlimited" state when no limit is set
 * - Displays current spend and limit amounts
 * - Animated progress transitions
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { SpendingDisplayProps, formatSpendAmount } from '@/types/assistants/spending';

export interface SpendingProgressBarProps {
  /** Display properties from calculateSpendingDisplay */
  display: SpendingDisplayProps;
  /** Optional additional class names */
  className?: string;
  /** Whether to show the text labels */
  showLabels?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Current month in YYYY-MM format (for inline display) */
  currentMonth?: string;
}

/**
 * Get the appropriate color class based on spending status.
 */
function getProgressColor(display: SpendingDisplayProps): string {
  if (display.isUnlimited) {
    return 'bg-muted-foreground/30';
  }
  if (display.isOverLimit) {
    return 'bg-destructive';
  }
  if (display.isNearLimit) {
    return 'bg-amber-500';
  }
  return 'bg-emerald-500';
}

/**
 * Get the text color class based on spending status.
 */
function getTextColor(display: SpendingDisplayProps): string {
  if (display.isUnlimited) {
    return 'text-muted-foreground';
  }
  if (display.isOverLimit) {
    return 'text-destructive';
  }
  if (display.isNearLimit) {
    return 'text-amber-600 dark:text-amber-500';
  }
  return 'text-emerald-600 dark:text-emerald-500';
}

/**
 * Get the height class based on size.
 */
function getHeightClass(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'h-1.5';
    case 'lg':
      return 'h-3';
    default:
      return 'h-2';
  }
}

/**
 * Format month for inline display (YYYY-MM → "January")
 */
function formatMonthName(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return date.toLocaleDateString('en-US', { month: 'long' });
}

export function SpendingProgressBar({
  display,
  className,
  showLabels = true,
  size = 'md',
  currentMonth,
}: SpendingProgressBarProps) {
  const progressColor = getProgressColor(display);
  const textColor = getTextColor(display);
  const heightClass = getHeightClass(size);

  // Clamp progress to 0-100 for the visual bar
  const progressPercent = Math.min(Math.max(display.percentUsed, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      {/* Labels */}
      {showLabels && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className={cn('text-title', textColor)}>
            {formatSpendAmount(display.currentSpend)}
            {currentMonth && (
              <span className="text-caption ml-1 font-normal text-muted-foreground">
                in {formatMonthName(currentMonth)}
              </span>
            )}
          </span>
          <span className="text-caption">
            {display.isUnlimited ? (
              'No limit'
            ) : (
              <>
                of {formatSpendAmount(display.limit!)}
                <span className="ml-1 opacity-70">({Math.round(display.percentUsed)}%)</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div
        className={cn('relative w-full overflow-hidden rounded-full bg-muted', heightClass)}
        role="progressbar"
        aria-valuenow={display.percentUsed}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          display.isUnlimited
            ? `Spent ${formatSpendAmount(display.currentSpend)}, no limit`
            : `Spent ${formatSpendAmount(display.currentSpend)} of ${formatSpendAmount(display.limit!)}`
        }
      >
        {display.isUnlimited ? (
          /* Diagonal stripes pattern for unlimited state */
          <div
            className="h-full w-full"
            style={{
              background: `repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 3px,
                hsl(var(--muted-foreground) / 0.2) 3px,
                hsl(var(--muted-foreground) / 0.2) 6px
              )`,
            }}
          />
        ) : (
          <div
            className={cn('h-full transition-all duration-500 ease-out', progressColor)}
            style={{
              width: `${progressPercent}%`,
            }}
          />
        )}
      </div>

      {/* Status indicator for over limit */}
      {display.isOverLimit && showLabels && (
        <p className="text-caption text-error mt-1">
          Over limit by {formatSpendAmount(display.currentSpend - display.limit!)}
        </p>
      )}
    </div>
  );
}
