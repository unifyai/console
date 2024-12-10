"use client";

import { CSSProperties } from "react";

import { Header } from "@tanstack/react-table";
const ColumnResizer = ({header}: {header: Header<any, unknown>}) => {
    const resizerStyle : CSSProperties = {
      position: "absolute",
      top: 0,
      height: "100%",
      right: 0,
      width: 10,
      background: header.column.getIsResizing() ? "blue" : "rgba(0, 0, 0, 0.5)",
      cursor: "col-resize",
      userSelect: "none",
      touchAction: "none",
      opacity: header.column.getIsResizing() ? 1 : 0,
    };
    return (
      <div
        {...{
          onDoubleClick: () => header.column.resetSize(),
          onMouseDown: header.getResizeHandler(),
          onTouchStart: header.getResizeHandler(),
          style: resizerStyle,
        }}
      />
    );
  };

export default ColumnResizer;
