import * as React from 'react';
import { Badge } from "@/components/UI/badge";
import { Save, Undo2, Loader2 } from "lucide-react";
import type { Task, TaskActions } from "@/types/team/task";
import type { Assistant } from "@/types/team/assistant";
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
import { toast } from 'sonner'; // Import toast


interface TaskListItemProps {
    task: Task;
    assistantMap: Map<string, Assistant>;
    updateTask: TaskActions['update'];
    onTaskUpdate: (taskId: string, updatedFields: Partial<Task>) => void;
}

export function TaskListItem({ task, assistantMap, updateTask, onTaskUpdate }: TaskListItemProps) {

    const [description, setDescription] = React.useState(task.description);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [saveError, setSaveError] = React.useState<string | null>(null);
    const originalDescription = React.useRef(task.description);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Reset state if the task prop changes
    React.useEffect(() => {
        if (task.description !== description && !isEditing) {
            setDescription(task.description ?? '');
            originalDescription.current = task.description ?? '';
        }
        if (saveError) setSaveError(null);
    }, [task.id, task.description, description, isEditing, saveError]);


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
        const toastId = toast.loading("Saving description...");

        try {
            const idNumber = parseInt(task.id, 10);
            if (isNaN(idNumber)) {
                 throw new Error("Invalid Task ID format.");
            }

            const response = await updateTask(
                [idNumber],
                { description: description }
            );

            if (response && (response.message || response.detail)) {
                throw new Error(response.message || response.detail || "Failed to update task description.");
            }

            onTaskUpdate(task.id, { description: description });
            setIsEditing(false);
            toast.success("Description saved.", { id: toastId });

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Failed to save task description:", errorMsg);
            setSaveError(errorMsg); // Set local error state
            toast.error(`Save failed: ${errorMsg}`, { id: toastId });
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

    const handleContentInteraction = (e: React.MouseEvent) => {
       e.stopPropagation();
    }

    const getAssistantById = (id: string): Assistant | undefined => {
        return assistantMap.get(id);
    }

    const getAssistantAvatarUrl = (id: string): string | undefined => {
        const assistant = getAssistantById(id);
        return assistant?.signedProfilePhotoUrl || assistant?.profile_photo;
    }

    return (
        <AccordionItem value={task.id} className="border-b group px-2">
            <AccordionTrigger
                className={cn(
                    "hover:bg-muted/50 hover:no-underline text-left",
                    "p-0",
                    "[&>svg]:hidden"
                )}
            >
                <div className={cn(
                     "grid w-full items-center gap-x-4 px-3 py-3",
                     "grid-cols-[minmax(0,_1fr)_auto_100px]"
                 )}>
                    <div className="min-w-0 overflow-hidden">
                        <span className="font-medium text-sm break-words truncate" title={task.title}>
                            {task.title}
                        </span>
                    </div>
                    <div className="text-center">
                        <Badge variant={getStatusVariant(task.status)} className="whitespace-nowrap">
                            {task.status}
                        </Badge>
                    </div>
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
                className="p-4 pt-0 bg-muted/10 relative" // Added relative positioning for error message
                onClick={handleContentInteraction}
            >
                 <div className='relative group/desc'>
                     <ScrollArea
                         className={cn(
                             "w-full rounded-md border transition-colors",
                             saveError ? "border-destructive" :
                             isEditing ? "border-primary" : "border-transparent group-hover/desc:border-input focus-within:border-input"
                         )}
                         style={{ maxHeight: '200px' }} // Set max height for scroll
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
                                "min-h-[80px]", // Adjusted min-height
                                isEditing ? "bg-background" : "bg-transparent"
                            )}
                             // Calculate rows dynamically or set a fixed reasonable number
                            rows={Math.max(3, description?.split('\n').length ?? 1)}
                        />
                    </ScrollArea>
                     {(isEditing || isSaving) && (
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
                     {/* Error Message Display - Positioned below textarea */}
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