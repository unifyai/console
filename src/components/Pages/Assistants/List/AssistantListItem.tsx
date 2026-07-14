'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { PhoneCall, PanelRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/UI/tooltip';
import { Button } from '@/components/UI/button';
import { Badge } from '@/components/UI/badge';
import { CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { assistantDisplayName, assistantInitials } from '@/lib/assistants/displayName';
import { AssistantPresenceIndicator } from '@/components/Pages/Assistants/Common/AssistantPresenceIndicator';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { tabToolbarIconButtonClass } from '@/components/Pages/Assistants/Common/TabToolbar';
import {
  ASSISTANT_INFO_PANEL_VISIBILITY_EVENT,
  readAssistantInfoPanelVisibility,
  type AssistantInfoPanelVisibilityDetail,
} from '@/lib/assistants/infoPanelVisibility';

interface AssistantListItemProps {
  assistant: Assistant;
  status: AssistantStatus | null;
  isSelected: boolean;
  onShowProfile: (id: string) => void;
  onToggleAssistantInfo: (assistantId: string) => void;
  isFolded: boolean;
  isCallActive: boolean;
  /**
   * Count of unread chat messages from the page-level inbox multiplex
   * stream. Rendered as a numeric badge in expanded mode and as a small
   * dot over the avatar in folded mode. `0` renders nothing.
   */
  unreadCount?: number;
  isPrimary?: boolean;
  alsoInTeamLabels?: string[];
  /** Row is under the assistant's owning team (team-owned hire). */
  isTeamOwned?: boolean;
}

export function AssistantListItem({
  assistant,
  status,
  isSelected,
  onShowProfile,
  onToggleAssistantInfo,
  isFolded,
  isCallActive,
  unreadCount = 0,
  isPrimary = true,
  alsoInTeamLabels = [],
  isTeamOwned = false,
}: AssistantListItemProps) {
  const hasUnread = unreadCount > 0;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);
  const totalTeamCount = alsoInTeamLabels.length + 1;
  const [infoPanelVisibility, setInfoPanelVisibility] =
    React.useState<AssistantInfoPanelVisibilityDetail | null>(() =>
      readAssistantInfoPanelVisibility()
    );

  React.useEffect(() => {
    const onVisibilityChange = (event: Event) => {
      setInfoPanelVisibility(
        (event as CustomEvent<AssistantInfoPanelVisibilityDetail>).detail ?? null
      );
    };
    window.addEventListener(ASSISTANT_INFO_PANEL_VISIBILITY_EVENT, onVisibilityChange);
    return () => {
      window.removeEventListener(ASSISTANT_INFO_PANEL_VISIBILITY_EVENT, onVisibilityChange);
    };
  }, []);

  const isInfoOpen =
    isSelected &&
    infoPanelVisibility?.assistantId === assistant.agentId &&
    infoPanelVisibility.isOpen;

  const openProfile = () => {
    onShowProfile(assistant.agentId);
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openProfile();
  };

  const handleInfoToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleAssistantInfo(assistant.agentId);
  };

  const isCoordinator = assistant.isCoordinator === true;
  const displayName = assistantDisplayName(assistant);
  const subtitle = assistant.jobTitle?.trim() || null;
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto;
  const creatureAppearance = parseCreatureSentinel(photoSrc);

  const renderPhotoAvatar = (className: string) =>
    creatureAppearance ? (
      <CreatureAvatar appearance={creatureAppearance} className={className} label={displayName} />
    ) : (
      <Avatar className={cn('rounded-control', className)}>
        <AvatarImage src={photoSrc ?? undefined} alt={displayName} />
        <AvatarFallback className="rounded-control">{assistantInitials(assistant)}</AvatarFallback>
      </Avatar>
    );

  const handleFoldedKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openProfile();
  };

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openProfile();
  };

  if (isFolded) {
    return (
      <div
        data-testid={isPrimary ? `assistant-list-item-${assistant.agentId}` : undefined}
        role="button"
        tabIndex={0}
        aria-label={displayName}
        className={cn(
          'relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-transparent transition-colors',
          isSelected && 'bg-accent-soft',
          !isSelected && 'hover:bg-[var(--surface-hover)]'
        )}
        onClick={handleProfileClick}
        onKeyDown={handleFoldedKeyDown}
      >
        {isCoordinator ? (
          <CoordinatorLogoAvatar className="h-9 w-9" />
        ) : (
          renderPhotoAvatar('h-9 w-9')
        )}
        <AssistantPresenceIndicator status={status} />
        {isCallActive && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary">
              <PhoneCall className="h-2.5 w-2.5 text-primary-foreground" />
            </span>
          </span>
        )}
        {hasUnread && !isCallActive && (
          <span
            data-testid={`assistant-unread-badge-${assistant.agentId}`}
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
          >
            {unreadLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={isPrimary ? `assistant-list-item-${assistant.agentId}` : undefined}
      className={cn(
        'group flex w-full min-w-0 cursor-pointer items-center justify-between rounded-lg border border-transparent p-2 transition-colors',
        !isSelected && 'hover:bg-[var(--surface-hover)]',
        isSelected && 'bg-accent-soft'
      )}
      onClick={handleProfileClick}
      onKeyDown={handleRowKeyDown}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative">
          {isCoordinator ? (
            <CoordinatorLogoAvatar className="h-8 w-8 flex-shrink-0" />
          ) : (
            renderPhotoAvatar('h-8 w-8 flex-shrink-0')
          )}
          <AssistantPresenceIndicator
            status={status}
            testId={`status-indicator-${assistant.agentId}`}
          />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                'text-body text-strong truncate',
                isSelected && 'text-accent-soft-foreground'
              )}
            >
              {displayName}
            </span>
          </div>
          {subtitle && !isCoordinator ? (
            <p className="text-caption mt-0.5 truncate text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {isTeamOwned && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Badge
                    variant="outline"
                    className="h-5 cursor-default px-1.5 text-[10px] font-medium"
                    data-testid={`assistant-team-owned-badge-${assistant.agentId}`}
                  >
                    Team-owned
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>
                  Owned by this team: everyone can work with it and everything it learns is shared
                  with the team.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {alsoInTeamLabels.length > 0 && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Badge
                    variant="outline"
                    className="h-5 cursor-default px-1.5 text-[10px] font-medium"
                  >
                    {totalTeamCount} teams
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{`Also in ${alsoInTeamLabels.join(', ')}`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {hasUnread && (
          <span
            data-testid={`assistant-unread-badge-${assistant.agentId}`}
            className="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
          >
            {unreadLabel}
          </span>
        )}
        {isCallActive && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PhoneCall className="h-4 w-4 flex-shrink-0 animate-pulse text-primary" />
              </TooltipTrigger>
              <TooltipContent>
                <p>In a call</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={isInfoOpen ? 'primary' : 'ghost'}
                size="icon"
                className={cn(
                  tabToolbarIconButtonClass,
                  'opacity-0 transition-opacity group-hover:opacity-100',
                  isSelected && 'opacity-100'
                )}
                onClick={handleInfoToggle}
                aria-label={isInfoOpen ? 'Hide profile' : 'Show profile'}
                aria-pressed={isInfoOpen}
                data-testid={`assistant-info-toggle-${assistant.agentId}`}
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{isInfoOpen ? 'Hide profile' : 'Show profile'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
