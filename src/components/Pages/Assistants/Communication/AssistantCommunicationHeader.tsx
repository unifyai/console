'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { ExternalLink, Maximize2, PictureInPicture } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';

interface AssistantCommunicationHeaderProps {
  assistantName: string;
  onPopOut?: () => void;
  isPopOutDisabled?: boolean;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
  onExpand?: () => void;
  onMinimize?: () => void;
}

export function AssistantCommunicationHeader({
  assistantName,
  onPopOut,
  isPopOutDisabled,
  onHeaderPointerDown,
  onExpand,
  onMinimize,
}: AssistantCommunicationHeaderProps) {
  return (
    <div
      className={cn(
        'relative flex h-10 flex-shrink-0 items-center justify-between border-b bg-background px-4',
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
        {onPopOut && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={onPopOut}
                    disabled={isPopOutDisabled}
                    aria-label="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isPopOutDisabled ? 'Available when call is ready' : 'Open in new tab'}</p>
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
                  <PictureInPicture className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Floating Mode</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
