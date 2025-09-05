import * as React from 'react';
import { Button } from "@/components/UI/button";
import { Mail, Phone, X, Trash2, Loader2, AlertTriangle, PenLine, User, MessageSquare, Maximize2, Minus, ExternalLink, Check, ChevronRight } from "lucide-react";
import { SiGooglemeet } from "react-icons/si";
import { BiLogoMicrosoftTeams } from "react-icons/bi";
import { BiLogoZoom } from "react-icons/bi";
import { WhatsApp } from '@mui/icons-material';
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
import Markdown from 'react-markdown';
import { AssistantPhotoViewer } from './Hire/AssistantHirePhotoPreview';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/UI/popover";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/UI/accordion";
import { AssistantProfileChatPanel } from './Profile/AssistantProfileChatPanel';
import { ChatMessage } from '@/types/assistants/chat';
import { Skeleton } from "@/components/UI/skeleton";
import { toast } from "sonner";

interface AssistantProfilePanelProps {
    assistant: Assistant;
    assistantActions: AssistantActions;
    onClose: () => void;
    onDeleteAssistant: (assistant: Assistant) => Promise<void>;
    onEdit: (assistant: Assistant) => void;
    onOpenPhoneEditDialog: (assistant: Assistant) => void;
    chatHistories: Record<string, ChatMessage[]>;
    setChatHistories: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
    isFirstView?: boolean;
    preHireChat?: ChatMessage[];
    onFirstViewCompleted?: () => void;
}

