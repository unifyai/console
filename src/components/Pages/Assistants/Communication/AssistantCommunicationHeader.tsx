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

export function AssistantCommunicationHeader({ assistantName, onMinimize, onPopOut, isPopOutDisabled }: AssistantCommunicationHeaderProps) {
    return (
        <div className="flex-shrink-0 h-10 px-4 flex items-center justify-between bg-background border-b">
            <p className="text-sm font-medium text-foreground">Talk to {assistantName}</p>
            <div className="flex items-center">
                {onPopOut && (
                     <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={onPopOut} disabled={isPopOutDisabled}>
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>{isPopOutDisabled ? "Available when call is ready" : "Open in new tab"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={onMinimize}>
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