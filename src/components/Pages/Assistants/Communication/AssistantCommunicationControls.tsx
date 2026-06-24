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
  PointerOff,
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
  isRemoteControlInteractiveLoading?: boolean;
  isConnectionEstablished: boolean;
  isAssistantJoined?: boolean;
  isDesktopReady?: boolean;
  callType: 'video' | 'audio' | null;
  /** Shrinks the toolbar to match the chat composer's height so the
   *  docked call surface lines up with adjacent panes' footers
   *  (compact pill-sized buttons, no in-call chat toggle since the
   *  user can pop the call out to get the regular chat back). */
  compact?: boolean;
  /** Hides the chat toggle entirely (cross-page floating call, where the
   *  page-level chat stream isn't wired up). */
  chatDisabled?: boolean;
}

const ControlButton: React.FC<{
  tooltip: string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  [key: string]: any;
}> = ({ tooltip, children, className, compact, ...props }) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        {/* This span allows hover events for the tooltip even when the button is disabled. */}
        <span>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-full text-muted-foreground hover:bg-muted hover:text-foreground',
              compact ? 'h-6 w-6' : 'h-10 w-10',
              className
            )}
            aria-label={tooltip}
            {...props}
          >
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
  isRemoteControlInteractiveLoading,
  isConnectionEstablished,
  isAssistantJoined = true, // Default to true for backwards compatibility
  isDesktopReady = true, // Default to true for backwards compatibility
  callType,
  compact = false,
  chatDisabled = false,
}: AssistantCommunicationControlsProps) {
  // Remote control requires assistant to have joined AND desktop VM to be ready
  const canUseRemoteControl = isConnectionEstablished && isAssistantJoined && isDesktopReady;
  const iconClass = compact ? 'h-4 w-4' : 'h-5 w-5';
  // ``h-10`` is the same footer height the assistant-list collapse
  // bar and the memory/tasks/actions/dashboards tab footers use, so
  // the compact docked toolbar's icons line up horizontally with
  // them across the page bottom. ``h-6 w-6`` buttons match the
  // ``PanelLeftClose`` chip in the list footer for the same reason.
  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-between border-t bg-background',
        compact ? 'h-10 gap-2 px-3' : 'h-20 px-6'
      )}
    >
      {/* Left Controls */}
      <div className={cn('flex w-1/3 items-center', compact ? 'gap-1' : 'gap-3')}>
        <ControlButton
          tooltip="Hang up"
          className="bg-destructive/10 hover:bg-destructive/20 text-destructive"
          onClick={onHangUp}
          compact={compact}
        >
          <PhoneOff className={iconClass} />
        </ControlButton>
        <ControlButton
          tooltip={
            !isConnectionEstablished
              ? 'Available after connecting'
              : isMicOn
                ? 'Mute microphone'
                : 'Unmute microphone'
          }
          {...micButtonProps}
          disabled={!isConnectionEstablished || micButtonProps.disabled}
          compact={compact}
        >
          {isMicOn ? <Mic className={iconClass} /> : <MicOff className={iconClass} />}
        </ControlButton>
        <ControlButton
          tooltip={
            !isConnectionEstablished
              ? 'Available after connecting'
              : isCameraOn
                ? 'Turn off camera'
                : 'Turn on camera'
          }
          {...cameraButtonProps}
          disabled={!isConnectionEstablished || cameraButtonProps.disabled}
          compact={compact}
        >
          {isCameraOn ? <Video className={iconClass} /> : <VideoOff className={iconClass} />}
        </ControlButton>
      </div>

      {/* Center Controls */}
      <div className={cn('flex flex-1 items-center justify-center', compact ? 'gap-1' : 'gap-3')}>
        <>
          <ControlButton
            tooltip={
              !isConnectionEstablished
                ? 'Available after assistant joins'
                : isScreenShareOn
                  ? 'Stop sharing screen'
                  : 'Share your screen'
            }
            onClick={onToggleScreenShare}
            disabled={isScreenShareToggleDisabled || !isConnectionEstablished}
            className={cn(isScreenShareOn && 'bg-primary/10 hover:bg-primary/20 text-primary')}
            compact={compact}
          >
            {isScreenShareToggleDisabled ? (
              <Loader2 className={iconClass} />
            ) : (
              <ScreenShare className={iconClass} />
            )}
          </ControlButton>

          <div
            className={cn(
              'flex items-center rounded-full border px-1 transition-colors',
              compact ? 'h-6' : 'h-10',
              isRemoteControlActive ? 'border-border' : 'border-transparent'
            )}
          >
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'rounded-full',
                        compact ? 'h-5 w-5' : 'h-9 w-9',
                        isRemoteControlActive && 'text-primary'
                      )}
                      onClick={onToggleRemoteControl}
                      disabled={isRemoteControlLoading || !canUseRemoteControl}
                      aria-label={
                        !isConnectionEstablished || !isAssistantJoined
                          ? 'Available after assistant joins'
                          : !isDesktopReady
                            ? 'Assistant desktop is starting up\u2026'
                            : isRemoteControlActive
                              ? 'Hide assistant screen'
                              : 'Show assistant screen'
                      }
                    >
                      {isRemoteControlLoading ? (
                        <Loader2 className={cn(iconClass, 'animate-spin')} />
                      ) : (
                        <Computer className={iconClass} />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>
                    {!isConnectionEstablished || !isAssistantJoined
                      ? 'Available after assistant joins'
                      : !isDesktopReady
                        ? 'Assistant desktop is starting up\u2026'
                        : isRemoteControlActive
                          ? 'Hide assistant screen'
                          : 'Show assistant screen'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isRemoteControlActive && <div className="h-6 w-px bg-border" />}

            {isRemoteControlActive && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'rounded-full',
                          compact ? 'h-5 w-5' : 'h-9 w-9',
                          isRemoteControlInteractive && 'text-primary'
                        )}
                        onClick={onToggleRemoteControlInteractive}
                        disabled={isRemoteControlLoading || isRemoteControlInteractiveLoading}
                        aria-label={
                          isRemoteControlInteractive
                            ? 'Disable mouse & keyboard control'
                            : 'Enable mouse & keyboard control'
                        }
                      >
                        {isRemoteControlInteractiveLoading ? (
                          <Loader2 className={cn(iconClass, 'animate-spin')} />
                        ) : isRemoteControlInteractive ? (
                          <Pointer className={iconClass} />
                        ) : (
                          <PointerOff className={iconClass} />
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>
                      {isRemoteControlInteractive
                        ? 'Disable mouse & keyboard control'
                        : 'Enable mouse & keyboard control'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </>
      </div>

      {/* Right Controls. In compact (docked) mode the chat toggle is
       *  suppressed — the page-level chat is one popout away and
       *  the in-call chat side panel competes with the adjacent
       *  assistant-info panel for the same screen real estate. */}
      <div className={cn('flex w-1/3 items-center justify-end', compact ? 'gap-1' : 'gap-3')}>
        {!compact && !chatDisabled && (
          <ControlButton tooltip="Toggle chat" onClick={onToggleChat} compact={compact}>
            <MessageSquare className={iconClass} />
          </ControlButton>
        )}
        <ControlButton tooltip="Toggle settings" onClick={onToggleSettings} compact={compact}>
          <Settings className={iconClass} />
        </ControlButton>
      </div>
    </div>
  );
}