const CopyableContact: React.FC<{ value: string; type: 'Email' | 'Phone' | 'WhatsApp'; icon: React.ReactNode }> = ({ value, type, icon }) => {
    const [isCopied, setIsCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer" onClick={handleCopy}>
                        {isCopied ? <Check className="h-4 w-4 text-green-500" /> : icon}
                        <span className="truncate mb-0.5 text-body">{value || 'N/A'}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                    <p>Copy {type}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

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
    onOpenPhoneEditDialog,
    chatHistories,
    setChatHistories,
    isFirstView,
    preHireChat,
    onFirstViewCompleted,
}: AssistantProfilePanelProps) {
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isAlertOpen, setIsAlertOpen] = React.useState(false);
    const [isVideoPopoverOpen, setIsVideoPopoverOpen] = React.useState(false);
    const [isChatMaximized, setIsChatMaximized] = React.useState(false);
    const [isVideoLoading, setIsVideoLoading] = React.useState(false);
    const videoLoadTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const photoSrc = assistant.signedProfilePhotoUrl || (assistant.profile_photo ?? undefined);
    const videoSrc = assistant.signedProfileVideoUrl || (assistant.profile_video ?? undefined);
    const displayName = `${assistant.first_name} ${assistant.surname}`;

    const cleanupVideoTimeout = React.useCallback(() => {
        if (videoLoadTimeoutRef.current) {
            clearTimeout(videoLoadTimeoutRef.current);
            videoLoadTimeoutRef.current = null;
        }
    }, []);

    const handlePopoverOpenChange = (open: boolean) => {
        setIsVideoPopoverOpen(open);
        if (open && videoSrc) {
            setIsVideoLoading(true);
            cleanupVideoTimeout(); // Clear any existing timeout
            // Set a new timeout
            videoLoadTimeoutRef.current = setTimeout(() => {
                setIsVideoLoading(false);
                setIsVideoPopoverOpen(false);
                toast.error("Video preview failed to load in time.");
            }, 5000);
        } else {
            // Cleanup on close
            setIsVideoLoading(false);
            cleanupVideoTimeout();
        }
    };

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

    const handleStartMeet = () => {
        if (!assistant.email) return;

        const now = new Date();
        const startTime = new Date(now.getTime());
        const endTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

        const formatDate = (date: Date) => date.toISOString().replace(/[-:.]/g, '').substring(0, 15) + 'Z';

        const calendarUrl = new URL('https://calendar.google.com/calendar/render');
        calendarUrl.searchParams.append('action', 'TEMPLATE');
        calendarUrl.searchParams.append('text', `Meeting with ${assistant.first_name} ${assistant.surname}`);
        calendarUrl.searchParams.append('dates', `${formatDate(startTime)}/${formatDate(endTime)}`);
        calendarUrl.searchParams.append('add', assistant.email);
        calendarUrl.searchParams.append('details', 'Generated from Assistant Console.');

        window.open(calendarUrl.toString(), '_blank', 'noopener,noreferrer');
    };

    const handleVideoCanPlay = () => {
        cleanupVideoTimeout();
        setIsVideoLoading(false);
    };

    const handleVideoError = () => {
        cleanupVideoTimeout();
        setIsVideoLoading(false);
        setIsVideoPopoverOpen(false);
        toast.error("Video preview failed to load.");
    };

    return (
        <>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <div className="h-full flex flex-col w-full bg-background">
                    
                    <Accordion type="multiple" defaultValue={["profile", "chat"]} className="w-full flex-1 flex flex-col min-h-0">
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
                                <div className='flex gap-2 items-center text-muted-foreground'>
                                    <User className="h-4 w-4" />
                                    <span className="text-body">{`${assistant.first_name}'s Profile`}</span>
                                </div>
                            </AccordionTriggerWithButtons>
                            <AccordionContent>
                                <div className="space-y-6 pt-4 pb-6">
                                    <div className="flex items-start gap-4 sm:gap-6 px-4 sm:px-6">
                                        <Popover open={isVideoPopoverOpen} onOpenChange={handlePopoverOpenChange}>
                                            <PopoverTrigger asChild>
                                                <div className="relative group cursor-pointer flex-shrink-0">
                                                    <AssistantPhotoViewer
                                                        photoUrl={photoSrc}
                                                        className="flex-shrink-0"
                                                        avatarClassName="h-20 w-20 sm:h-20 sm:w-20 group-data-[state=open]:grayscale"
                                                        fallbackText={`${assistant.first_name?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
                                                    />
                                                    {isVideoPopoverOpen && isVideoLoading && (
                                                        <Skeleton className="absolute inset-0 z-10 h-20 w-20 sm:h-20 sm:w-20 rounded-lg" />
                                                    )}
                                                    {videoSrc && <div className="absolute -z-10 top-0 left-0 h-full w-full rounded-lg bg-muted-foreground/20 transform -translate-x-2 -translate-y-2 transition-transform duration-200 ease-in-out group-data-[state=open]:translate-x-0 group-data-[state=open]:translate-y-0" />}
                                                </div>
                                            </PopoverTrigger>
                                            {videoSrc && (
                                                <PopoverContent side="bottom" align="start" sideOffset={-120} alignOffset={-40} className="p-0 border-none bg-transparent w-40 h-40 shadow-none">
                                                    <video
                                                        key={videoSrc}
                                                        src={videoSrc}
                                                        autoPlay
                                                        playsInline
                                                        onEnded={() => handlePopoverOpenChange(false)}
                                                        onCanPlay={handleVideoCanPlay}
                                                        onError={handleVideoError}
                                                        className={cn("w-full h-full rounded-lg shadow-xl object-cover", isVideoLoading && "opacity-0")}
                                                    />
                                                </PopoverContent>
                                            )}
                                        </Popover>
                                        <div className="grid grid-cols-2 gap-x-4 pt-1 text-body flex-1">
                                            <span className="text-caption text-muted-foreground">First Name</span>
                                            <span>{assistant.first_name}</span>
                                            <span className="text-caption text-muted-foreground">Last Name</span>
                                            <span>{assistant.surname}</span>
                                            <span className="text-caption text-muted-foreground">Age</span>
                                            <span>{assistant.age ?? 'N/A'}</span>
                                            <span className="text-caption text-muted-foreground">Region</span>
                                            <span>{assistant.region ?? 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="px-4 sm:px-6 space-y-2 group">
                                        <h3 className="text-title">About Me</h3>
                                        <div className="text-body text-muted-foreground prose max-w-none prose-p:my-1">
                                            <Markdown>{assistant.about || "No description provided."}</Markdown>
                                        </div>
                                    </div>
                                    <div className="px-4 sm:px-6 space-y-3 group/assistant-contact">
                                        <h3 className="text-title">My Contact</h3>
                                        <div className="grid text-caption gap-4 grid-cols-2">
                                            <div className="space-y-2">
                                                {assistant.email && <CopyableContact value={assistant.email} type="Email" icon={<Mail className="h-4 w-4 text-muted-foreground" />} />}                                                
                                                {assistant.phone ? (
                                                    <CopyableContact value={assistant.phone} type="Phone" icon={<Phone className="h-4 w-4 text-muted-foreground" />} />
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-fit items-center flex h-5 px-1 text-caption"
                                                            onClick={() => onOpenPhoneEditDialog(assistant)}
                                                        > 
                                                            Add phone number 
                                                            <PenLine className="h-2 w-2" />
                                                        </Button>
                                                    </div>
                                                )}
                                                {assistant.assistant_whatsapp_number && <CopyableContact value={assistant.assistant_whatsapp_number} type="WhatsApp" icon={<WhatsApp className="h-4 w-4 text-muted-foreground" />} />}
                                            </div>
                                            <div className="space-y-2">
                                                {assistant.email && (
                                                    <div className="flex items-center gap-1">
                                                        <SiGooglemeet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                        <TooltipProvider delayDuration={100}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="link"
                                                                        size="sm"
                                                                        className="w-fit items-center flex h-5 text-caption"
                                                                        onClick={handleStartMeet}
                                                                    >
                                                                        Start Google Meet
                                                                        <ExternalLink className="h-1 w-1"/>
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top"><p>Schedule a Google Meet meeting and invite {assistant.first_name}.</p></TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                )}
                                                {assistant.email && (
                                                    <div className="flex items-center gap-1">
                                                        <BiLogoMicrosoftTeams className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                        <TooltipProvider delayDuration={100}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="link"
                                                                        size="sm"
                                                                        className="w-fit items-center flex h-5 text-caption"
                                                                        onClick={handleStartMeet}
                                                                        disabled
                                                                    >
                                                                        Coming Soon
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top"><p>Schedule a Microsoft Teams meeting and invite {assistant.first_name}.</p></TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                )}
                                                {assistant.email && (
                                                    <div className="flex items-center gap-1">
                                                        <BiLogoZoom className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                        <TooltipProvider delayDuration={100}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="link"
                                                                        size="sm"
                                                                        className="w-fit items-center flex h-5 text-caption"
                                                                        onClick={handleStartMeet}
                                                                        disabled
                                                                    >
                                                                        Coming Soon
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top"><p>Schedule a Zoom meeting and invite {assistant.first_name}.</p></TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        
                        {/* Chat Section */}
                        <AccordionItem value="chat" className="flex-1 flex flex-col min-h-0">
                            <AccordionTriggerWithButtons
                                className="text-title"
                                buttonSlot={
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
                                }
                            >
                                <div className='flex gap-2 items-center text-muted-foreground'>
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="text-body">Chat with {assistant.first_name}</span>
                                </div>
                            </AccordionTriggerWithButtons>
                             <AccordionContent
                                outerClassName="data-[state=open]:flex flex-1 min-h-0 p-0"
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