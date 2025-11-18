import * as React from 'react';
import { Mail, Phone, PenLine, Check, Info, Clock } from "lucide-react";
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
import { getTimezoneOffsetInMinutes, formatOffset } from '@/utils/assistants/timezone-utils';
import { Button } from '@/components/UI/button';

interface AssistantProfileInfoPanelProps {
    assistant: Assistant;
    userTimezone?: string | null;
    onEdit: () => void;
}

export function AssistantProfileInfoPanel({ assistant, userTimezone, onEdit }: AssistantProfileInfoPanelProps) {
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

    const timezoneInfo = React.useMemo(() => {
        if (!assistant.timezone) return { friendlyName: 'Not set', relativeOffsetString: null };
        
        const assistantOffset = getTimezoneOffsetInMinutes(assistant.timezone);
        const localTimezone = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localOffset = getTimezoneOffsetInMinutes(localTimezone);
        
        const offsetDiffHours = (assistantOffset - localOffset) / 60;
        
        let relativeOffsetString: string | null = null;
        relativeOffsetString = `${offsetDiffHours >= 0 ? '+' : ''}${offsetDiffHours}H`;

        const assistantUtcOffset = formatOffset(assistantOffset);
        const friendlyName = `UTC${assistantUtcOffset} ${assistant.timezone.split('/').pop()?.replace(/_/g, ' ')}`;

        return { friendlyName, relativeOffsetString };
    }, [assistant.timezone, userTimezone]);

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

                    <div className="grid grid-cols-2 gap-y-0.5 py-0.5 flex-1 max-w-xs">
                        <span className="text-caption font-bold">First Name</span>
                        <span className="text-caption cursor-[var(--pen-cursor)]" onClick={onEdit}>{assistant.first_name}</span>
                        <span className="text-caption font-bold">Last Name</span>
                        <span className="text-caption cursor-[var(--pen-cursor)]" onClick={onEdit}>{assistant.surname}</span>
                        <span className="text-caption font-bold">Age</span>
                        <span className="text-caption cursor-[var(--pen-cursor)]" onClick={onEdit}>{assistant.age ?? 'N/A'}</span>
                        <span className="text-caption font-bold">Nationality</span>
                        <span className="text-caption cursor-[var(--pen-cursor)]" onClick={onEdit}>{assistant.nationality ?? 'N/A'}</span>
                    </div>
                </div>
                
                {/* Timezone Section */}
                <div className="pt-4 group/assistant-timezone">
                    <h3 className="text-title">Timezone</h3>
                    <div className="grid grid-cols-2 items-center max-w-sm">
                        <span className="text-caption cursor-[var(--pen-cursor)]" onClick={onEdit}>{timezoneInfo.friendlyName}</span>
                        {timezoneInfo.relativeOffsetString && (
                            <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-auto px-2 py-1 mr-3 text-xs gap-1" onClick={() => window.open('/profile', '_blank', 'noopener,noreferrer')}>
                                            {timezoneInfo.relativeOffsetString}
                                            <Clock className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Assistant&apos;s time relative to yours</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </div>

                {/* About Section */}
                <div className="pt-4 group/assistant-about">
                    <h3 className="text-title">About Me</h3>
                    <div className="text-caption prose max-w-none prose-p:my-1 cursor-[var(--pen-cursor)]" onClick={onEdit}>
                        <Markdown>{assistant.about || "No description provided."}</Markdown>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}