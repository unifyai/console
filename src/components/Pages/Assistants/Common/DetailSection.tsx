'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The small uppercase label above a detail field, and the field itself.
 *
 * Extracted because the className was repeated in a dozen places and had
 * already drifted into four incompatible variants — mono 10px/0.08em in most
 * panes, a sans-semibold one in FunctionsPane, a third with no weight in the
 * Tasks field grid, a fourth in BrainRowDetail. Anything rendering the same
 * artifact in two places (an artifact's own page and a workflow preview of it)
 * has to agree here, and agreeing by copying a class string does not last.
 *
 * `mono` is the default because that is what most surfaces already use.
 */
export function DetailLabel({
  children,
  variant = 'mono',
  className,
  ...rest
}: React.ComponentPropsWithoutRef<'div'> & {
  variant?: 'mono' | 'field';
}) {
  return (
    <div
      className={cn(
        'uppercase text-muted-foreground',
        variant === 'mono'
          ? 'font-mono text-[10px] tracking-[0.08em]'
          : 'text-[10px] font-semibold tracking-[0.08em]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** A labelled block: the label, then whatever it describes. */
export function DetailSection({
  label,
  variant,
  className,
  children,
}: {
  label: React.ReactNode;
  variant?: 'mono' | 'field';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <DetailLabel variant={variant}>{label}</DetailLabel>
      <div className="text-[12.5px] leading-relaxed text-foreground">{children}</div>
    </div>
  );
}
