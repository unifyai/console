'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    PhoneOff,
    ScreenShare,
    Computer,
    MessageSquare,
    Settings,
    Captions,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/UI/dropdown-menu";


interface AssistantCommunicationControlsProps {
    isMicOn: boolean;
    micButtonProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
    isCameraOn: boolean;
    cameraButtonProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
    isScreenShareOn: boolean;
    onToggleScreenShare: () => void;
    isScreenShareToggleDisabled?: boolean;
    onHangUp: () => void;
    onToggleChat: () => void;
    onToggleSettings: () => void;
    onToggleTranscriptions: () => void;
    isRemoteControlActive: boolean;
    onToggleRemoteControl: () => void;
    isRemoteControlLoading: boolean;
}

const ControlButton: React.FC<{ tooltip: string; children: React.ReactNode; className?: string; [key: string]: any; }> =
    ({ tooltip, children, className, ...props }) => (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground", className)} {...props}>
                        {children}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );


export function AssistantCommunicationControls({
    isMicOn,
    micButtonProps,
    isCameraOn,
    cameraButtonProps,
    isScreenShareOn,
    onToggleScreenShare,
    isScreenShareToggleDisabled,
    onHangUp,
    onToggleChat,
    onToggleSettings,
    onToggleTranscriptions,
    isRemoteControlActive,
    onToggleRemoteControl,
    isRemoteControlLoading,
}: AssistantCommunicationControlsProps) {
    return (
        <div className="flex-shrink-0 h-20 px-6 flex items-center justify-between bg-background border-t">
            {/* Left Controls */}
            <div className="flex items-center gap-3 w-1/3">
                 <ControlButton tooltip="Hang up" className="bg-destructive/10 hover:bg-destructive/20 text-destructive" onClick={onHangUp}>
                    <PhoneOff className="h-5 w-5" />
                </ControlButton>
                <ControlButton tooltip={isMicOn ? "Mute microphone" : "Unmute microphone"} {...micButtonProps}>
                    {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </ControlButton>
                <ControlButton tooltip={isCameraOn ? "Turn off camera" : "Turn on camera"} {...cameraButtonProps}>
                    {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </ControlButton>
            </div>

            {/* Center Controls */}
            <div className="flex items-center gap-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
                            <ScreenShare className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top">
                        <DropdownMenuItem className="cursor-pointer" onSelect={onToggleScreenShare} disabled={isScreenShareToggleDisabled}>
                           {isScreenShareOn ? 'Stop Sharing Screen' : 'Share Your Screen'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" disabled>Ask Assistant to Share</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <ControlButton
                    tooltip={isRemoteControlActive ? "Stop remote control" : "Take over workspace"}
                    onClick={onToggleRemoteControl}
                    disabled={isRemoteControlLoading}
                    className={cn(isRemoteControlActive && "text-primary bg-primary/10 hover:bg-primary/20")}
                >
                    {isRemoteControlLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Computer className="h-5 w-5" />}
                </ControlButton>
            </div>

            {/* Right Controls */}
            <div className="flex items-center justify-end gap-3 w-1/3">
                 <ControlButton tooltip="Toggle chat" onClick={onToggleChat}>
                    <MessageSquare className="h-5 w-5" />
                </ControlButton>
                 <ControlButton tooltip="Toggle transcriptions" onClick={onToggleTranscriptions}>
                    <Captions className="h-5 w-5" />
                </ControlButton>
                 <ControlButton tooltip="Toggle settings" onClick={onToggleSettings}>
                    <Settings className="h-5 w-5" />
                </ControlButton>
            </div>
        </div>
    );
}
