import * as React from 'react';
import { Input } from "@/components/UI/input";
import { ScrollArea } from "@/components/UI/scroll-area";
import { Search, WifiOff, UserPlus, Menu, PanelLeft, PanelLeftClose } from "lucide-react";
import type { Assistant, AssistantStatus } from "@/types/assistants/assistant";
import { AssistantListItem } from "./AssistantListItem";
import { AssistantListItemSkeleton } from './AssistantListItemSkeleton';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { cn } from '@/lib/utils';

interface AssistantListProps {
    assistants: Assistant[];
    assistantStatuses: Map<string, AssistantStatus | null>;
    assistantError: string | null;
    isLoading: boolean;
    error: string | null;
    profileAssistantId: string | null;
    activityLogAssistantId: string | null;
    onShowProfile: (id: string) => void;
    onShowActivityLog: (id: string) => void;
    onOpenHireDialog: () => void;
    isFolded: boolean;
    onToggleFold: () => void;
}

export function AssistantList({
    assistants,
    assistantStatuses,
    assistantError,
    isLoading,
    error,
    profileAssistantId,
    activityLogAssistantId,
    onShowProfile,
    onShowActivityLog,
    onOpenHireDialog,
    isFolded,
    onToggleFold,
}: AssistantListProps) {

    const [searchTerm, setSearchTerm] = React.useState('');

    const filteredAssistants = React.useMemo(() => {
         if (!searchTerm) return assistants;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return assistants.filter(a =>
            (a.first_name && a.surname && `${a.first_name} ${a.surname}`.toLowerCase().includes(lowerSearchTerm)) ||
            (a.email && a.email.toLowerCase().includes(lowerSearchTerm))
        );
    }, [assistants, searchTerm]);

    const canHireNewAssistant = !assistantError && assistants.length < 2;
    const isHireButtonDisabled = isLoading || !canHireNewAssistant;

    return (
        <div className="flex flex-col h-full bg-background relative">

            {/* Header: Search Bar + New Assistant Button */}
            <div className="p-3 border-b flex-shrink-0">
                {isFolded ? (
                     <div className="flex items-center justify-center">
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={onOpenHireDialog}
                                        disabled={isHireButtonDisabled}
                                        aria-disabled={isHireButtonDisabled}
                                    >
                                        <UserPlus className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                 <TooltipContent side="right">
                                    <p>Hire new assistant</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                     </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search assistants..."
                                className="pl-8 w-full h-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                disabled={isLoading || !!error}
                            />
                        </div>
                        <TooltipProvider delayDuration={100}>
                            <Tooltip open={!canHireNewAssistant && !isLoading ? undefined : false}> {/* Conditionally control open state for tooltip */}
                                <TooltipTrigger asChild>
                                    {/* The button itself needs to be wrapped or be a direct child for TooltipTrigger to work correctly when disabled */}
                                    <span tabIndex={isHireButtonDisabled ? 0 : -1}> 
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 items-center"
                                            onClick={onOpenHireDialog}
                                            disabled={isHireButtonDisabled}
                                            aria-disabled={isHireButtonDisabled}
                                        >
                                            <UserPlus className="h-4 w-4" />
                                            New
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                {!canHireNewAssistant && !isLoading && (
                                    <TooltipContent side="bottom" align="end">
                                        <p>More assistant hires available soon</p>
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}
            </div>

            {/* Content Area: Loading Skeletons, Error, or List */}
            <ScrollArea className="flex-1 p-2">
                <div className={cn(
                    "space-y-1 pt-2",
                    isFolded && "flex flex-col items-center space-y-3"
                )}>
                    {isLoading ? (
                        <>
                            {[...Array(10)].map((_, i) => (
                                <AssistantListItemSkeleton key={`asst-skeleton-${i}`} isFolded={isFolded} />
                            ))}
                        </>
                    ) : error ? (
                         <div className="flex flex-col items-center justify-center pt-10 text-center">
                             <WifiOff className="h-6 w-6 text-muted-foreground mb-2" />
                             {!isFolded && <p className="text-sm text-muted-foreground">Could not load assistants.</p>}
                         </div>
                    ) : filteredAssistants.length > 0 ? (
                        filteredAssistants.map((assistant) => (
                            <AssistantListItem
                                key={assistant.agent_id}
                                assistant={assistant}
                                status={assistantStatuses.get(assistant.agent_id)}
                                isSelected={profileAssistantId === assistant.agent_id || activityLogAssistantId === assistant.agent_id} // Highlight if selected for profile OR activity
                                onShowProfile={onShowProfile}
                                onShowActivityLog={onShowActivityLog}
                                isFolded={isFolded}
                            />
                        ))
                    ) : searchTerm && !isFolded ? (
                         <p className="p-4 text-sm text-muted-foreground text-center">No assistants match filters.</p>
                    ) : !isFolded ? (
                         <p className="p-4 text-sm text-muted-foreground text-center">No assistants found.</p>
                    ) : null}
                </div>
            </ScrollArea>

             {/* Fold/Unfold Button */}
            <div className={cn(
                "absolute bottom-4 z-10",
                isFolded ? "left-1/2 -translate-x-1/2" : "right-2"
            )}>
                 <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost"
                                size="icon"
                                onClick={onToggleFold}
                                className="hover:bg-primary hover:text-primary-foreground relative w-8 h-8"
                            >
                                {isFolded ? (
                                    <PanelLeft className="h-4 w-4" />
                                ) : (
                                    <PanelLeftClose className="h-4 w-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>{isFolded ? 'Unfold List' : 'Fold List'}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}