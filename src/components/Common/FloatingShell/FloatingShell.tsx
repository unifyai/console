'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useFloatingShellGeometry } from './useFloatingShellGeometry';
import type { FloatingGeometryPreset } from '@/utils/ui/floating-geometry';

interface FloatingShellProps {
  children: React.ReactNode;
  preset?: FloatingGeometryPreset;
  className?: string;
  contentClassName?: string;
  zIndexClassName?: string;
  /** When false, geometry is seeded on first mount. */
  seedOnMount?: boolean;
  /** Called when the user begins dragging the shell by its header/surface. */
  onDragStart?: () => void;
  /** Entire shell surface is draggable (compact call mode). */
  dragSurface?: boolean;
  testId?: string;
}

export function FloatingShell({
  children,
  preset = 'call',
  className,
  contentClassName,
  zIndexClassName = 'z-50',
  seedOnMount = true,
  onDragStart,
  dragSurface = false,
  testId,
}: FloatingShellProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const {
    floatingPos,
    floatingSize,
    seedDefaultGeometry,
    handleHeaderPointerDown,
    handleCornerResize,
    handleEdgeResize,
    handleResizeEnd,
  } = useFloatingShellGeometry({ preset, seedOnMount });

  React.useEffect(() => {
    if (seedOnMount) seedDefaultGeometry();
  }, [seedOnMount, seedDefaultGeometry]);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      handleHeaderPointerDown(e, contentRef, onDragStart);
    },
    [handleHeaderPointerDown, onDragStart]
  );

  const resizeHandleClass = 'absolute z-10 h-3 w-3 opacity-0 hover:opacity-100 transition-opacity';

  return (
    <div
      ref={contentRef}
      data-testid={testId}
      className={cn(
        'fixed flex flex-col overflow-hidden rounded-lg border border-border p-0 text-foreground shadow-2xl',
        'bg-background/80 backdrop-blur-md',
        dragSurface && 'group cursor-grab active:cursor-grabbing',
        zIndexClassName,
        className
      )}
      style={{
        left: floatingPos.x,
        top: floatingPos.y,
        width: floatingSize.width,
        height: floatingSize.height,
      }}
      onPointerDown={dragSurface ? onPointerDown : undefined}
    >
      <div className={cn('flex min-h-0 flex-1 flex-col', contentClassName)}>{children}</div>

      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <motion.div
          key={corner}
          drag
          dragMomentum={false}
          dragElastic={0}
          dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
          onDrag={handleCornerResize(corner)}
          onDragEnd={handleResizeEnd}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            resizeHandleClass,
            corner === 'tl' && 'left-0 top-0 cursor-nwse-resize',
            corner === 'tr' && 'right-0 top-0 cursor-nesw-resize',
            corner === 'bl' && 'bottom-0 left-0 cursor-nesw-resize',
            corner === 'br' && 'bottom-0 right-0 cursor-nwse-resize'
          )}
        />
      ))}
      {(['t', 'r', 'b', 'l'] as const).map((edge) => (
        <motion.div
          key={edge}
          drag
          dragMomentum={false}
          dragElastic={0}
          dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
          onDrag={handleEdgeResize(edge)}
          onDragEnd={handleResizeEnd}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'absolute z-10 opacity-0 transition-opacity hover:opacity-100',
            edge === 't' && 'left-3 right-3 top-0 h-1.5 cursor-ns-resize',
            edge === 'b' && 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize',
            edge === 'l' && 'bottom-3 left-0 top-3 w-1.5 cursor-ew-resize',
            edge === 'r' && 'bottom-3 right-0 top-3 w-1.5 cursor-ew-resize'
          )}
        />
      ))}
    </div>
  );
}

export { useFloatingShellGeometry };
