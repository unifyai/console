'use client';

import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AutoSaveStatus } from '@/hooks/Account/useAutoSave';

/**
 * Unobtrusive auto-save indicator that replaces the explicit Save button.
 * Reserves its own height so surrounding layout doesn't shift as the status
 * cycles between idle / saving / saved / error.
 */
export function SaveStatus({ status, className }: { status: AutoSaveStatus; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'text-caption flex h-5 items-center gap-1.5 transition-opacity duration-200',
        status === 'idle' ? 'opacity-0' : 'opacity-100',
        className
      )}
    >
      {status === 'saving' && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </span>
      )}
      {status === 'saved' && (
        <span className="text-success flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Saved
        </span>
      )}
      {status === 'error' && <span className="text-destructive">Couldn’t save</span>}
    </div>
  );
}
