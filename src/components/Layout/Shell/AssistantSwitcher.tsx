'use client';

import * as React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Skeleton } from '@/components/UI/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { assistantDisplayName, assistantInitials } from '@/lib/assistants/displayName';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { AssistantPresenceIndicator } from '@/components/Pages/Assistants/Common/AssistantPresenceIndicator';
import { PresenceStatusDot } from '@/components/Pages/Assistants/Common/PresenceStatusDot';
import { TeamAvatar } from '@/components/Pages/Assistants/OrgChat/TeamAvatar';
import { GroupFaceStack } from '@/components/Pages/Assistants/OrgChat/GroupFaceStack';
import type { Assistant } from '@/types/assistants/assistant';
import { AssistantList } from '@/components/Pages/Assistants/List/AssistantList';

function UnityAvatar({ assistant, sizeClass }: { assistant: Assistant; sizeClass: string }) {
  if (assistant.isCoordinator) {
    return <CoordinatorLogoAvatar className={cn('shrink-0', sizeClass)} />;
  }
  const photoSrc = assistant.signedProfilePhotoUrl || assistant.profilePhoto;
  const creature = parseCreatureSentinel(photoSrc);
  if (creature) {
    return (
      <CreatureAvatar
        appearance={creature}
        className={cn('rounded-control shrink-0', sizeClass)}
        label={assistantDisplayName(assistant)}
      />
    );
  }
  return (
    <Avatar className={cn('rounded-control shrink-0', sizeClass)}>
      <AvatarImage src={photoSrc ?? undefined} alt={assistantDisplayName(assistant)} />
      <AvatarFallback className="rounded-control">{assistantInitials(assistant)}</AvatarFallback>
    </Avatar>
  );
}

/** Face override for non-assistant selections (a human, team, or chat group). */
export interface ActiveEntityFace {
  kind: 'human' | 'team' | 'group';
  label: string;
  sublabel?: string | null;
  imageUrl?: string | null;
  online?: boolean;
  /** Managed org-wide team — render the fixed Org glyph instead of initials. */
  isOrgWideSharing?: boolean;
  /** Face-stack members for chat-group selections. */
  groupFaces?: Array<{ id: string; name: string; image?: string | null }>;
}

interface AssistantSwitcherProps {
  /** Currently-open unity; drives the switcher card face. */
  activeUnity: Assistant | null;
  /** When set, the card face shows this human/team instead of an assistant. */
  activeEntityFace?: ActiveEntityFace | null;
  isInitialAssistantIdentityLoading?: boolean;
  /** Full prop bag forwarded to the embedded `AssistantList` (the switcher). */
  listProps: React.ComponentProps<typeof AssistantList>;
  collapsed: boolean;
  /**
   * When true, the popover stays open through focus/pointer moves into a nested
   * overlay (hire / create-group). Closing that overlay returns to the switcher.
   */
  nestedOverlayOpen?: boolean;
  /** Assistant currently on a live call; escalates that face's presence badge. */
  activeCallAssistantId?: string | null;
}

function entityInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

/**
 * The rail's unity switcher: the whole card is the teammate picker. Expanded it
 * shows the active face, name, and role beside a chevron; collapsed to a dock
 * it is the face alone with a tooltip. Chat is a rail section of its own, so
 * the face is not a shortcut to it.
 */
