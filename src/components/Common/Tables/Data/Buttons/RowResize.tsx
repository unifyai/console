'use client';

import { Row } from '@tanstack/react-table';
import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

const RowResize = ({
  row,
  setRowSizing,
}: {
  row: Row<any>;
  setRowSizing: (updater: (old: { [key: string]: number }) => { [key: string]: number }) => void;
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const startY = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const currentTR = document.querySelector(`[data-row-id='${row.id}']`) as HTMLTableRowElement;
      if (!currentTR) return;

      setIsResizing(true);
      startY.current = e.clientY;
      currentTR.dataset.startHeight = String(currentTR.clientHeight);
    },
    [row.id]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const currentTR = document.querySelector(`[data-row-id='${row.id}']`) as HTMLTableRowElement;
      if (!currentTR) return;

      const deltaY = e.clientY - startY.current;
      const startHeight = parseFloat(currentTR.dataset.startHeight || '0');
      const newHeight = Math.max(21, startHeight + deltaY);

      setRowSizing((old) => ({
        ...old,
        [row.id]: newHeight,
      }));
    },
    [isResizing, row.id, setRowSizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    const currentTR = document.querySelector(`[data-row-id='${row.id}']`) as HTMLTableRowElement;
    if (currentTR) {
      delete currentTR.dataset.startHeight;
    }
  }, [row.id]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const resizerStyle: CSSProperties = {
    position: 'absolute',
    bottom: -2.5,
    left: 0,
    width: '100%',
    height: 5,
    background: isResizing ? 'var(--primary)' : 'transparent',
    cursor: 'row-resize',
    userSelect: 'none',
    touchAction: 'none',
    opacity: isResizing ? 1 : 0,
    zIndex: 10,
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={resizerStyle}
      className="group-hover/row:opacity-100"
    />
  );
};

export default RowResize;
