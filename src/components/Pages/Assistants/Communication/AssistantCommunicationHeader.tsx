'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { Hand, Maximize2, SquareArrowOutUpRight, PictureInPicture2, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';

interface AssistantCommunicationHeaderProps {
  assistantName: string;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
  onExpand?: () => void;
  onMinimize?: () => void;
  /** Lift the docked call out of the page layout into a floating /
   *  modal dialog. Only meaningful in docked mode. */
  onPopOut?: () => void;
  /** Inverse of ``onPopOut`` — return the floating / modal call
   *  surface to its docked position above the chat. Wired on the
   *  modal & floating modes so users who popped out can re-dock
   *  without having to hang up first. */
  onRedock?: () => void;
  onHangUp?: () => void;
}

export function AssistantCommunicationHeader({
  assistantName,
  onHeaderPointerDown,
  onExpand,
  onMinimize,
  onPopOut,
  onRedock,
  onHangUp,
}: AssistantCommunicationHeaderProps) {
  return (
    // Header height matches the chat tab strip (``py-2`` + h-7 ≈
    // 44px) so the docked call's top edge lines up with the
    // adjacent secondary slot's tab strip and the page-wide horizontal
    // border reads as a single line.
    <div
      className={cn(
        'relative flex h-11 flex-shrink-0 items-center justify-between border-b bg-background px-4',
        onHeaderPointerDown && 'cursor-grab select-none active:cursor-grabbing'
      )}
      onPointerDown={onHeaderPointerDown}
    >
      {/* Drag handle indicator – visible when header is draggable */}
      {onHeaderPointerDown && (
        <div className="bg-muted-foreground/30 absolute left-1/2 top-1 h-1 w-8 -translate-x-1/2 rounded-full" />
      )}
      <p className="text-title">Talk to {assistantName}</p>
      {/* Stop propagation so button clicks don't initiate a drag */}
      <div className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
        {onRedock && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={onRedock}
                  aria-label="Dock call above chat"
                  data-testid="call-redock-button"
                >
                  <PictureInPicture2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Dock above chat</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onPopOut && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={onPopOut}
                  aria-label="Pop out call into a dialog"
                  data-testid="call-popout-button"
                >
                  <SquareArrowOutUpRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Pop out call</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onMinimize && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={onMinimize}
                  aria-label="Floating Mode"
                >
                  <Hand className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Floating Mode</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onExpand && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={onExpand}
                  aria-label="Fullscreen Mode"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Fullscreen Mode</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {onHangUp && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-destructive/10 h-7 w-7 text-destructive hover:text-destructive"
                  onClick={onHangUp}
                  aria-label="End call"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>End call</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
