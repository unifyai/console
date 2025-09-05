import React, { memo, useState } from "react";
import { Handle, Position } from "reactflow";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/UI/popover";
import { ChevronsLeftRightEllipsis } from "lucide-react";

interface MultiSpanNodeData {
  spanName: string;
  inBase: boolean;     // If baseSpan is present => true => border red, else green
  rowString?: string;  // e.g. "1-3,5"
}

/**
 * MultiSpanNode:
 * - Red border if inBase, green if only comparables
 * - show rowString if present
 */
function MultiSpanNode({ data, isConnectable }: any) {
  const { spanName, inBase, rowString } = data as MultiSpanNodeData;
  const borderClass = inBase ? "border-red-600" : "border-green-600";

  const [open, setOpen] = useState(false);

  return (
    <div className={`px-4 py-2 border-4 rounded-md shadow-sm flex items-center gap-2 bg-background ${borderClass}`}>
      {/* Left handle */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="!bg-accent w-2 h-6 rounded-none"
      />

      {/* Node content => icon + name + row listing */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="nodrag pointer-events-auto text-body text-strong text-foreground hover:underline"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ cursor: "pointer" }}
          >
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1">
                <ChevronsLeftRightEllipsis className="h-4 w-4" />
                <span>{spanName}</span>
              </div>
              {rowString && (
                <span className="text-caption text-muted-foreground ml-5">
                  Rows: {rowString}
                </span>
              )}
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="nodrag pointer-events-auto w-56 p-2 space-y-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className="text-title">Merged Node</p>
          <p className="text-caption text-muted-foreground">
            {inBase 
              ? "This node is also in the base" 
              : "This node is only in the comparables"
            }
          </p>
          {rowString && <p className="text-caption">Rows: {rowString}</p>}
        </PopoverContent>
      </Popover>

      {/* Right handle */}
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