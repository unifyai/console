import * as React from 'react';
import { Badge } from "@/components/UI/badge";
import { Trash2, Save, Undo2 } from "lucide-react";
import type { Task } from "@/types/team/task";
import ActionButton from '../Common/Buttons/Action';
import { Textarea } from "@/components/UI/textarea";
import { cn } from '@/lib/utils';
import {
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/UI/accordion";

interface TaskListItemProps {
    task: Task;
}

export function TaskListItem({ task }: TaskListItemProps) {
    const [description, setDescription] = React.useState(task.description);
    const [isEditing, setIsEditing] = React.useState(false);
    const originalDescription = React.useRef(task.description);

    // Keep track if the accordion item is open to focus textarea
    const [isOpen, setIsOpen] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        setDescription(task.description);
        originalDescription.current = task.description;
        setIsEditing(false);
    }, [task]);

    // Focus textarea when accordion opens (if not already focused)
    React.useEffect(() => {
        if (isOpen && !isEditing && textareaRef.current) {
             // Small delay might be needed for transition
             // setTimeout(() => textareaRef.current?.focus(), 50);
        }
         // Reset editing state if accordion closes
        if (!isOpen) {
            handleDiscardChanges(); // Revert changes if closing without saving
        }
    }, [isOpen]);


    const getStatusVariant = (status: Task["status"]): "default" | "secondary" | "outline" | "destructive" => {
        switch (status) {
            case "Completed": return "default";
            case "In Progress": return "secondary";
            case "Recurring": return "outline";
            case "Queued": return "secondary";
            default: return "secondary";
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent accordion toggle
        console.log("Delete Task:", task.id);
        alert(`Delete task "${task.title}"? (Placeholder)`);
    };

    const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setDescription(event.target.value);
        if (!isEditing) {
            setIsEditing(true);
        }
    };

    const handleSaveChanges = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent accordion toggle if clicking button inside
        console.log("Saving Task:", task.id, "New Description:", description);
        alert(`Save changes for "${task.title}"? (Placeholder)`);
        originalDescription.current = description;
        setIsEditing(false);
    };

    const handleDiscardChanges = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setDescription(originalDescription.current);
        setIsEditing(false);
    };

    // Prevent accordion toggle when clicking inside the textarea
    const handleTextareaClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
       e.stopPropagation();
    }

    return (
        <AccordionItem value={task.id} className="border-b">
            <AccordionTrigger
                className={cn(
                    "p-3 hover:bg-muted/50 hover:no-underline group",
                    "[&>svg]:hidden"
                )}
                onChange={(state) => setIsOpen(state.currentTarget.value === 'open')}                 
            >
                 {/* Top Row: Title, Status, Actions */}
                 <div className="flex items-center justify-between w-full gap-4">
                     {/* Left: Title + Chevron (optional) */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Option 2: Add Chevron manually if default is hidden */}
                        {/* <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} /> */}
                        <span className="font-medium text-sm truncate">{task.title}</span>
                    </div>

                    {/* Middle: Status */}
                    <div className="flex-shrink-0 mx-4"> {/* Add margin */}
                        <Badge variant={getStatusVariant(task.status)}>
                            {task.status}
                        </Badge>
                    </div>

                    {/* Right: Delete Action Button */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                         <ActionButton
                            tooltip="Delete task"
                            icon={<Trash2 className="h-4 w-4" />}
                            onClick={handleDeleteClick}
                            size="sm"
                            variant="warning"
                        />
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0"> {/* Padding adjusted */}
                {/* Relative container for positioning buttons */}
                <div className='relative'>
                     <Textarea
                        ref={textareaRef}
                        value={description}
                        onChange={handleDescriptionChange}
                        onClick={handleTextareaClick}
                        placeholder="Task description..."
                        className={cn(
                            "text-sm text-muted-foreground focus-visible:ring-1 resize-none w-full min-h-[80px]",
                            isEditing ? "border-primary focus-visible:ring-primary/50" : "border-transparent bg-transparent focus-visible:bg-background focus-visible:border-input focus-visible:ring-input"
                        )}
                        rows={3}
                    />
                    {/* Save/Discard Buttons - Positioned within the content area */}
                    {isEditing && (
                         <div className="flex justify-end gap-2 mt-2 pr-1">
                            <ActionButton
                                tooltip="Save Changes"
                                icon={<Save className="h-4 w-4 text-green-600" />}
                                onClick={handleSaveChanges}
                                size="sm"
                                className="hover:bg-green-100"
                                variant="ghost"
                             />
                             <ActionButton
                                tooltip="Discard Changes"
                                icon={<Undo2 className="h-4 w-4 text-amber-600" />}
                                onClick={handleDiscardChanges}
                                size="sm"
                                className="hover:bg-amber-100"
                                variant="ghost"
                            />
                        </div>
                     )}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}