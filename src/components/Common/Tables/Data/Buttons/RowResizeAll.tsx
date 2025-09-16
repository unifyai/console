"use client";

import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { Table } from "@tanstack/react-table";

const RowResizeAll = ({
  table,
  setRowSizing,
}: {
  table: Table<any>;
  setRowSizing: (updater: ((old: { [key: string]: number }) => { [key: string]: number }) | { [key: string]: number }) => void;
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const startY = useRef(0);
  const startRowHeights = useRef<{ [key: string]: number }>({});
  const totalInitialHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    startY.current = e.clientY;

    const initialSizing: { [key: string]: number } = {};
    let totalHeight = 0;
    table.getRowModel().rows.forEach(row => {
        const rowElement = document.querySelector(`[data-row-id='${row.id}']`) as HTMLTableRowElement;
        const currentHeight = rowElement?.clientHeight || 21; // Default height
        initialSizing[row.id] = currentHeight;
        totalHeight += currentHeight;
    });
    startRowHeights.current = initialSizing;
    totalInitialHeight.current = totalHeight;

  }, [table]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || totalInitialHeight.current === 0) return;

    const deltaY = e.clientY - startY.current;
    const newTotalHeight = Math.max(totalInitialHeight.current + deltaY, table.getRowModel().rows.length * 21); // Min height per row
    
    const ratio = newTotalHeight / totalInitialHeight.current;

    const newRowSizing: { [key: string]: number } = {};
    Object.keys(startRowHeights.current).forEach(rowId => {
        newRowSizing[rowId] = startRowHeights.current[rowId] * ratio;
    });
    
    setRowSizing(old => ({...old, ...newRowSizing}));

  }, [isResizing, setRowSizing, table]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const resizerStyle: CSSProperties = {
    position: "absolute",
    bottom: "-6px",
    left: "0px",
    width: "100%",
    height: "5px",
    zIndex: 100,
    cursor: "ns-resize",
    userSelect: "none",
    touchAction: "none",
  };
  
  const handlerStyle: CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '1px',
    backgroundColor: 'var(--muted)',
    opacity: 1,
    pointerEvents: 'none',
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={resizerStyle}
      className="group/RowResizeAll"
    >
      <div style={handlerStyle} />
    </div>
  );
};

export default RowResizeAll;