export function AssistantSwitcher({
  activeUnity,
  activeEntityFace = null,
  isInitialAssistantIdentityLoading = false,
  listProps,
  collapsed,
  nestedOverlayOpen = false,
  activeCallAssistantId = null,
}: AssistantSwitcherProps) {
  const [switcherOpen, setSwitcherOpen] = React.useState(false);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      // Nested dialogs steal focus; keep the switcher mounted underneath so
      // dismissing the dialog returns to the list instead of a closed rail.
      if (!open && nestedOverlayOpen) return;
      setSwitcherOpen(open);
    },
    [nestedOverlayOpen]
  );

  const showSkeletonFace = !activeUnity && !activeEntityFace && isInitialAssistantIdentityLoading;
  const unityName = activeEntityFace
    ? activeEntityFace.label
    : activeUnity
      ? assistantDisplayName(activeUnity)
      : 'Select a teammate';
  const unitySub = activeEntityFace
    ? (activeEntityFace.sublabel ??
      (activeEntityFace.kind === 'team'
        ? 'Team'
        : activeEntityFace.kind === 'group'
          ? 'Group'
          : 'Team member'))
    : activeUnity
      ? activeUnity.isCoordinator
        ? null
        : activeUnity.jobTitle?.trim() || 'Digital twin'
      : 'No teammate selected';
  const activeUnityStatus = activeUnity
    ? listProps.assistantStatuses.get(activeUnity.agentId) || null
    : null;
  const activeUnityInCall = !!activeUnity && activeCallAssistantId === activeUnity.agentId;

  const face = showSkeletonFace ? (
    <Skeleton
      data-testid="rail-unity-switcher-skeleton"
      className={cn('rounded-control shrink-0', collapsed ? 'h-10 w-10' : 'h-[38px] w-[38px]')}
    />
  ) : activeEntityFace ? (
    <span className="relative shrink-0">
      {activeEntityFace.kind === 'team' ? (
        <TeamAvatar
          name={activeEntityFace.label}
          imageUrl={activeEntityFace.imageUrl}
          isOrgWideSharing={activeEntityFace.isOrgWideSharing}
          className={collapsed ? 'h-10 w-10' : 'h-[38px] w-[38px]'}
          iconClassName="h-5 w-5"
        />
      ) : activeEntityFace.kind === 'group' ? (
        <GroupFaceStack
          members={activeEntityFace.groupFaces ?? []}
          sizeClassName={collapsed ? 'h-10 w-10' : 'h-[38px] w-[38px]'}
        />
      ) : (
        <Avatar
          className={cn('rounded-control shrink-0', collapsed ? 'h-10 w-10' : 'h-[38px] w-[38px]')}
        >
          <AvatarImage src={activeEntityFace.imageUrl ?? undefined} alt={activeEntityFace.label} />
          <AvatarFallback className="rounded-control">
            {entityInitials(activeEntityFace.label)}
          </AvatarFallback>
        </Avatar>
      )}
      {activeEntityFace.kind === 'human' ? (
        <PresenceStatusDot
          online={activeEntityFace.online === true}
          testId="rail-human-online-indicator"
        />
      ) : null}
    </span>
  ) : activeUnity ? (
    <span className="relative shrink-0">
      <UnityAvatar
        assistant={activeUnity}
        sizeClass={collapsed ? 'h-10 w-10' : 'h-[38px] w-[38px]'}
      />
      <AssistantPresenceIndicator
        status={activeUnityStatus}
        inCall={activeUnityInCall}
        testId={`rail-status-indicator-${activeUnity.agentId}`}
      />
    </span>
  ) : (
    <span className="rounded-control grid h-9 w-9 shrink-0 place-items-center bg-card text-muted-foreground">
      ?
    </span>
  );

  const switcherButton = (
    <PopoverTrigger asChild>
      <button
        type="button"
        data-testid="rail-unity-switcher"
        title={collapsed ? `Switch teammate (${unityName})` : undefined}
        aria-label={`Switch teammate — ${unityName}`}
        className={cn(
          'flex items-center transition-colors',
          collapsed
            ? 'mx-auto w-fit rounded-xl p-1.5 hover:bg-muted'
            : 'hover:bg-muted/70 mx-3.5 gap-2 rounded-xl border border-border bg-card px-2 py-1.5 text-left'
        )}
      >
        {face}
        {!collapsed &&
          (showSkeletonFace ? (
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[14.5px] font-semibold">{unityName}</div>
              {unitySub ? (
                <div className="truncate text-[11.5px] capitalize text-muted-foreground">
                  {unitySub}
                </div>
              ) : null}
            </div>
          ))}
        {!collapsed && (
          <ChevronsUpDown
            className="h-4 w-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
      </button>
    </PopoverTrigger>
  );

  return (
    <Popover open={switcherOpen} onOpenChange={handleOpenChange}>
      <div className="mb-2">
        {collapsed ? (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>{switcherButton}</TooltipTrigger>
              <TooltipContent side="right">
                <p>Switch teammate · {unityName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          switcherButton
        )}
      </div>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        data-testid="rail-unity-switcher-popover"
        className="flex h-[70vh] max-h-[560px] w-[320px] flex-col overflow-hidden p-0"
        onInteractOutside={(event) => {
          if (nestedOverlayOpen) event.preventDefault();
        }}
        onFocusOutside={(event) => {
          if (nestedOverlayOpen) event.preventDefault();
        }}
      >
        <AssistantList {...listProps} isFolded={false} onToggleFold={undefined} />
      </PopoverContent>
    </Popover>
  );
}
