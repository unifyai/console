'use client';

import { CSSProperties } from 'react';
import { Column } from '@tanstack/react-table';

const ColumnResizer = ({
  column,
  resizeHandler,
}: {
  column: Column<any, unknown>;
  resizeHandler: (event: unknown) => void;
}) => {
  const resizerStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    height: '100%',
    right: 0,
    width: column.getIsResizing() ? 4 : 5,
    zIndex: 10,
    background: column.getIsResizing() ? 'var(--primary)' : 'rgba(0, 0, 0, 0.5)',
    cursor: 'col-resize',
    userSelect: 'none',
    touchAction: 'none',
    opacity: column.getIsResizing() ? 1 : 0,
  };
  return (
    <div
      {...{
        onDoubleClick: () => column.resetSize(),
        onMouseDown: (e) => {
          e.stopPropagation();
          resizeHandler(e);
        },
        onTouchStart: resizeHandler,
        style: resizerStyle,
      }}
    />
  );
};

export default ColumnResizer;
