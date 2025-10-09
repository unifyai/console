import * as React from 'react';
import { Mail, Phone, PenLine, Check } from "lucide-react";
import { SiGooglemeet } from "react-icons/si";
import { BiLogoMicrosoftTeams, BiLogoZoom } from "react-icons/bi";
import { WhatsApp } from '@mui/icons-material';
import type { Assistant } from '@/types/assistants/assistant';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/UI/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/UI/tooltip";
import Markdown from 'react-markdown';
import { AssistantPhotoViewer } from '../Hire/AssistantHirePhotoPreview';
import { Skeleton } from "@/components/UI/skeleton";
import { toast } from "sonner";
import { ScrollArea } from '@/components/UI/scroll-area';

interface AssistantProfileInfoPanelProps {
    assistant: Assistant;
    onOpenPhoneEditDialog: (assistant: Assistant) => void;
    onOpenEmailEditDialog: (assistant: Assistant) => void;
}

const ContactItem: React.FC<{ 
    value: string; 
    icon: React.ReactNode;
    tooltip: string; 
    isCopyable?: boolean, 
    handleClick?: () => void, 
    textClassName?: string
}> = ({ 
    value, 
    icon,
    tooltip,
    isCopyable = false, 
    handleClick,
    textClassName
}) => {
    const [isCopied, setIsCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const onClick = () => {
        isCopyable && handleCopy();
        handleClick && handleClick();
    }

    return (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="grid grid-cols-[auto_1fr] items-center gap-2 cursor-pointer" onClick={onClick}>
                        <div className="flex-shrink-0">
                            {isCopyable && isCopied ? <Check className="h-4 w-4 text-green-500" /> : icon}
                        </div>
                        <span className={`truncate min-w-0 text-caption ${textClassName}`}>{value || '-'}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export function AssistantProfileInfoPanel({ assistant, onOpenPhoneEditDialog, onOpenEmailEditDialog }: AssistantProfileInfoPanelProps) {
    const [isVideoPopoverOpen, setIsVideoPopoverOpen] = React.useState(false);
    const [isVideoLoading, setIsVideoLoading] = React.useState(false);
    const videoLoadTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const scrollAreaRef = React.useRef<HTMLDivElement>(null);
    
    const photoSrc = assistant.signedProfilePhotoUrl || (assistant.profile_photo ?? undefined);
    const videoSrc = assistant.signedProfileVideoUrl || (assistant.profile_video ?? undefined);

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
        <div className="h-full flex flex-col w-full bg-background">
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                {/* Profile Info Section */}
                <div className="flex items-start gap-4">

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

                    <div className="grid grid-cols-2 gap-y-1 py-0.5 flex-1">
                        <span className="text-caption">First Name</span>
                        <span className="text-body">{assistant.first_name}</span>
                        <span className="text-caption">Last Name</span>
                        <span className="text-body">{assistant.surname}</span>
                        <span className="text-caption">Age</span>
                        <span className="text-body">{assistant.age ?? 'N/A'}</span>
                        <span className="text-caption">Region</span>
                        <span className="text-body">{assistant.region ?? 'N/A'}</span>
                    </div>
                    
                </div>

                {/* About Section */}
                <div className="pt-4 group/assistant-about">
                    <h3 className="text-title">About Me</h3>
                    <div className="text-caption prose max-w-none prose-p:my-1">
                        <Markdown>{assistant.about || "No description provided."}</Markdown>
                    </div>
                </div>

                {/* Contacts Section */}
                <div className="pt-4 group/assistant-contact">
                    <h3 className="text-title">My Contact</h3>
                    <div className="grid grid-flow-col grid-rows-3 auto-cols-fr gap-2 my-1 text-caption">
                        {assistant.email ? (
                            <ContactItem value={assistant.email} tooltip="Copy Email" icon={<Mail className="h-4 w-4 flex-shrink-0"/>} isCopyable/>
                        ) : (
                            <ContactItem value={"Add Email"} tooltip="Add Email Address" icon={<Mail className="h-4 w-4 flex-shrink-0"/>} handleClick={() => onOpenEmailEditDialog(assistant)}/>
                        )}
                        {assistant.phone ? (
                            <ContactItem value={assistant.phone} tooltip="Copy Phone" icon={<Phone className="h-4 w-4 flex-shrink-0"/>} isCopyable/>
                        ) : (
                            <ContactItem value={"Add Number"} tooltip="Add Phone Number" icon={<Phone className="h-4 w-4 flex-shrink-0"/>} handleClick={() => onOpenPhoneEditDialog(assistant)}/>
                        )}

                        {assistant.assistant_whatsapp_number ? (
                            <ContactItem value={assistant.assistant_whatsapp_number} tooltip="Copy WhatsApp" icon={<WhatsApp className="h-4 w-4 flex-shrink-0"/>} isCopyable/>
                        ) : (
                            <div/>
                        )}
                        <ContactItem value={"Start Meet"} tooltip={`Schedule a Google Meet meeting and invite ${assistant.first_name}`} icon={<SiGooglemeet className="h-4 w-4 flex-shrink-0"/>} handleClick={handleStartMeet} textClassName="underline"/>
                        <ContactItem value={"Coming Soon"} tooltip={`Schedule a Microsoft Teams meeting and invite ${assistant.first_name}`} icon={<BiLogoMicrosoftTeams className="h-4 w-4 flex-shrink-0"/>}/>
                        <ContactItem value={"Coming Soon"} tooltip={`Schedule a Zoom meeting and invite ${assistant.first_name}`} icon={<BiLogoZoom className="h-4 w-4 flex-shrink-0"/>}/>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
