'use client';

import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Table, ColumnSizingState } from '@tanstack/react-table';

const ColumnResizeAll = ({
  table,
  setColumnSizing,
}: {
  table: Table<any>;
  setColumnSizing: (
    updater: ((old: ColumnSizingState) => ColumnSizingState) | ColumnSizingState
  ) => void;
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startTotalSize = useRef(0);
  const startColumnSizes = useRef<ColumnSizingState>({});

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsResizing(true);
      startX.current = e.clientX;
      startTotalSize.current = table.getTotalSize();

      // Store the initial sizes of all visible columns
      const initialSizing: ColumnSizingState = {};
      table.getVisibleLeafColumns().forEach((col) => {
        initialSizing[col.id] = col.getSize();
      });
      startColumnSizes.current = initialSizing;
    },
    [table]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startX.current;
      const newTotalSize = Math.max(
        startTotalSize.current + deltaX,
        table.getVisibleLeafColumns().length * 50
      ); // Min width per column

      if (startTotalSize.current <= 0) return; // Avoid division by zero

      const ratio = newTotalSize / startTotalSize.current;

      const newColumnSizing: ColumnSizingState = {};
      Object.keys(startColumnSizes.current).forEach((colId) => {
        newColumnSizing[colId] = startColumnSizes.current[colId] * ratio;
      });

      setColumnSizing((old) => ({ ...old, ...newColumnSizing }));
    },
    [isResizing, setColumnSizing, table]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const resizerStyle: CSSProperties = {
    position: 'absolute',
    top: '0px',
    right: '-12px',
    width: '5px',
    height: '100%',
    zIndex: 100,
    cursor: 'ew-resize',
    userSelect: 'none',
    touchAction: 'none',
  };

  const handlerStyle: CSSProperties = {
    position: 'absolute',
    right: 0,
    top: 0,
    height: '100%',
    width: '1px',
    backgroundColor: 'var(--muted)',
    opacity: 1,
    pointerEvents: 'none',
  };

  return (
    <div onMouseDown={handleMouseDown} style={resizerStyle} className="group/ColumnResizeAll">
      <div style={handlerStyle} />
    </div>
  );
};

export default ColumnResizeAll;
