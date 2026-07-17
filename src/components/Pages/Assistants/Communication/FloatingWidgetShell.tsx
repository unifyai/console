'use client';

import * as React from 'react';
import { motion, PanInfo, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface FloatingWidgetShellProps {
  children: React.ReactNode;
  className?: string;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  testId?: string;
}

/**
 * Draggable, corner/edge-resizable bottom-right floating widget. Shared shell
 * for every minimized call surface (1:1 assistant calls and multi-party org
 * calls) so they move, resize, and anchor identically.
 */
export function FloatingWidgetShell({
  children,
  className,
  initialWidth = 256,
  initialHeight = 192,
  minWidth = 200,
  minHeight = 160,
  maxWidth = 640,
  maxHeight = 520,
  testId,
}: FloatingWidgetShellProps) {
  const [size, setSize] = React.useState({ width: initialWidth, height: initialHeight });
  const [isResizing, setIsResizing] = React.useState(false);
  const sizeRef = React.useRef(size);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleCornerResize = React.useCallback(
    (corner: 'tl' | 'tr' | 'bl' | 'br') =>
      (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsResizing(true);

        const prev = sizeRef.current;
        const dx = corner === 'tl' || corner === 'bl' ? -info.delta.x : info.delta.x;
        const dy = corner === 'tl' || corner === 'tr' ? -info.delta.y : info.delta.y;

        const newWidth = Math.min(maxWidth, Math.max(minWidth, prev.width + dx));
        const newHeight = Math.min(maxHeight, Math.max(minHeight, prev.height + dy));

        const actualDw = newWidth - prev.width;
        const actualDh = newHeight - prev.height;

        // The element is CSS-anchored at bottom-right, so changing size moves the
        // top-left corner by default. Compensate by shifting the element's
        // transform so the corner opposite to the one being dragged stays fixed.
        if (corner === 'tr' || corner === 'br') {
          x.set(x.get() + actualDw);
        }
        if (corner === 'bl' || corner === 'br') {
          y.set(y.get() + actualDh);
        }

        sizeRef.current = { width: newWidth, height: newHeight };
        setSize({ width: newWidth, height: newHeight });
      },
    [x, y, minWidth, minHeight, maxWidth, maxHeight]
  );

  const handleEdgeResize = React.useCallback(
    (edge: 't' | 'r' | 'b' | 'l') =>
      (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsResizing(true);

        const prev = sizeRef.current;
        const dw = edge === 'l' ? -info.delta.x : edge === 'r' ? info.delta.x : 0;
        const dh = edge === 't' ? -info.delta.y : edge === 'b' ? info.delta.y : 0;

        const newWidth = Math.min(maxWidth, Math.max(minWidth, prev.width + dw));
        const newHeight = Math.min(maxHeight, Math.max(minHeight, prev.height + dh));

        const actualDw = newWidth - prev.width;
        const actualDh = newHeight - prev.height;

        // The element is CSS-anchored at bottom-right, so compensate by shifting
        // the transform so the opposite edge stays fixed.
        if (edge === 'r') {
          x.set(x.get() + actualDw);
        }
        if (edge === 'b') {
          y.set(y.get() + actualDh);
        }

        sizeRef.current = { width: newWidth, height: newHeight };
        setSize({ width: newWidth, height: newHeight });
      },
    [x, y, minWidth, minHeight, maxWidth, maxHeight]
  );

  const handleResizeEnd = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resizeHandleClass =
    'absolute z-10 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity';

  return (
    <motion.div
      drag={!isResizing}
      dragMomentum={false}
      whileDrag={isResizing ? undefined : { scale: 1.02 }}
      data-testid={testId}
      className={cn(
        'bg-card/90 group fixed bottom-5 right-5 z-50 flex cursor-grab flex-col items-center justify-center rounded-xl border border-border p-4 shadow-pop-lg backdrop-blur-md active:cursor-grabbing',
        className
      )}
      style={{ width: size.width, height: size.height, x, y }}
    >
      {/* Resize handles on corners */}
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
      {/* Resize handles on edges */}
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
            'absolute z-10 opacity-0 transition-opacity group-hover:opacity-100',
            edge === 't' && 'left-3 right-3 top-0 h-1.5 cursor-ns-resize',
            edge === 'b' && 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize',
            edge === 'l' && 'bottom-3 left-0 top-3 w-1.5 cursor-ew-resize',
            edge === 'r' && 'bottom-3 right-0 top-3 w-1.5 cursor-ew-resize'
          )}
        />
      ))}
      {children}
    </motion.div>
  );
}
