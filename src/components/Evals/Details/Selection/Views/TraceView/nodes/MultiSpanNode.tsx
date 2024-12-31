"use client";
import React, { memo, useState } from "react";
import { Handle, Position } from "reactflow";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/UI/popover";
import type { LucideIcon } from "lucide-react";

/**
 * MultiSpanNode props:
 *  - data.icon: optional Lucide icon component (e.g., ChevronsLeftRightEllipsis).
 *  - data.title: function/span name to display.
 *  - data.ID: unique ID string for the span.
 *  - data.offset: number (start time).
 *  - data.execTime: number (duration).
 *  - data.hasError: boolean (highlight if error).
 *  - data.traceIndex: the index of this trace in allTraces (for color-coding).
 *  - data.rowIndex: an external reference (e.g. table row index).
 */
interface MultiSpanNodeProps {
  data: {
    icon?: LucideIcon;
    title?: string;
    ID?: string;
    offset?: number;
    execTime?: number;
    hasError?: boolean;
    traceIndex: number; // for color-coding
    rowIndex: number;   // optional reference to a larger dataset
  };
  isConnectable: boolean;
}

const traceColors = [
  { bg: "bg-red-200", border: "border-red-600" },
  { bg: "bg-blue-200", border: "border-blue-600" },
  { bg: "bg-green-200", border: "border-green-600" },
  { bg: "bg-yellow-200", border: "border-yellow-600" },
  { bg: "bg-purple-200", border: "border-purple-600" },
  { bg: "bg-orange-200", border: "border-orange-600" },
];

/**
 * MultiSpanNode:
 * - Color-codes nodes according to traceIndex.
 * - Shows rowIndex (or "Trace #") in the popover.
 * - Places handles on left (target) and right (source) for horizontal flows.
 */
function MultiSpanNode({ data, isConnectable }: MultiSpanNodeProps) {
  const {
    icon: IconComponent,
    title = "No Title",
    ID = "No ID",
    offset = 0,
    execTime = 0,
    hasError = false,
    traceIndex,
    rowIndex,
  } = data;

  const [open, setOpen] = useState(false);

  // Pick a color scheme for this trace
  const c = traceColors[traceIndex % traceColors.length];

  // Example timing
  const startTime = offset;
  const endTime = startTime + (execTime || 0);
  const duration = (endTime - startTime).toFixed(2);

  // If the node has an error, we can highlight the border more severely
  const borderClass = hasError ? "border-4" : "border-2";
  const extraBorder = hasError ? "border-dashed" : "border-solid";

  return (
    <div
      className={`
        px-4 py-2 rounded-md shadow-sm flex items-center gap-3 bg-background
        ${c.border} ${borderClass} ${extraBorder}
      `}
    >
      {/* Left Handle => target for incoming edges */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="!bg-accent w-2 h-6 rounded-none"
      />

      {/* Icon */}
      <div className="rounded-full w-8 h-8 flex justify-center items-center bg-muted text-primary">
        {IconComponent && <IconComponent className="h-4 w-4" />}
      </div>

      {/* Title & popover (clickable) */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="nodrag pointer-events-auto text-sm font-bold text-foreground underline-offset-2 hover:underline"
            onMouseDown={(e) => e.stopPropagation()} // avoid dragging
            style={{ cursor: "pointer" }}
          >
            {title}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="nodrag pointer-events-auto w-56 p-2 space-y-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-semibold">Span Info</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Trace #{traceIndex}</p>
            <p>Row: {rowIndex}</p>
            <p>ID: {ID}</p>
            <p>Offset: {offset}</p>
            <p>Exec Time: {execTime}</p>
            <p>Duration: {duration} ms</p>
            {hasError && (
              <p className="text-destructive font-semibold mt-2">
                Error encountered
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Right Handle => source for outgoing edges */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!bg-accent w-2 h-6 rounded-none"
      />
    </div>
  );
}

export default memo(MultiSpanNode);