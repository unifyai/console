'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const STORAGE_PREFIX = 'console:split-pane:';
const DEFAULT_WIDTH = 288;
const MIN_WIDTH = 220;
const MAX_WIDTH = 520;

interface SplitPaneLayoutProps {
  /** Stable id used for localStorage persistence. */
  paneId: string;
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
  leftClassName?: string;
  rightClassName?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

function readStoredWidth(paneId: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${paneId}`);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Two-pane layout with a draggable vertical divider. Persists the left pane
 * width in localStorage keyed by `paneId`.
 */
export function SplitPaneLayout({
  paneId,
  left,
  right,
  className,
  leftClassName,
  rightClassName,
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
}: SplitPaneLayoutProps) {
  const [leftWidth, setLeftWidth] = React.useState(() => readStoredWidth(paneId, defaultWidth));
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = React.useState(false);

  const clampWidth = React.useCallback(
    (next: number) => Math.min(maxWidth, Math.max(minWidth, next)),
    [maxWidth, minWidth]
  );

  const handleResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const container = containerRef.current;
      if (!container) return;

      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      let nextWidth = clampWidth(leftWidth);

      setIsResizing(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        nextWidth = clampWidth(ev.clientX - rect.left);
        setLeftWidth(nextWidth);
      };

      const onUp = () => {
        setIsResizing(false);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.localStorage.setItem(`${STORAGE_PREFIX}${paneId}`, String(nextWidth));
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [clampWidth, leftWidth, paneId]
  );

  return (
    <div ref={containerRef} className={cn('flex min-h-0 flex-1 overflow-hidden', className)}>
      <div
        className={cn('shrink-0 overflow-hidden border-r border-border', leftClassName)}
        style={{ width: leftWidth }}
      >
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        onPointerDown={handleResizeStart}
        className={cn(
          'group relative z-10 w-1 shrink-0 cursor-col-resize bg-transparent',
          'before:absolute before:inset-y-0 before:-left-1 before:w-3',
          isResizing ? 'bg-primary/30' : 'hover:bg-primary/20'
        )}
      />

      <div className={cn('min-w-0 flex-1 overflow-hidden', rightClassName)}>{right}</div>
    </div>
  );
}
