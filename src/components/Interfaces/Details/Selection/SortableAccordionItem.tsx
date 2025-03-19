import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export default function SortableAccordionItem({
    id,
    children,
    editMode,
  }: {
    id: string;
    children: React.ReactNode;
    editMode?: boolean;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
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
          <div className="drag-handle p-2 cursor-grab" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className={editMode ? "flex-1 ml-0" : "flex-1 ml-2"}>{children}</div>
      </div>
    );
  }