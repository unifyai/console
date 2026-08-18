'use client';

import * as React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RAIL_GUTTER,
  RAIL_ROW_PAD,
  RAIL_ROW_SHELL,
  RAIL_SWITCHER_GLYPH,
  RAIL_SWITCHER_SLOT,
  RAIL_TRAILING_INSET,
  RailTrailingButton,
} from '@/components/Layout/Shell/railGeometry';
import { CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { useAssistantInfoPanelVisibility } from '@/hooks/Assistants/useAssistantInfoPanelVisibility';
import { requestAssistantInfoPanelToggle } from '@/lib/assistants/infoPanelVisibility';
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
  groupIcon?: string | null;
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
  /** Open the current selection's home surface (profile, thread, voice, share). */
  onOpenChat?: () => void;
  /** Whether that home surface is the active rail section. */
  chatActive?: boolean;
  /** Unread pulse on the face while another section is selected. */
  showChatActivity?: boolean;
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
 * The rail's unity switcher: two controls that never trade places. The face
 * stays on one teammate — it opens their home surface, then their profile once
 * that surface is already open — while a chevron beside it (expanded) or
 * beneath it (collapsed) is the only way to a different teammate. The chevron
 * is always drawn — never hover-revealed — and never occupies the face's
 * bottom-right corner, so the presence badge stays legible while reaching for
 * either control.
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

  const infoPanelVisibility = useAssistantInfoPanelVisibility();
  const selectionId = listProps.profileAssistantId;
  const isProfileOpen =
    !!selectionId && infoPanelVisibility?.assistantId === selectionId && infoPanelVisibility.isOpen;

  // Radix exempts only the chevron — the popover's actual trigger — from
  // outside-dismiss, so a pointerdown on the face closes an open picker before
  // the face's own click lands. Read the pre-dismiss state so that press is
  // spent on the dismissal instead of also reaching the profile.
  const pickerWasOpenRef = React.useRef(false);
  const handleFacePointerDown = React.useCallback(() => {
    pickerWasOpenRef.current = switcherOpen;
  }, [switcherOpen]);

  const handleFaceClick = React.useCallback(() => {
    // One errand at two depths: from elsewhere the face lands on this
    // teammate's surface, and from there it opens who they are. Reaching a
    // different teammate stays with the chevron.
    if (!chatActive) {
      onOpenChat?.();
      return;
    }
    if (pickerWasOpenRef.current || !selectionId) return;
    requestAssistantInfoPanelToggle({ assistantId: selectionId });
  }, [chatActive, onOpenChat, selectionId]);

  /**
   * Picking a teammate is the whole errand, so the list dismisses itself on the
   * way out and leaves the answer on the face behind it. The list's other exits
   * stay open on purpose: the info disclosure is read in place, and hire /
   * create-group raise a nested overlay this popover deliberately sits behind.
   */
  const { onShowProfile, onSelectHuman, onSelectTeam, onSelectGroup } = listProps;
  const selectionProps = React.useMemo(() => {
    const dismissThen =
      <Args extends unknown[]>(select: (...args: Args) => void) =>
      (...args: Args) => {
        setSwitcherOpen(false);
        select(...args);
      };
    return {
      onShowProfile: dismissThen(onShowProfile),
      onSelectHuman: onSelectHuman && dismissThen(onSelectHuman),
      onSelectTeam: onSelectTeam && dismissThen(onSelectTeam),
      onSelectGroup: onSelectGroup && dismissThen(onSelectGroup),
    };
  }, [onShowProfile, onSelectHuman, onSelectTeam, onSelectGroup]);

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
  const profileActionLabel = isProfileOpen ? 'Hide profile' : 'Show profile';

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
        <GroupFaceStack
          members={activeEntityFace.groupFaces ?? []}
          icon={activeEntityFace.groupIcon}
          iconClassName="text-xl"
          sizeClassName="h-10 w-10"
        />
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
        inCall={activeUnityInCall}
        testId={`rail-status-indicator-${activeUnity.agentId}`}
      />
    </span>
  ) : (
    <span className="rounded-control grid h-9 w-9 shrink-0 place-items-center bg-card text-muted-foreground">
      ?
    </span>
  );

  const homeButton = (
    <button
      type="button"
      data-testid="rail-chat-home"
      onPointerDown={handleFacePointerDown}
      onClick={handleFaceClick}
      aria-current={chatActive ? 'page' : undefined}
      aria-haspopup={chatActive ? 'dialog' : undefined}
      aria-expanded={chatActive ? isProfileOpen : undefined}
      aria-label={chatActive ? `${profileActionLabel} — ${unityName}` : `Open ${unityName}`}
      className={cn(
        'relative flex items-center transition-colors',
        collapsed
          ? 'rounded-lg p-1.5'
          : // `pr-11` clears the picker, which sits in the row's trailing slot
            // rather than in a bordered strip of its own.
            cn(RAIL_ROW_SHELL, RAIL_ROW_PAD, 'py-1.5 pr-11 text-left'),
        chatActive ? 'bg-accent-soft text-accent-soft-foreground' : 'hover:bg-muted'
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
            <div className="text-h3 truncate">{unityName}</div>
            {unitySub ? (
              <div className="text-caption-sm truncate capitalize">{unitySub}</div>
            ) : null}
          </div>
        ))}
      {showChatActivity && (
        <span
          className={cn(
            'animate-rail-activity-dot h-2 w-2 shrink-0 rounded-full bg-primary ring-1 ring-primary-tint-30',
            // Top-right: the face's bottom-right corner belongs to presence.
            collapsed ? 'absolute right-1 top-1' : 'ml-auto'
          )}
          aria-hidden="true"
          data-testid="rail-chat-home-activity-dot"
        />
      )}
    </button>
  );

  /**
   * The teammate picker and the workspace picker are the same errand, so they
   * are the same control: one square, one glyph size, one inset.
   */
  const pickerButton = (
    <PopoverTrigger asChild>
      <RailTrailingButton
        data-testid="rail-unity-switcher"
        title={collapsed ? `Switch teammate (${unityName})` : undefined}
        aria-label={`Switch teammate — ${unityName}`}
        className={cn(
          RAIL_SWITCHER_SLOT,
          !collapsed && cn('absolute top-1/2 -translate-y-1/2', RAIL_TRAILING_INSET)
        )}
      >
        <ChevronsUpDown className={RAIL_SWITCHER_GLYPH} strokeWidth={1.75} aria-hidden="true" />
      </RailTrailingButton>
    </PopoverTrigger>
  );

  return (
    <Popover open={switcherOpen} onOpenChange={handleOpenChange}>
      {/* The gutter lives here rather than on the row, so the row's fill starts
          where every other filled row in the rail starts. */}
      <div className={cn('mb-2', !collapsed && RAIL_GUTTER)}>
        {collapsed ? (
          <div className="mx-auto flex w-fit flex-col items-center gap-0.5">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>{homeButton}</TooltipTrigger>
                <TooltipContent side="right">
                  <p>{unityName}</p>
                  {chatActive ? (
                    <p className="text-caption-sm text-muted-foreground">{profileActionLabel}</p>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {pickerButton}
          </div>
        ) : (
          /* Siblings rather than nested, since both are triggers; the picker
             overlays the row's trailing slot the way a nav row's pin does. */
          <div className="relative">
            {chatActive ? (
              // The row already reads as itself, so this hint waits out a pass
              // through the rail and only names the press that isn't obvious.
              <TooltipProvider delayDuration={400}>
                <Tooltip>
                  <TooltipTrigger asChild>{homeButton}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{profileActionLabel}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              homeButton
            )}
            {pickerButton}
          </div>
        )}
      </div>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        data-testid="rail-unity-switcher-popover"
        className="flex h-[70vh] max-h-[560px] w-[258px] flex-col overflow-hidden p-0"
        onInteractOutside={(event) => {
          if (nestedOverlayOpen) event.preventDefault();
        }}
        onFocusOutside={(event) => {
          if (nestedOverlayOpen) event.preventDefault();
        }}
      >
        <AssistantList
          {...listProps}
          {...selectionProps}
          isFolded={false}
          onToggleFold={undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
