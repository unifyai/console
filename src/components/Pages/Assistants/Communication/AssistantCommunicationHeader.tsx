'use client';

import * as React from 'react';
import { Button } from '@/components/UI/button';
import { Minus, ExternalLink } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';

interface AssistantCommunicationHeaderProps {
  assistantName: string;
  onMinimize: () => void;
  onPopOut?: () => void;
  isPopOutDisabled?: boolean;
}

export function AssistantCommunicationHeader({
  assistantName,
  onMinimize,
  onPopOut,
  isPopOutDisabled,
}: AssistantCommunicationHeaderProps) {
  return (
    <div className="flex h-10 flex-shrink-0 items-center justify-between border-b bg-background px-4">
      <p className="text-title">Talk to {assistantName}</p>
      <div className="flex items-center">
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
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={onMinimize}
                aria-label="Minimize"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Minimize</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
