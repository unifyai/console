'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatStaleReasonLabel } from '@/utils/assistants/staleReasons';
import type { StaleReason } from '@/types/assistants/brain';

interface StaleReasonChipsProps {
  reasons: StaleReason[];
  /** Optional section label; omit for inline chips only. */
  label?: string;
  /** When true, render a compact banner above chips. */
  banner?: boolean;
  className?: string;
  chipTestIdPrefix?: string;
}

export function StaleReasonChips({
  reasons,
  label = 'Link debt',
  banner = false,
  className,
  chipTestIdPrefix = 'stale-reason',
}: StaleReasonChipsProps) {
  if (reasons.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)} data-testid="stale-reasons">
      {banner && (
        <div className="border-[color:var(--status-warning)]/25 flex items-start gap-2 rounded-md border bg-[color:var(--status-warning-bg)] px-3 py-2">
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--status-warning)]"
            aria-hidden="true"
          />
          <p className="text-[11px] leading-snug text-[color:var(--status-warning)]">
            This record cites dependencies that no longer resolve. Repair or re-link before relying
            on it in automation.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-overline">{label}</span>
        {reasons.map((reason, index) => (
          <span
            key={`${reason.depKind}-${reason.id ?? reason.name ?? reason.path ?? index}`}
            title={formatStaleReasonLabel(reason)}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-[color:var(--status-warning-bg)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--status-warning)]"
            data-testid={`${chipTestIdPrefix}-${index}`}
          >
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{formatStaleReasonLabel(reason)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
