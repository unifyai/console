import * as React from 'react';
import { Badge } from "@/components/UI/badge";
import { Trash2, Save, Undo2, Calendar } from "lucide-react";
import type { Task } from "@/types/team/task";
import type { Assistant } from "@/types/team/assistant"; // Import Assistant type
import ActionButton from '../Common/Buttons/Action';
import { Textarea } from "@/components/UI/textarea";
import { cn } from '@/lib/utils';
import {
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/UI/accordion";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar'; // Import Avatar
import { format } from 'date-fns'; // For formatting date
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/UI/tooltip" // Import Tooltip


interface TaskListItemProps {
    task: Task;
    allAssistants: Assistant[]; // Receive all assistants for lookup
}

export function TaskListItem({ task, allAssistants }: TaskListItemProps) {

    const [description, setDescription] = React.useState(task.description);
    const [isEditing, setIsEditing] = React.useState(false);
    const originalDescription = React.useRef(task.description);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        setDescription(task.description);
        originalDescription.current = task.description;
        setIsEditing(false);
    }, [task]);

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

    const getAssistantById = (id: string): Assistant | undefined => {
        return allAssistants.find(a => a.id === id);
    }

    return (
        <AccordionItem value={task.id} className="border-b group px-2"> {/* Added group */}
            <AccordionTrigger
                className={cn(
                    "hover:bg-muted/50 hover:no-underline text-left", // Added text-left for trigger overall
                    "p-0",
                    "[&>svg]:hidden"
                )}
            >
                {/* Use Grid for layout - Define columns here */}
                <div className={cn(
                     "grid w-full items-center gap-x-4 px-3 py-3",
                     // Define column templates. Adjust widths as needed.
                     // Example: Title (flexible), Status(auto), Assigned(fixed?), DueDate(auto), Actions(fixed)
                     "grid-cols-[minmax(0,_1fr)_auto_100px_100px_auto]" // Adjust px values for Assigned/Due
                 )}>
                    {/* Column 1: Task Title */}
                    <div className="min-w-0 overflow-hidden">
                        <span className="font-medium text-sm break-words truncate">
                            {task.title}
                        </span>
                    </div>

                    {/* Column 2: Status */}
                    {/* Width 'auto', content centered */}
                    <div className="text-center">
                        <Badge variant={getStatusVariant(task.status)} className="whitespace-nowrap">
                            {task.status}
                        </Badge>
                    </div>

                    {/* Column 3: Assigned Avatars */}
                    {/* Width set by grid-cols, content centered */}
                    <div className="flex items-center justify-center -space-x-2 overflow-hidden">
                         {task.assignedAssistantIds.length > 0 ? (
                            <TooltipProvider delayDuration={100}>
                                {task.assignedAssistantIds.slice(0, 3).map(id => { // Reduced max visible avatars slightly
                                    const assistant = getAssistantById(id);
                                    const name = assistant ? `${assistant.firstName} ${assistant.lastName}` : 'Unknown';
                                    const fallback = assistant ? `${assistant.firstName?.[0] ?? ''}${assistant.lastName?.[0] ?? ''}`.toUpperCase() : '??';
                                    return (
                                         <Tooltip key={id}>
                                            <TooltipTrigger asChild>
                                                <Avatar className="h-6 w-6 border-2 border-background cursor-default">
                                                    <AvatarImage src={assistant?.avatarUrl} alt={name} />
                                                    <AvatarFallback className="text-xs">{fallback}</AvatarFallback>
                                                </Avatar>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{name}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                                {task.assignedAssistantIds.length > 3 && (
                                     <Avatar className="h-6 w-6 border-2 border-background bg-muted text-muted-foreground">
                                         <AvatarFallback className="text-xs">+{task.assignedAssistantIds.length - 3}</AvatarFallback>
                                     </Avatar>
                                )}
                             </TooltipProvider>
                         ) : (
                             <span className="text-xs text-muted-foreground">Unassigned</span>
                         )}
                    </div>

                    {/* Column 4: Due Date */}
                    {/* Width set by grid-cols, content right-aligned */}
                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                         {task.dueDate ? (
                             <span className="flex items-center justify-end gap-1">
                                 <Calendar className="h-3 w-3 flex-shrink-0" />
                                 {format(task.dueDate, 'MM/dd/yyyy')}
                             </span>
                         ) : (
                             <span>-</span>
                         )}
                     </div>

                </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0 bg-muted/10"> {/* Subtle background */}
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