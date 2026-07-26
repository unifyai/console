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
 * The rail's unity switcher: the active face opens Chat (conversation home);
 * ChevronsUpDown opens the teammate picker popover.
 */
export function AssistantSwitcher({
  activeUnity,
  activeEntityFace = null,
  isInitialAssistantIdentityLoading = false,
  listProps,
  nestedOverlayOpen = false,
  onOpenChat,
  chatActive = false,
  showChatActivity = false,
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
  const activeUnityStatus = activeUnity
    ? listProps.assistantStatuses.get(activeUnity.agentId) || null
    : null;

  const face = showSkeletonFace ? (
    <Skeleton
      data-testid="rail-unity-switcher-skeleton"
      className="rounded-control h-10 w-10 shrink-0"
    />
  ) : activeEntityFace ? (
    <span className="relative shrink-0">
      {activeEntityFace.kind === 'team' ? (
        <TeamAvatar
          name={activeEntityFace.label}
          imageUrl={activeEntityFace.imageUrl}
          isOrgWideSharing={activeEntityFace.isOrgWideSharing}
          className="h-10 w-10"
          iconClassName="h-5 w-5"
        />
      ) : activeEntityFace.kind === 'group' ? (
        <GroupFaceStack members={activeEntityFace.groupFaces ?? []} sizeClassName="h-10 w-10" />
      ) : (
        <Avatar className="rounded-control h-10 w-10 shrink-0">
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
      <UnityAvatar assistant={activeUnity} sizeClass="h-10 w-10" />
      <AssistantPresenceIndicator
        status={activeUnityStatus}
        testId={`rail-status-indicator-${activeUnity.agentId}`}
      />
    </span>
  ) : (
    <span className="rounded-control grid h-9 w-9 shrink-0 place-items-center bg-card text-muted-foreground">
      ?
    </span>
  );

  const chatHomeButton = (
    <button
      type="button"
      data-testid="rail-chat-home"
      onClick={onOpenChat}
      aria-current={chatActive ? 'page' : undefined}
      aria-label={`Chat with ${unityName}`}
      title={`Chat with ${unityName}`}
      className={cn(
        'relative mx-auto rounded-xl p-1.5 transition-colors',
        chatActive ? 'bg-accent-soft text-accent-soft-foreground' : 'hover:bg-muted'
      )}
    >
      {face}
      {showChatActivity && (
        <span
          className="animate-rail-activity-dot absolute right-1 top-1 h-2 w-2 shrink-0 rounded-full bg-primary ring-1 ring-primary-tint-30"
          aria-hidden="true"
          data-testid="rail-chat-home-activity-dot"
        />
      )}
    </button>
  );

  return (
    <Popover open={switcherOpen} onOpenChange={handleOpenChange}>
      <div className="mb-2 flex flex-col items-center gap-1">
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
            className="mx-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronsUpDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </PopoverTrigger>
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
