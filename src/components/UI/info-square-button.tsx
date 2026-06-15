'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export const InfoSquareButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'>
>(({ className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label="More information"
    className={cn(
      'text-caption rounded-control inline-flex h-4 w-4 shrink-0 scale-90 cursor-help items-center justify-center border border-muted-foreground text-muted-foreground transition-colors hover:text-foreground',
      className
    )}
    {...props}
  >
    {children ?? (
      <span aria-hidden="true" className="flex h-2.5 w-1 flex-col items-center justify-between">
        <span className="rounded-control h-0.5 w-0.5 bg-current" />
        <span className="rounded-control h-[7px] w-0.5 bg-current" />
      </span>
    )}
  </button>
));
InfoSquareButton.displayName = 'InfoSquareButton';
