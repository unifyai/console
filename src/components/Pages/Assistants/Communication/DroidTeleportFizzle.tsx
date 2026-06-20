'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type TeleportMode = 'in' | 'out';

const DEFAULT_DURATION_MS = 225;

/**
 * Simple paired fade used for the coordinator handoff. ``out`` fades the droid
 * away in its intro position; ``in`` fades the docked droid in once the intro
 * droid has fully disappeared.
 */
export function DroidTeleportFizzle({
  mode,
  active = true,
  durationMs = DEFAULT_DURATION_MS,
  className,
  children,
}: {
  mode: TeleportMode;
  /** Drives the ``out`` fade. ``in`` runs on mount, so leave this at its default. */
  active?: boolean;
  durationMs?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = React.useState(mode === 'out');

  React.useEffect(() => {
    if (mode === 'in') {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(!active);
    return undefined;
  }, [active, mode]);

  return (
    <div
      className={cn('relative', className)}
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${durationMs}ms ease-out`,
      }}
    >
      {children}
    </div>
  );
}
