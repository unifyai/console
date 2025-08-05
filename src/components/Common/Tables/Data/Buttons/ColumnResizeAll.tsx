"use client";

import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { Table, ColumnSizingState } from "@tanstack/react-table";

const ColumnResizeAll = ({
  table,
  setColumnSizing,
}: {
  table: Table<any>;
  setColumnSizing: (updater: ((old: ColumnSizingState) => ColumnSizingState) | ColumnSizingState) => void;
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startTotalSize = useRef(0);
  const startColumnSizes = useRef<ColumnSizingState>({});

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    startX.current = e.clientX;
    startTotalSize.current = table.getTotalSize();

    // Store the initial sizes of all visible columns
    const initialSizing: ColumnSizingState = {};
    table.getVisibleLeafColumns().forEach(col => {
        initialSizing[col.id] = col.getSize();
    });
    startColumnSizes.current = initialSizing;

  }, [table]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX.current;
    const newTotalSize = Math.max(startTotalSize.current + deltaX, table.getVisibleLeafColumns().length * 50); // Min width per column
    
    if (startTotalSize.current <= 0) return; // Avoid division by zero
    
    const ratio = newTotalSize / startTotalSize.current;

    const newColumnSizing: ColumnSizingState = {};
    Object.keys(startColumnSizes.current).forEach(colId => {
        newColumnSizing[colId] = startColumnSizes.current[colId] * ratio;
    });
    
    setColumnSizing(old => ({...old, ...newColumnSizing}));

  }, [isResizing, setColumnSizing, table]);

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


  // This is the invisible draggable area. It creates the whitespace and hover target.
  const resizerStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    right: "-10px", // Positions the start of the draggable area to the right of the column.
    width: "5px",  // Sets the width of the draggable area.
    height: "100%",
    zIndex: 20,
    cursor: "ew-resize",
    userSelect: "none",
    touchAction: "none",
  };
  
  // A container for the diagonal dashed pattern.
  const dashedSeparatorStyle: CSSProperties = {
    position: 'absolute',
    left: '-3px', // Provides a few pixels of whitespace from the column border.
    top: '-1px', // Overlap borders to create a continuous line
    height: 'calc(100% + 2px)',
    width: '5px', // Container width for the diagonal pattern.
    backgroundImage: `repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 4px,
      var(--muted-foreground) 4px,
      var(--muted-foreground) 5px
    )`,
    opacity: 0.5,
    pointerEvents: 'none',
  };

  // This is the solid bar that appears on hover/drag.
  const visualIndicatorStyle: CSSProperties = {
    position: 'absolute',
    right: '1px', // Positioned at the far right of the draggable area.
    top: '-1px',
    height: 'calc(100% + 2px)',
    width: '2px',
    backgroundColor: isResizing ? 'var(--primary)' : 'var(--border)', // Uses theme border color.
    opacity: 1,
    transition: 'opacity 0.2s, background-color 0.2s',
    borderRadius: '4px',
    pointerEvents: 'none',
  }
  
  return (
    <div
      onMouseDown={handleMouseDown}
      style={resizerStyle}
      className="group/ColumnResizeAll"
    >
      <div style={dashedSeparatorStyle} className="group-hover/ColumnResizeAll:opacity-100" />
      <div 
        style={visualIndicatorStyle}
        className="group-hover/ColumnResizeAll:opacity-100 group-hover/ColumnResizeAll:bg-primary"
      />
    </div>
  );
};

export default ColumnResizeAll;