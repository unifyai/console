/**
 * StatusIndicator - Visual indicator for action node status.
 *
 * Displays different icons/animations based on status:
 * - running: Animated spinner
 * - completed: Green checkmark
 * - error: Red error icon
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, X, Loader2 } from 'lucide-react';
import type { ActionNodeStatus } from '@/types/assistants/action';

export interface StatusIndicatorProps {
  /** Current status of the action */
  status: ActionNodeStatus;
  /** Size of the indicator */
  size?: 'sm' | 'md';
  /** Additional class names */
  className?: string;
}

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
};

export function StatusIndicator({ status, size = 'sm', className }: StatusIndicatorProps) {
  const sizeClass = sizeClasses[size];

  return (
    <span
      data-testid="status-indicator"
      data-status={status}
      className={cn(
        'inline-flex items-center justify-center transition-all duration-200',
        className
      )}
    >
      {status === 'running' && (
        <Loader2 className={cn(sizeClass, 'animate-spin text-blue-500')} aria-label="Running" />
      )}
      {status === 'completed' && (
        <Check
          className={cn(sizeClass, 'text-emerald-500 duration-200 animate-in zoom-in-50')}
          aria-label="Completed"
        />
      )}
      {status === 'error' && (
        <X
          className={cn(sizeClass, 'text-destructive duration-200 animate-in zoom-in-50')}
          aria-label="Error"
        />
      )}
    </span>
  );
}
