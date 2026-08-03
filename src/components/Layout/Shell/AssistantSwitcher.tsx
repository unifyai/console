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
  /** Open the Chat section for the current selection (droid / face = conversation home). */
  onOpenChat?: () => void;
  /** Whether Chat is the active rail section. */
  chatActive?: boolean;
  /** Unread/activity pulse on the chat-home face while another section is selected. */
  showChatActivity?: boolean;
  /** Assistant currently on a live call; escalates that face's presence badge. */
  activeCallAssistantId?: string | null;
}

/**
 * The presence badge and the picker badge share the face's bottom-right
 * corner. Presence yields whenever the picker is revealed, so the two never
 * render on top of one another. The open popover portals focus out of the
 * rail, so that case is driven by state rather than `group-focus-within`.
 */
const PRESENCE_YIELD_CLASS =
  'transition-opacity group-hover:opacity-0 group-focus-within:opacity-0';

function entityInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

/**
 * The rail's unity switcher: the active face opens Chat (conversation home)
 * and a second control opens the teammate picker popover.
 *
 * Expanded, the face sits in a card beside the teammate's name with the picker
 * as a trailing control. Collapsed to a dock there is no room for that, so the
 * picker becomes a hover-revealed corner badge on the face itself; it shares
 * the face's bottom-right corner with the presence badge, which fades out
 * whenever the picker is revealed so only one ever occupies the corner.
 */
export function AssistantSwitcher({
  activeUnity,
  activeEntityFace = null,
  isInitialAssistantIdentityLoading = false,
  listProps,
  collapsed,
  nestedOverlayOpen = false,
  onOpenChat,
  chatActive = false,
  showChatActivity = false,
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
  const presenceClass = cn(PRESENCE_YIELD_CLASS, switcherOpen && 'opacity-0');

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
          className={presenceClass}
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
        className={presenceClass}
        testId={`rail-status-indicator-${activeUnity.agentId}`}
      />
    </span>
  ) : (
    <span className="rounded-control grid h-9 w-9 shrink-0 place-items-center bg-card text-muted-foreground">
      ?
    </span>
  );

  const switcherTrigger = (
    <PopoverTrigger asChild>
      <button
        type="button"
        data-testid="rail-unity-switcher"
        title={collapsed ? `Switch teammate (${unityName})` : undefined}
        aria-label={`Switch teammate — ${unityName}`}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          collapsed ? 'mx-auto h-9 w-9' : 'h-8 w-8'
        )}
      >
        <ChevronsUpDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </PopoverTrigger>
  );

  const chatHomeButton = (
    <button
      type="button"
      data-testid="rail-chat-home"
      onClick={onOpenChat}
      aria-current={chatActive ? 'page' : undefined}
      aria-label={collapsed ? `Chat with ${unityName}` : undefined}
      title={collapsed ? `Chat with ${unityName}` : undefined}
      className={cn(
        'relative flex items-center gap-3 transition-colors',
        collapsed
          ? cn(
              'rounded-xl p-1.5',
              chatActive ? 'bg-accent-soft text-accent-soft-foreground' : 'hover:bg-muted'
            )
          : cn(
              'min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left',
              chatActive ? 'bg-accent-soft/70' : 'hover:bg-muted/70'
            )
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
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate font-display text-[14.5px] font-semibold">{unityName}</div>
            {unitySub ? (
              <div className="truncate text-[11.5px] capitalize text-muted-foreground">
                {unitySub}
              </div>
            ) : null}
          </div>
        ))}
      {showChatActivity && (
        <span
          className={cn(
            'animate-rail-activity-dot h-2 w-2 shrink-0 rounded-full bg-primary ring-1 ring-primary-tint-30',
            collapsed ? 'absolute right-1 top-1' : 'ml-1'
          )}
          aria-hidden="true"
          data-testid="rail-chat-home-activity-dot"
        />
      )}
    </button>
  );

  return (
    <Popover open={switcherOpen} onOpenChange={handleOpenChange}>
      {collapsed ? (
        <div className="group relative mx-auto mb-2 w-fit">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>{chatHomeButton}</TooltipTrigger>
              <TooltipContent side="right">
                <p>Chat · {unityName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="rail-unity-switcher"
              title={`Switch teammate (${unityName})`}
              aria-label={`Switch teammate — ${unityName}`}
              className="absolute bottom-0.5 right-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground opacity-0 ring-1 ring-border transition-opacity hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <ChevronsUpDown className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </div>
      ) : (
        <div className="mx-3.5 mb-2 flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1.5">
          {chatHomeButton}
          <PopoverTrigger asChild>
            <button
              type="button"
              data-testid="rail-unity-switcher"
              aria-label={`Switch teammate — ${unityName}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronsUpDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </div>
      )}
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
