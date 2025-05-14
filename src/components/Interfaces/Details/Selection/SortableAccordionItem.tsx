import React from 'react';
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Span } from "@/types/evals/traces";

export default function SortableAccordionItem({
    id,
    children,
    editMode,
    onTraceUpdate,
  }: {
    id: string;
    children: React.ReactNode;
    editMode?: boolean;
    onTraceUpdate?: (logIndex: number, fieldName: string, newTrace: Span[]) => void;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({
      id,
    });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      minHeight: "48px",
    };

    return (
      <div ref={setNodeRef} style={style} className="flex items-center">
        {editMode && (
          <div className="p-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div
          // Apply cursor-grabbing when dragging, cursor-grab when editable but not dragging
          className={`flex-1 ${editMode ? (isDragging ? 'cursor-grabbing ml-0' : 'cursor-grab ml-0') : 'ml-2'}`}
        >
          {React.cloneElement(
            children as React.ReactElement,
            {
              ...(editMode ? { dragAttributes: attributes, dragListeners: listeners } : {}),
              onTraceUpdate
            }
          )}
        </div>
      </div>
    );
  }