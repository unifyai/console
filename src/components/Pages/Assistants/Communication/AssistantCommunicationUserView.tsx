'use client';

import * as React from 'react';
import { Minus, User, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { VideoTrack, TrackReference, useIsSpeaking } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { cn } from '@/lib/utils';

interface AssistantCommunicationUserViewProps {
  imageUrl: string | null | undefined;
  trackRef?: TrackReference;
  isCameraOn: boolean;
  participant: Participant;
  onMinimize: () => void;
  onMaximize?: () => void;
  maximized?: boolean;
}

export function AssistantCommunicationUserView({
  imageUrl,
  trackRef,
  isCameraOn,
  participant,
  onMinimize,
  onMaximize,
  maximized = false,
}: AssistantCommunicationUserViewProps) {
  const isSpeaking = useIsSpeaking(participant);

  if (maximized) {
    return (
      <div className="group relative h-full w-full rounded-lg bg-black">
        {isCameraOn && trackRef ? (
          <VideoTrack trackRef={trackRef} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            No video feed available.
          </div>
        )}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-7 w-7 bg-black/30 text-white hover:bg-black/60"
                onClick={onMinimize}
              >
                <Minimize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Minimize view</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative h-32 w-48 overflow-hidden rounded-lg border bg-muted shadow-2xl transition-all duration-300',
        isSpeaking && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      <div className="flex h-full w-full items-center justify-center">
        {isCameraOn && trackRef ? (
          <VideoTrack trackRef={trackRef} className="h-full w-full object-cover" />
        ) : (
          <Avatar className="h-full w-full rounded-none">
            <AvatarImage
              src={imageUrl ?? undefined}
              alt="Your video feed"
              className="object-cover"
            />
            <AvatarFallback className="rounded-none bg-muted text-3xl text-muted-foreground">
              <User className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="absolute right-1 top-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <TooltipProvider delayDuration={100}>
          {onMaximize && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-background/50 h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={onMaximize}
                >
                  <Maximize className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Maximize</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-background/50 h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={onMinimize}
              >
                <Minus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Minimize self-view</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
