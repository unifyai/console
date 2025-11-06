import * as React from 'react';
import { Button } from "@/components/UI/button";
import { Trash2, Loader2, AlertTriangle, PenLine, User, MessageSquare, Maximize2, Minus, ChevronRight, Briefcase, Contact, Phone } from "lucide-react";
import type { Assistant, AssistantActions } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/UI/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/UI/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/UI/accordion";
import { ChatMessage } from '@/types/assistants/chat';
import { AssistantProfileInfoPanel } from './AssistantProfileInfoPanel';
import { AssistantProfileChatPanel } from './AssistantProfileChatPanel';
import { AssistantResourcesManager } from './AssistantResourcesManager';

interface AssistantProfilePanelProps {
    assistant: Assistant;
    assistantActions: AssistantActions;
    onClose: () => void;
    onDeleteAssistant: (assistant: Assistant) => Promise<void>;
    onEdit: (assistant: Assistant) => void;
    onOpenContactManager: (assistant: Assistant) => void;
    chatHistories: Record<string, ChatMessage[]>;
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
    isFirstView?: boolean;
    preHireChat?: ChatMessage[];
    onFirstViewCompleted?: () => void;
    onStartCall: (assistant: Assistant) => void;
    activeCallAssistantId: string | null;
    isCallConnected: boolean;
    isConnectingCall: boolean;
}

const AccordionTriggerWithButtons = React.forwardRef<
    React.ElementRef<typeof AccordionTrigger>,
    React.ComponentPropsWithoutRef<typeof AccordionTrigger> & {
        buttonSlot?: React.ReactNode;
    }
>(({ children, buttonSlot, ...props }, ref) => (
    <AccordionTrigger
        ref={ref}
        {...props}
        className="hover:no-underline py-3.5 border-b"
        hideChevron // Hide the primitive's default chevron
    >
        <div className="flex items-center justify-between w-full px-4">
            <div className="flex items-center gap-2">
                <div className="flex-grow text-left text-title">{children}</div>
                <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
            </div>
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                {buttonSlot}
            </div>
        </div>
    </AccordionTrigger>
));
AccordionTriggerWithButtons.displayName = AccordionTrigger.displayName;

