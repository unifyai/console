import * as React from 'react';
import { Badge } from "@/components/UI/badge";
import { Save, Undo2, Loader2, AlertTriangle, CalendarDays, Zap, Minus } from "lucide-react"; 
import { Task, TaskActions, Status as TaskStatusEnum, Priority as TaskPriorityEnum } from "@/types/assistants/task"; 
import { Assistant } from '@/types/assistants/assistant';
import ActionButton from '@/components/Common/Buttons/Action';
import { Textarea } from "@/components/UI/textarea";
import { cn } from '@/lib/utils';
import {
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/UI/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/UI/tooltip"
import { ScrollArea } from '@/components/UI/scroll-area';
import { toast } from 'sonner';

interface TaskListItemProps {
    task: Task;
    assistant: Assistant;
    updateTask: TaskActions['update'];
    onTaskUpdate: (taskId: number, updatedFields: Partial<Task>) => void;
    /** Whether the current user can edit this task (based on assistant write permission) */
    canEditTask?: boolean;
}

export function TaskListItem({ task, assistant, updateTask, onTaskUpdate, canEditTask = true }: TaskListItemProps) {

    const [description, setDescription] = React.useState(task.description);
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [saveError, setSaveError] = React.useState<string | null>(null);
    const originalDescription = React.useRef(task.description);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    React.useEffect(() => {
        if (task.description !== description && !isEditing) {
            setDescription(task.description ?? '');
            originalDescription.current = task.description ?? '';
        }
        if (saveError) setSaveError(null);
    }, [task.taskId, task.description, description, isEditing, saveError]);


    const getStatusVariant = (status: TaskStatusEnum): "default" | "secondary" | "outline" | "destructive" => {
        switch (status) {
           case TaskStatusEnum.completed: return "default"; 
           case TaskStatusEnum.active: return "secondary"; 
           case TaskStatusEnum.queued: return "secondary"; 
           case TaskStatusEnum.scheduled: return "outline"; 
           case TaskStatusEnum.paused: return "outline";
           case TaskStatusEnum.failed: return "destructive"; 
           case TaskStatusEnum.cancelled: return "destructive";
           default: return "secondary";
       }
    };

    const getPriorityDisplay = (priority: TaskPriorityEnum | undefined) => {
        const p = priority || TaskPriorityEnum.normal;
        let icon: React.ReactNode = null;
        let textColor = "text-foreground";

        switch (p) {
            case TaskPriorityEnum.urgent: 
                icon = <Zap className="h-3.5 w-3.5 text-destructive mr-1" />;
                textColor = "text-destructive";
                break;
            case TaskPriorityEnum.high: 
                icon = <AlertTriangle className="h-3.5 w-3.5 text-warning mr-1" />;
                textColor = "text-warning";
                break;
            case TaskPriorityEnum.low: 
                icon = <Minus className="h-3.5 w-3.5 text-muted-foreground mr-1" />;
                textColor = "text-muted-foreground";
                break;
            case TaskPriorityEnum.normal:
                icon = <Minus className="h-3.5 w-3.5 text-primary mr-1" />;
                textColor = "text-primary";
                break;
        }
        return (
            <span className={cn("flex items-center justify-center text-caption capitalize", textColor)}>
                {icon}
                {p}
            </span>
        );
    }

    const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setDescription(event.target.value);
        if (!isEditing) {
            setIsEditing(true);
        }
        setSaveError(null);
    };

    const handleSaveChanges = async (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (isSaving || description === originalDescription.current) return;

        setIsSaving(true);
        setSaveError(null);
        const toastId = toast.loading("Saving description...");

        try {
            const context = `${assistant.firstName}${assistant.surname}`;
            const response = await updateTask(
                context,
                [task.logId],
                { description: description } 
            );

            if (response && (response.message || response.detail)) {
                throw new Error(response.message || response.detail || "Failed to update task description.");
            }

            onTaskUpdate(task.taskId, { description: description });
            originalDescription.current = description; 
            setIsEditing(false);
            toast.success("Description saved.", { id: toastId });

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
            setSaveError(errorMsg); 
            console.error("Failed to save task description:", errorMsg);
            toast.error(`Failed to save task description`, { id: toastId });
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
    
    const formattedDeadline = task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No deadline';
    const fullDeadline = task.deadline ? new Date(task.deadline).toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Not set";


    return (
        <AccordionItem value={String(task.taskId)} className="border-b group px-2"> 
            <AccordionTrigger
                className={cn(
                    "hover:bg-muted/50 hover:no-underline text-left",
                    "p-0",
                    "[&>svg]:hidden" 
                )}
            >
                <div className={cn(
                     "grid w-full items-center gap-x-2 px-3 py-3", // Reduced gap-x for tighter columns
                     "grid-cols-[minmax(0,_1fr)_90px_110px_100px]" // Name | Priority | Deadline | Status
                 )}>
                    <div className="min-w-0 overflow-hidden">
                        <span className="text-body text-strong break-words truncate" title={task.name}>
                            {task.name}
                        </span>
                    </div>

                    <div className="flex items-center justify-center text-center">
                         <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-default truncate">
                                        {getPriorityDisplay(task.priority)}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="capitalize">{task.priority || "Normal"} Priority</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <div className="text-caption text-muted-foreground text-center truncate">
                        <TooltipProvider delayDuration={100}>
                             <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className={cn("flex items-center justify-center gap-1 cursor-default", !task.deadline && "italic")}>
                                        {task.deadline && <CalendarDays className="h-3.5 w-3.5 flex-shrink-0"/>}
                                        {formattedDeadline}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Deadline: {fullDeadline}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <div className="text-center">
                        <Badge variant={getStatusVariant(task.status)} className="whitespace-nowrap capitalize">
                            {task.status}
                        </Badge>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent
                className="p-4 pt-0 bg-muted/10 relative" 
                onClick={handleContentInteraction}
            >
                 <div className='relative group/desc'>
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
                            disabled={isSaving || !canEditTask}
                            readOnly={!canEditTask}
                            className={cn(
                                "text-body text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 resize-none w-full block",
                                "!border-0 !outline-none !ring-0 !shadow-none p-2",
                                "min-h-[80px]", 
                                isEditing ? "bg-background" : "bg-transparent",
                                !canEditTask && "cursor-default"
                            )}
                            rows={Math.max(3, description?.split('\n').length ?? 1)}
                        />
                    </ScrollArea>
                     {canEditTask && (isEditing || isSaving) && (
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
                    {saveError && (
                         <p className="text-caption text-destructive mt-1 px-1 absolute -bottom-5 left-1">
                             Error: {saveError}
                         </p>
                     )}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}