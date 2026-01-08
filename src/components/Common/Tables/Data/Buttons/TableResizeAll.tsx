'use client';

import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Table, ColumnSizingState } from '@tanstack/react-table';

const TableResizeAll = ({
  table,
  setColumnSizing,
  setRowSizing,
}: {
  table: Table<any>;
  setColumnSizing: (
    updater: ((old: ColumnSizingState) => ColumnSizingState) | ColumnSizingState
  ) => void;
  setRowSizing: (
    updater:
      | ((old: { [key: string]: number }) => { [key: string]: number })
      | { [key: string]: number }
  ) => void;
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTotalSize = useRef(0);
  const startTotalHeight = useRef(0);
  const startColumnSizes = useRef<ColumnSizingState>({});
  const startRowHeights = useRef<{ [key: string]: number }>({});

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsResizing(true);
      startX.current = e.clientX;
      startY.current = e.clientY;

      // Column sizing initial state
      startTotalSize.current = table.getTotalSize();
      const initialColumnSizing: ColumnSizingState = {};
      table.getVisibleLeafColumns().forEach((col) => {
        initialColumnSizing[col.id] = col.getSize();
      });
      startColumnSizes.current = initialColumnSizing;

      // Row sizing initial state
      const initialRowSizing: { [key: string]: number } = {};
      let totalHeight = 0;
      table.getRowModel().rows.forEach((row) => {
        const rowElement = document.querySelector(
          `[data-row-id='${row.id}']`
        ) as HTMLTableRowElement;
        const currentHeight = rowElement?.clientHeight || 21; // Default height
        initialRowSizing[row.id] = currentHeight;
        totalHeight += currentHeight;
      });
      startRowHeights.current = initialRowSizing;
      startTotalHeight.current = totalHeight;
    },
    [table]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      // --- Column Resizing Logic ---
      const deltaX = e.clientX - startX.current;
      if (startTotalSize.current > 0) {
        const newTotalSize = Math.max(
          startTotalSize.current + deltaX,
          table.getVisibleLeafColumns().length * 50
        ); // Min width per column
        const ratioX = newTotalSize / startTotalSize.current;
        const newColumnSizing: ColumnSizingState = {};
        Object.keys(startColumnSizes.current).forEach((colId) => {
          newColumnSizing[colId] = startColumnSizes.current[colId] * ratioX;
        });
        setColumnSizing((old) => ({ ...old, ...newColumnSizing }));
      }

      // --- Row Resizing Logic ---
      const deltaY = e.clientY - startY.current;
      if (startTotalHeight.current > 0) {
        const newTotalHeight = Math.max(
          startTotalHeight.current + deltaY,
          table.getRowModel().rows.length * 21
        ); // Min height per row
        const ratioY = newTotalHeight / startTotalHeight.current;
        const newRowSizing: { [key: string]: number } = {};
        Object.keys(startRowHeights.current).forEach((rowId) => {
          newRowSizing[rowId] = startRowHeights.current[rowId] * ratioY;
        });
        setRowSizing((old) => ({ ...old, ...newRowSizing }));
      }
    },
    [isResizing, setColumnSizing, setRowSizing, table]
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
    right: '-5px',
    bottom: 0,
    width: '10px',
    height: '10px',
    cursor: 'nwse-resize',
    zIndex: 40,
    userSelect: 'none',
    touchAction: 'none',
  };

  const visualIndicatorStyle: CSSProperties = {
    position: 'absolute',
    right: '0px',
    bottom: '0px',
    width: '10px',
    height: '10px',
    opacity: 1,
    pointerEvents: 'none',
    transition: 'opacity 0.2s',
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={resizerStyle}
      className="absolute group-hover/footer-resizer-cell:opacity-100"
    >
      <div style={visualIndicatorStyle} className="group-hover/footer-resizer-cell:opacity-50" />
    </div>
  );
};

export default TableResizeAll;
