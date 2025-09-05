"use client";
import React, { memo, useState } from "react";
import { Handle, Position } from "reactflow";
import type { LucideIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/UI/popover";

/**
 * SpanNode props:
 *  - data.icon: a Lucide icon component (e.g., ChevronsLeftRightEllipsis).
 *  - data.title: the function/span name to display.
 *  - data.ID: unique ID string for the span.
 *  - data.offset: number (start time).
 *  - data.execTime: number (duration).
 *  - data.hasError: boolean (if true, highlight as error).
 */
function SpanNode({ data, isConnectable }: any) {
  const {
    icon: IconComponent,
    title = "No Title",
    ID = "No ID",
    offset = 0,
    execTime = 0,
    hasError = false,
  } = data;

  const [open, setOpen] = useState(false);

  // Apply a different border color if hasError is true.
  const borderClass = hasError ? "border-destructive" : "border-primary";
  const bgClass = "bg-background";

  // Example timing calculations
  const startTime = offset;
  const endTime = offset + (execTime || 0);
  const duration = endTime - startTime;

  return (
    <div className={`px-4 py-2 rounded-md border-2 shadow-sm flex items-center gap-3 ${borderClass} ${bgClass}`}>
      {/* Left handle => target for incoming edges */}
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

      {/* Title - popover on click */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="nodrag pointer-events-auto text-body text-strong text-foreground underline-offset-2 hover:underline"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ cursor: "pointer" }}
          >
            {title}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="nodrag pointer-events-auto w-56 p-2 space-y-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-title">Span Info</p>
          <div className="text-body text-muted-foreground">
            <p>ID: {ID}</p>
            <p>Offset: {offset}</p>
            <p>Exec Time: {execTime}</p>
            <p>Duration: {duration.toFixed(2)} ms</p>
            {hasError && (
              <p className="text-destructive font-semibold mt-2">
                Error encountered
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Right handle => source for outgoing edges */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!bg-accent w-2 h-6 rounded-none"
      />
    </div>
  );
}

export default memo(SpanNode);