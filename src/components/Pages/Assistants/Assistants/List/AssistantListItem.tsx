import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Phone, Mail, PhoneCall } from 'lucide-react';
import { WhatsApp } from '@mui/icons-material';
import { cn } from '@/lib/utils';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/UI/hover-card';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/UI/tooltip';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';

interface AssistantListItemProps {
  assistant: Assistant;
  status: AssistantStatus | null;
  isSelected: boolean;
  onShowProfile: (id: string) => void;
  onOpenContactManager: (assistant: Assistant, tab: 'email' | 'phone' | 'whatsapp') => void;
  isFolded: boolean;
  isCallActive: boolean;
}

export function AssistantListItem({
  assistant,
  status,
  isSelected,
  onShowProfile,
  onOpenContactManager,
  isFolded,
  isCallActive,
}: AssistantListItemProps) {
  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShowProfile(assistant.agentId);
  };

  const displayName = `${assistant.firstName} ${assistant.surname}`;
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto;
  const isOnline = status?.running === true;

  const hoverCardContent = (
    <div className="flex justify-between space-x-4">
      <Avatar>
        <AvatarImage src={photoSrc ?? undefined} />
        <AvatarFallback>
          {`${assistant.firstName?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <h4 className="text-title">{displayName}</h4>
        <div className="text-caption flex items-center pt-1 text-muted-foreground">
          <Mail className="mr-2 h-4 w-4 opacity-70" />{' '}
          {assistant.email ? (
            <a
              href={`mailto:${assistant.email}`}
              onClick={(e) => e.stopPropagation()}
              className="text-link truncate"
            >
              {assistant.email}
            </a>
          ) : (
            <Button
              variant="link"
              className="text-caption text-link h-auto p-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenContactManager(assistant, 'email');
              }}
            >
              Add Email
            </Button>
          )}
        </div>
        <div className="text-caption flex items-center pt-1 text-muted-foreground">
          <Phone className="mr-2 h-4 w-4 opacity-70" />{' '}
          {assistant.phone ? (
            <span className="truncate">{assistant.phone}</span>
          ) : (
            <Button
              variant="link"
              className="text-caption text-link h-auto p-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenContactManager(assistant, 'phone');
              }}
            >
              Add Phone
            </Button>
          )}
        </div>
        <div className="text-caption flex items-center pt-1 text-muted-foreground">
          <WhatsApp sx={{ fontSize: '16px', marginRight: '8px', opacity: 0.7 }} />
          {assistant.assistantWhatsappNumber ? (
            <span className="truncate">{assistant.assistantWhatsappNumber}</span>
          ) : (
            <Button
              variant="link"
              className="text-caption text-link h-auto p-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenContactManager(assistant, 'whatsapp');
              }}
            >
              Add WhatsApp
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (isFolded) {
    const content = (
      <div
        className={cn(
          'relative cursor-pointer rounded-full',
          isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
        onClick={handleProfileClick}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={photoSrc ?? undefined} alt={displayName} />
          <AvatarFallback>
            {`${assistant.firstName?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {status !== null && (
          <span
            role="status"
            className={cn(
              'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background',
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            )}
          />
        )}
        {isCallActive && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary"></span>
          </span>
        )}
      </div>
    );

    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>{content}</HoverCardTrigger>
        <HoverCardContent className="w-80" side="right" align="start">
          {hoverCardContent}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`assistant-list-item-${assistant.agentId}`}
      className={cn(
        'group flex cursor-pointer items-center justify-between rounded-md p-2',
        !isSelected && 'hover:bg-muted',
        isSelected && 'bg-primary text-primary-foreground'
      )}
      onClick={handleProfileClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleProfileClick(e as any);
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <div className="relative">
              <Avatar className="h-8 w-8 flex-shrink-0 cursor-default">
                <AvatarImage src={photoSrc ?? undefined} alt={displayName} />
                <AvatarFallback>
                  {`${assistant.firstName?.[0] ?? ''}${assistant.surname?.[0] ?? ''}`.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {status !== null && (
                <span
                  role="status"
                  data-testid={`status-indicator-${assistant.agentId}`}
                  className={cn(
                    'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background',
                    isOnline ? 'bg-green-500' : 'bg-gray-400'
                  )}
                />
              )}
            </div>
          </HoverCardTrigger>
          <HoverCardContent className="w-80" side="right" align="start">
            {hoverCardContent}
          </HoverCardContent>
        </HoverCard>
        <span className="text-body text-strong truncate">{displayName}</span>
      </div>
      {assistant.demoId && (
        <span
          className={cn(
            `text-caption`,
            isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        >
          <Badge variant="outline">Demo</Badge>
        </span>
      )}
      {isCallActive && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PhoneCall
                className={cn(
                  'mr-2 h-4 w-4 flex-shrink-0 animate-pulse',
                  isSelected ? 'text-primary-foreground' : 'text-primary'
                )}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>In a call</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