export function AssistantProfilePanel({
    assistant,
    assistantActions,
    onClose,
    onDeleteAssistant,
    onEdit,
    onOpenContactManager,
    chatHistories,
    setChatHistories,
    isFirstView,
    preHireChat,
    onFirstViewCompleted,
    onStartCall,
    activeCallAssistantId,
    isCallConnected,
    isConnectingCall,
}: AssistantProfilePanelProps) {
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isAlertOpen, setIsAlertOpen] = React.useState(false);
    const [isChatMaximized, setIsChatMaximized] = React.useState(false);

    const isInThisCall = activeCallAssistantId === assistant.agent_id;
    const isAnotherCallActive = activeCallAssistantId !== null && !isInThisCall;
    const isCallButtonDisabled = isAnotherCallActive;

    const callButtonTooltip = 
        isInThisCall && isConnectingCall ? "Connecting call..." :
        isInThisCall ? "Return to call" :
        isAnotherCallActive ? "Another call is in progress" :
        "Start a call";

    const handleCallButtonClick = () => {
        if (!isCallButtonDisabled) {
            onStartCall(assistant);
        }
    };
    
    const displayName = `${assistant.first_name} ${assistant.surname}`;

    const handleDeleteConfirm = async () => {
        if (!assistant || isDeleting) return;

        setIsDeleting(true);
        try {
            await onDeleteAssistant(assistant);
            setIsAlertOpen(false);
        } catch (error) {
             console.error("Error occurred during delete confirmation (handled by parent):", error);
             setIsAlertOpen(false);
        } finally {
             setIsDeleting(false);
        }
    };

    if (!assistant) return null;

    return (
        <>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <div className="h-full flex flex-col w-full bg-background">
                    
                    <Accordion type="multiple" defaultValue={["profile", "resources", "chat"]} className="w-full flex-1 flex flex-col min-h-0">
                        {/* Profile Section */}
                        <AccordionItem value="profile">
                            <AccordionTriggerWithButtons
                                className="text-title"
                                buttonSlot={
                                    <TooltipProvider delayDuration={100}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(assistant)}>
                                                    <PenLine className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p>Edit Assistant</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                }
                            >
                                <div className='flex gap-2 items-center text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors duration-200'>
                                    <User className="h-4 w-4" />
                                    <span className="text-body">{`${assistant.first_name}'s Profile`}</span>
                                </div>
                            </AccordionTriggerWithButtons>
                            <AccordionContent
                                outerClassName="data-[state=open]:flex flex-1 min-h-0 max-h-[40vh] p-0"
                                className="p-0 flex-1 min-h-0 flex"
                            >
                                <AssistantProfileInfoPanel 
                                    assistant={assistant} 
                                />
                            </AccordionContent>
                        </AccordionItem>

                        {/* Manage Resources Section */}
                        <AccordionItem value="resources">
                             <AccordionTriggerWithButtons
                                className="text-title"
                            >
                                <div className='flex gap-2 items-center text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors duration-200'>
                                    <Briefcase className="h-4 w-4" />
                                    <span className="text-body">{`Manage ${assistant.first_name}'s resources`}</span>
                                </div>
                            </AccordionTriggerWithButtons>
                            <AccordionContent
                                outerClassName="data-[state=open]:flex flex-col flex-1 min-h-0 p-0"
                                className="p-4 flex-1 min-h-0"
                            >
                                <AssistantResourcesManager 
                                    assistant={assistant} 
                                    assistantActions={assistantActions} 
                                    onOpenContactManager={onOpenContactManager}
                                />
                            </AccordionContent>
                        </AccordionItem>
                        
                        {/* Chat Section */}
                        <AccordionItem value="chat" className="flex-1 flex flex-col min-h-0">
                            <AccordionTriggerWithButtons
                                className="text-title"
                                buttonSlot={
                                    <div className="flex items-center gap-1">
                                        <TooltipProvider delayDuration={100}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={handleCallButtonClick} disabled={isCallButtonDisabled}>
                                                        {(isInThisCall && isConnectingCall) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    <p>{callButtonTooltip}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider delayDuration={100}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsChatMaximized(true)}>
                                                        <Maximize2 className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    <p>Maximize Chat</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                }
                            >
                                <div className='flex gap-2 items-center text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors duration-200'>
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="text-body">Chat with {assistant.first_name}</span>
                                </div>
                            </AccordionTriggerWithButtons>
                             <AccordionContent
                                outerClassName="data-[state=open]:flex flex-1 min-h-0 p-0 data-[state=closed]:hidden"
                                className="p-0 flex-1 min-h-0 flex"
                            >
                                <AssistantProfileChatPanel 
                                    assistant={assistant} 
                                    assistantActions={assistantActions} 
                                    chatHistories={chatHistories}
                                    setChatHistories={setChatHistories}
                                    isFirstView={isFirstView}
                                    preHireChat={preHireChat}
                                    onFirstViewCompleted={onFirstViewCompleted}
                                />
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                    
                    {/* Footer Action Buttons */}
                    <div className="px-4 py-3 sm:px-6 sm:py-4 flex justify-end items-center flex-shrink-0">
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive" size="sm" disabled={isDeleting}>
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                End contract
                            </Button>
                        </AlertDialogTrigger>
                    </div>
                </div>

                {/* Alert Dialog Content */}
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center">
                            <AlertTriangle className="h-5 w-5 text-destructive mr-2" />
                            Confirm End Contract
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to remove <strong>{displayName}</strong> from your team. This action cannot be undone. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                            className={cn(
                                "bg-destructive hover:bg-destructive/90",
                                isDeleting && "cursor-not-allowed opacity-70"
                            )}
                        >
                            {isDeleting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Proceed
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={isChatMaximized} onOpenChange={setIsChatMaximized}>
                <DialogContent className="max-w-6xl h-[80vh] flex flex-col p-0 gap-0" hideClose >
                     <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
                        <div className="flex items-start justify-between">
                            <DialogTitle className="text-title">Chat with {displayName}</DialogTitle>
                            <Button variant="warning" size="icon" className="h-7 w-7 flex-shrink-0 -mt-1" onClick={() => setIsChatMaximized(false)}>
                                <Minus className="h-4 w-4" />
                                <span className="sr-only">Minimize Chat</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 min-h-0">
                        <AssistantProfileChatPanel 
                            assistant={assistant} 
                            assistantActions={assistantActions}
                            chatHistories={chatHistories}
                            setChatHistories={setChatHistories}
                            isFirstView={isFirstView}
                            preHireChat={preHireChat}
                            onFirstViewCompleted={onFirstViewCompleted}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
