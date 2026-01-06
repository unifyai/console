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
    Loader2,
    Pointer,
    PointerOff
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    isRemoteControlActive: boolean;
    onToggleRemoteControl: () => void;
    isRemoteControlLoading: boolean;
    isRemoteControlInteractive: boolean;
    onToggleRemoteControlInteractive: () => void;
    isConnectionEstablished: boolean;
    callType: 'video' | 'audio' | null;
}

const ControlButton: React.FC<{ tooltip: string; children: React.ReactNode; className?: string; [key: string]: any; }> =
    ({ tooltip, children, className, ...props }) => (
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    {/* This span allows hover events for the tooltip even when the button is disabled. */}
                    <span>
                        <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground", className)} aria-label={tooltip}{...props}>
                            {children}
                        </Button>
                    </span>
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
    isRemoteControlActive,
    onToggleRemoteControl,
    isRemoteControlLoading,
    isRemoteControlInteractive,
    onToggleRemoteControlInteractive,
    isConnectionEstablished,
    callType,
}: AssistantCommunicationControlsProps) {

    return (
        <div className="flex-shrink-0 h-20 px-6 flex items-center justify-between bg-background border-t">
            {/* Left Controls */}
            <div className="flex items-center gap-3 w-1/3">
                 <ControlButton tooltip="Hang up" className="bg-destructive/10 hover:bg-destructive/20 text-destructive" onClick={onHangUp}>
                    <PhoneOff className="h-5 w-5" />
                </ControlButton>
                <ControlButton 
                    tooltip={!isConnectionEstablished ? "Available after connecting" : (isMicOn ? "Mute microphone" : "Unmute microphone")} 
                    {...micButtonProps}
                    disabled={!isConnectionEstablished || micButtonProps.disabled}
                >
                    {isMicOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </ControlButton>
                <ControlButton 
                    tooltip={!isConnectionEstablished ? "Available after connecting" : (isCameraOn ? "Turn off camera" : "Turn on camera")} 
                    {...cameraButtonProps}
                    disabled={!isConnectionEstablished || cameraButtonProps.disabled}
                >
                    {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </ControlButton>
            </div>

            {/* Center Controls */}
            <div className="flex items-center justify-center flex-1 gap-3">
                
                    <>
                        <ControlButton
                            tooltip={
                                !isConnectionEstablished
                                    ? "Available after assistant joins"
                                    : isScreenShareOn
                                    ? "Stop sharing screen"
                                    : "Share your screen"
                            }
                            onClick={onToggleScreenShare}
                            disabled={isScreenShareToggleDisabled || !isConnectionEstablished}
                            className={cn(isScreenShareOn && "text-primary bg-primary/10 hover:bg-primary/20")}
                        >
                            {isScreenShareToggleDisabled ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScreenShare className="h-5 w-5" />}
                        </ControlButton>

                        <div className={cn(
                            "flex items-center h-10 px-1 rounded-full transition-colors border",
                            isRemoteControlActive ? "border-border" : "border-transparent"
                        )}>
                            <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                    "h-9 w-9 rounded-full",
                                                    isRemoteControlActive && "text-primary"
                                                )}
                                                onClick={onToggleRemoteControl}
                                                disabled={isRemoteControlLoading || !isConnectionEstablished}
                                                aria-label={!isConnectionEstablished ? "Available after assistant joins" : (isRemoteControlActive ? "Hide assistant screen" : "Show assistant screen")}
                                            >
                                                {isRemoteControlLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Computer className="h-5 w-5" />}
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>{!isConnectionEstablished ? "Available after assistant joins" : (isRemoteControlActive ? "Hide assistant screen" : "Show assistant screen")}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {isRemoteControlActive && (
                                <div className="h-6 w-px bg-border" />
                            )}

                            {isRemoteControlActive && (
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-9 w-9 rounded-full",
                                                        isRemoteControlInteractive && "text-primary"
                                                    )}
                                                    onClick={onToggleRemoteControlInteractive}
                                                    disabled={isRemoteControlLoading}
                                                    aria-label={isRemoteControlInteractive ? "Disable mouse & keyboard control" : "Enable mouse & keyboard control"}
                                                >
                                                    {isRemoteControlInteractive ? <Pointer className="h-5 w-5" /> : <PointerOff className="h-5 w-5" />}
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <p>{isRemoteControlInteractive ? "Disable mouse & keyboard control" : "Enable mouse & keyboard control"}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </>
                
            </div>

            {/* Right Controls */}
            <div className="flex items-center justify-end gap-3 w-1/3">
                 <ControlButton tooltip="Toggle chat" onClick={onToggleChat}>
                    <MessageSquare className="h-5 w-5" />
                </ControlButton>
                 <ControlButton tooltip="Toggle settings" onClick={onToggleSettings}>
                    <Settings className="h-5 w-5" />
                </ControlButton>
            </div>
        </div>
    );
}