'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/** Bordered segmented control shell — matches the Transcripts tab preset row. */
export function TabSegmentGroup({
  children,
  className,
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[10px] border border-border bg-muted p-[3px]',
        className
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export interface TabSegmentProps {
  label: string;
  active: boolean;
  onClick: () => void;
  testId?: string;
  count?: number;
  icon?: React.ElementType;
  /** Optional accent (e.g. channel colour) applied when active. */
  activeStyle?: React.CSSProperties;
  title?: string;
  /** When set with `icon`, renders a compact icon-only segment (channel chips). */
  iconOnly?: boolean;
}

export function TabSegment({
  label,
  active,
  onClick,
  testId,
  count,
  icon: Icon,
  activeStyle,
  title,
  iconOnly = false,
}: TabSegmentProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? (iconOnly ? label : undefined)}
      aria-pressed={active}
      aria-label={iconOnly ? label : undefined}
      data-testid={testId}
      style={active && activeStyle ? activeStyle : undefined}
      className={cn(
        'text-caption inline-flex h-5 items-center gap-1.5 rounded-[7px] transition-colors',
        iconOnly ? 'px-2.5' : 'px-3',
        active ? 'bg-accent-soft text-accent-soft-foreground' : 'text-foreground hover:bg-muted',
        active && activeStyle && 'text-accent-soft-foreground'
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {!iconOnly && label}
      {!iconOnly && count ? (
        <span className="font-mono text-[10px] opacity-70">{count}</span>
      ) : null}
    </button>
  );
}
