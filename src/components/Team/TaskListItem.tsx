import * as React from 'react';
import { Badge } from "@/components/UI/badge";
import { Save, Undo2, Loader2 } from "lucide-react";
import type { Task, TaskActions } from "@/types/assistants/task";
import type { Assistant } from "@/types/assistants/assistant";
import ActionButton from '../Common/Buttons/Action';
import { Textarea } from "@/components/UI/textarea";
import { cn } from '@/lib/utils';
import {
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/UI/accordion";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/UI/tooltip"
import { ScrollArea } from '@/components/UI/scroll-area';


interface TaskListItemProps {
    task: Task;
    assistantMap: Map<string, Assistant>;
    updateTask: TaskActions['update'];
}

export function TaskListItem({ task, assistantMap, updateTask }: TaskListItemProps) {

    const [description, setDescription] = React.useState(task.description);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [saveError, setSaveError] = React.useState<string | null>(null);
    const originalDescription = React.useRef(task.description);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Reset state if the task prop itself changes (e.g., due to parent re-render with new data)
    React.useEffect(() => {
        if (task.description !== description && !isEditing) {
            setDescription(task.description);
            originalDescription.current = task.description;
        }
        // Reset error when task changes
        setSaveError(null);
    }, [task, description, isEditing]);

    const getStatusVariant = (status: Task["status"]): "default" | "secondary" | "outline" | "destructive" => {
        switch (status) {
           case "Completed": return "default";
           case "In Progress": return "secondary";
           case "Recurring": return "outline";
           case "Queued": return "secondary";
           case "Review": return "destructive";
           default: return "secondary";
       }
    };

    const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setDescription(event.target.value);
        if (!isEditing) {
            setIsEditing(true);
        }
        setSaveError(null);
    };

    const handleSaveChanges = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent accordion toggle
        if (isSaving || description === originalDescription.current) return;

        setIsSaving(true);
        setSaveError(null);

        try {
            // Convert taskId string to number as expected by the backend action
            const taskIdNumber = parseInt(task.taskId, 10);
            if (isNaN(taskIdNumber)) {
                 throw new Error("Invalid Task ID format.");
            }

            // Call the updateTask action passed via props
            const response = await updateTask(
                [taskIdNumber],
                { description: description }
            );

            if (!response.info) {
                // Throw error if backend indicates failure
                throw new Error(response.message || "Failed to update task description.");
            }

            // Success
            originalDescription.current = description;
            setIsEditing(false);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to save task description:", errorMsg);
            setSaveError(errorMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscardChanges = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setDescription(originalDescription.current);
        setIsEditing(false);
        setSaveError(null);
    };

    // Prevent accordion toggle when clicking inside the textarea wrapper or buttons
    const handleContentInteraction = (e: React.MouseEvent) => {
       e.stopPropagation();
    }

    // Get assistant data from the map (includes potential signed URL)
    const getAssistantById = (id: string): Assistant | undefined => {
        return assistantMap.get(id);
    }

    // Helper to get assistant avatar URL safely (prefer signed URL)
    const getAssistantAvatarUrl = (id: string): string | undefined => {
        const assistant = getAssistantById(id);
        return assistant?.signedProfilePhotoUrl || assistant?.profile_photo;
    }

    return (
        // AccordionItem provides the boundary for each task
        <AccordionItem value={task.taskId} className="border-b group px-2">
            <AccordionTrigger
                className={cn(
                    "hover:bg-muted/50 hover:no-underline text-left",
                    "p-0", // Remove default padding from trigger
                    "[&>svg]:hidden" // Hide default chevron, handle expansion state visually if needed
                )}
            >
                {/* Grid for layout within the trigger */}
                <div className={cn(
                     "grid w-full items-center gap-x-4 px-3 py-3",
                     "grid-cols-[minmax(0,_1fr)_auto_100px]" // Title (flex), Status (auto), Assigned (fixed)
                 )}>
                    {/* Column 1: Task Title */}
                    <div className="min-w-0 overflow-hidden">
                        <span className="font-medium text-sm break-words truncate" title={task.title}>
                            {task.title}
                        </span>
                    </div>

                    {/* Column 2: Status */}
                    <div className="text-center">
                        <Badge variant={getStatusVariant(task.status)} className="whitespace-nowrap">
                            {task.status}
                        </Badge>
                    </div>

                    {/* Column 3: Assigned Avatars */}
                    <div className="flex items-center justify-center -space-x-2 overflow-hidden">
                         {task.assignedAssistantIds.length > 0 ? (
                            <TooltipProvider delayDuration={100}>
                                {task.assignedAssistantIds.slice(0, 3).map(id => {
                                    const assistant = getAssistantById(id);
                                    const name = assistant ? `${assistant.first_name} ${assistant.surname}` : 'Unknown';
                                    const fallback = assistant ? `${assistant.first_name?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase() : '??';
                                    const avatarUrl = getAssistantAvatarUrl(id);
                                    return (
                                         <Tooltip key={id}>
                                            <TooltipTrigger asChild>
                                                <Avatar className="h-6 w-6 border-2 border-background cursor-default">
                                                    <AvatarImage src={avatarUrl} alt={name} />
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
                                     <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Avatar className="h-6 w-6 border-2 border-background bg-muted text-muted-foreground cursor-default">
                                                <AvatarFallback className="text-xs">+{task.assignedAssistantIds.length - 3}</AvatarFallback>
                                            </Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{task.assignedAssistantIds.length} assigned</p>
                                        </TooltipContent>
                                     </Tooltip>
                                )}
                             </TooltipProvider>
                         ) : (
                             <span className="text-xs text-muted-foreground">Unassigned</span>
                         )}
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent
                className="p-4 pt-0 bg-muted/10"
                onClick={handleContentInteraction}
            >
                 <div className='relative group/desc'>
                     {/* ScrollArea wraps Textarea for description scrolling */}
                     <ScrollArea
                         className={cn(
                             "w-full rounded-md border transition-colors",
                             saveError ? "border-destructive" :
                             isEditing ? "border-primary" : "border-transparent group-hover/desc:border-input focus-within:border-input"
                         )}
                         style={{ maxHeight: '200px' }}
                     >
                        <Textarea
                            ref={textareaRef}
                            value={description}
                            onChange={handleDescriptionChange}
                            placeholder="Task description..."
                            disabled={isSaving}
                            className={cn(
                                "text-sm text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 resize-none w-full block",
                                "!border-0 !outline-none !ring-0 !shadow-none p-2",
                                "min-h-[160px]",
                                isEditing ? "bg-background" : "bg-transparent"
                            )}
                        />
                    </ScrollArea>
                    {/* Save/Discard Buttons */}
                     {(isEditing || isSaving) && (
                        // Position save/discard buttons relative to the wrapper div
                        <div className="absolute bottom-2 right-2 flex justify-end gap-1 opacity-0 group-hover/desc:opacity-100 focus-within:opacity-100 transition-opacity z-10">
                            <ActionButton
                                tooltip="Save changes"
                                icon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-green-600" />}
                                onClick={handleSaveChanges}
                                disabled={isSaving || description === originalDescription.current}
                                size="sm"
                                className={cn(
                                    "bg-background/80 backdrop-blur-sm rounded p-1",
                                    !isSaving && description !== originalDescription.current && "hover:bg-green-100"
                                )}
                                variant="ghost"
                             />
                             <ActionButton
                                tooltip="Discard changes"
                                icon={<Undo2 className="h-4 w-4 text-amber-600" />}
                                onClick={handleDiscardChanges}
                                disabled={isSaving}
                                size="sm"
                                className="hover:bg-amber-100 bg-background/80 backdrop-blur-sm rounded p-1"
                                variant="ghost"
                            />
                        </div>
                     )}
                     {/* Error Message Display */}
                    {saveError && (
                         <p className="text-xs text-destructive mt-1 px-1 absolute -bottom-5 left-1">
                             Error: {saveError}
                         </p>
                     )}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}