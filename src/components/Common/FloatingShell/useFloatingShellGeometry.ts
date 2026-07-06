'use client';

import * as React from 'react';
import type { PanInfo } from 'framer-motion';
import {
  EMPTY_FLOATING_GEOMETRY,
  getDefaultFloatingGeometry,
  MIN_FLOATING_HEIGHT,
  MIN_FLOATING_WIDTH,
  type FloatingGeometry,
  type FloatingGeometryPreset,
  type FloatingPoint,
  type FloatingSize,
} from '@/utils/ui/floating-geometry';

export function useFloatingShellGeometry(options: {
  preset?: FloatingGeometryPreset;
  seedOnMount?: boolean;
}) {
  const { preset = 'call', seedOnMount = true } = options;

  const initialGeometryRef = React.useRef<FloatingGeometry | null>(null);
  if (initialGeometryRef.current === null) {
    initialGeometryRef.current = seedOnMount
      ? getDefaultFloatingGeometry(preset)
      : EMPTY_FLOATING_GEOMETRY;
  }

  const [floatingPos, setFloatingPos] = React.useState(initialGeometryRef.current.pos);
  const [floatingSize, setFloatingSize] = React.useState(initialGeometryRef.current.size);
  const floatingPosRef = React.useRef(initialGeometryRef.current.pos);
  const floatingSizeRef = React.useRef(initialGeometryRef.current.size);
  const [isResizing, setIsResizing] = React.useState(false);

  const seedDefaultGeometry = React.useCallback(() => {
    if (floatingSizeRef.current.width > 0) return;
    const geometry = getDefaultFloatingGeometry(preset);
    floatingPosRef.current = geometry.pos;
    floatingSizeRef.current = geometry.size;
    setFloatingPos(geometry.pos);
    setFloatingSize(geometry.size);
  }, [preset]);

  const captureGeometryFromRect = React.useCallback((rect: DOMRect) => {
    const pos = { x: rect.x, y: rect.y };
    const size = { width: rect.width, height: rect.height };
    floatingPosRef.current = pos;
    floatingSizeRef.current = size;
    setFloatingPos(pos);
    setFloatingSize(size);
  }, []);

  const setGeometry = React.useCallback((geometry: FloatingGeometry) => {
    floatingPosRef.current = geometry.pos;
    floatingSizeRef.current = geometry.size;
    setFloatingPos(geometry.pos);
    setFloatingSize(geometry.size);
  }, []);

  const handleHeaderPointerDown = React.useCallback(
    (
      e: React.PointerEvent,
      contentRef: React.RefObject<HTMLElement | null>,
      onDragStart?: () => void
    ) => {
      const startX = e.clientX;
      const startY = e.clientY;
      let dragStarted = false;

      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return;
      const offsetX = startX - rect.x;
      const offsetY = startY - rect.y;

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!dragStarted && Math.abs(dx) + Math.abs(dy) > 5) {
          dragStarted = true;
          onDragStart?.();
        }

        if (dragStarted) {
          const newPos: FloatingPoint = {
            x: moveEvent.clientX - offsetX,
            y: moveEvent.clientY - offsetY,
          };
          floatingPosRef.current = newPos;
          setFloatingPos(newPos);
        }
      };

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        document.body.style.userSelect = '';
      };

      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    []
  );

  const handleCornerResize = React.useCallback(
    (corner: 'tl' | 'tr' | 'bl' | 'br') =>
      (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsResizing(true);
        const prev = floatingSizeRef.current;
        const prevPos = floatingPosRef.current;

        const dw = corner === 'tl' || corner === 'bl' ? -info.delta.x : info.delta.x;
        const dh = corner === 'tl' || corner === 'tr' ? -info.delta.y : info.delta.y;

        const newWidth = Math.max(MIN_FLOATING_WIDTH, prev.width + dw);
        const newHeight = Math.max(MIN_FLOATING_HEIGHT, prev.height + dh);
        const actualDw = newWidth - prev.width;
        const actualDh = newHeight - prev.height;

        let newX = prevPos.x;
        let newY = prevPos.y;
        if (corner === 'tl' || corner === 'bl') newX -= actualDw;
        if (corner === 'tl' || corner === 'tr') newY -= actualDh;

        floatingSizeRef.current = { width: newWidth, height: newHeight };
        floatingPosRef.current = { x: newX, y: newY };
        setFloatingSize({ width: newWidth, height: newHeight });
        setFloatingPos({ x: newX, y: newY });
      },
    []
  );

  const handleEdgeResize = React.useCallback(
    (edge: 't' | 'r' | 'b' | 'l') =>
      (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsResizing(true);
        const prev = floatingSizeRef.current;
        const prevPos = floatingPosRef.current;

        const dw = edge === 'l' ? -info.delta.x : edge === 'r' ? info.delta.x : 0;
        const dh = edge === 't' ? -info.delta.y : edge === 'b' ? info.delta.y : 0;

        const newWidth = Math.max(MIN_FLOATING_WIDTH, prev.width + dw);
        const newHeight = Math.max(MIN_FLOATING_HEIGHT, prev.height + dh);
        const actualDw = newWidth - prev.width;
        const actualDh = newHeight - prev.height;

        let newX = prevPos.x;
        let newY = prevPos.y;
        if (edge === 'l') newX -= actualDw;
        if (edge === 't') newY -= actualDh;

        floatingSizeRef.current = { width: newWidth, height: newHeight };
        floatingPosRef.current = { x: newX, y: newY };
        setFloatingSize({ width: newWidth, height: newHeight });
        setFloatingPos({ x: newX, y: newY });
      },
    []
  );

  const handleResizeEnd = React.useCallback(() => setIsResizing(false), []);

  return {
    floatingPos,
    floatingSize,
    isResizing,
    seedDefaultGeometry,
    captureGeometryFromRect,
    setGeometry,
    handleHeaderPointerDown,
    handleCornerResize,
    handleEdgeResize,
    handleResizeEnd,
  };
}
