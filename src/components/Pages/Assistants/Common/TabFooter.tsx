'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabFooterProps {
  /**
   * Optional left-aligned status content. Only Actions uses this (a live
   * working/idle indicator wired to its SSE stream); every other tab leaves
   * it empty so the footer is a plain right-aligned count.
   */
  status?: React.ReactNode;
  /** Visible (filtered) item count for the right-aligned summary. */
  count?: number;
  /** Total item count; rendered as "N of M …" when different from `count`. */
  total?: number;
  singular?: string;
  plural?: string;
  /** Fully custom right content; overrides the count summary when provided. */
  right?: React.ReactNode;
  testId?: string;
  className?: string;
}

function countLabel(
  count: number,
  total: number | undefined,
  singular: string,
  plural: string
): string {
  const noun = (total ?? count) === 1 ? singular : plural;
  if (total !== undefined) return `${count} of ${total} ${noun}`;
  return `${count} ${noun}`;
}

/**
 * Standardized footer shared by every assistant tab — a fixed `h-10` bar with
 * an optional status slot on the left and a count summary on the right. Keeps
 * the chrome consistent across tabs while letting Actions surface live status.
 */
export function TabFooter({
  status,
  count,
  total,
  singular = 'item',
  plural = 'items',
  right,
  testId,
  className,
}: TabFooterProps) {
  const rightContent =
    right ??
    (count !== undefined ? (
      <span className="text-caption">{countLabel(count, total, singular, plural)}</span>
    ) : null);

  return (
    <div
      className={cn(
        // h-10 aligns this bar with the chat input and the assistant-list toggle.
        'flex h-10 shrink-0 items-center border-t bg-background px-3 text-xs text-muted-foreground',
        status ? 'justify-between' : 'justify-end',
        className
      )}
      data-testid={testId}
    >
      {status ? <div className="flex min-w-0 items-center gap-2">{status}</div> : null}
      {rightContent}
    </div>
  );
}
