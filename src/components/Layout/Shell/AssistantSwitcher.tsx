'use client';

import * as React from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/UI/dialog';
import { Skeleton } from '@/components/UI/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { assistantDisplayName, assistantInitials } from '@/lib/assistants/displayName';
import { ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT } from '@/lib/assistants/infoPanelVisibility';
import { groupEntityKey, humanEntityKey, teamEntityKey } from '@/lib/assistants/selectedEntity';
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
   * When true, the picker stays open through focus/pointer moves into a nested
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
 * opens the selection's home surface; a chevron beside it (expanded) or beneath
 * it (collapsed) opens the teammate picker. The chevron is always drawn — never
 * hover-revealed — and never occupies the face's bottom-right corner, so the
 * presence badge stays legible while reaching for either control.
 *
 * The picker is a full-page dialog rather than a rail-anchored popover: the
 * roster carries assistants, teams, group chats and colleagues at once, which
 * outgrew a 320px column long ago. The roster itself stays a single readable
 * column centred on that page — widening the rows would only stretch the gap
 * between a face and its trailing controls.
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

  const handleFaceClick = React.useCallback(() => {
    // The face has nowhere left to go once its own surface is open, so it falls
    // through to the picker rather than spending a click on nothing. The open
    // picker covers the rail, so the same click can never arrive twice — it
    // lands on the backdrop and dismisses.
    if (!chatActive) {
      onOpenChat?.();
      return;
    }
    setSwitcherOpen(true);
  }, [chatActive, onOpenChat]);

  /**
   * The profile panel the info toggle reveals lives on the page behind this
   * one, so the picker gets out of its way. Human and group rows raise the
   * panel through the window event rather than a prop, so listening for the
   * request covers every row shape at once.
   */
  React.useEffect(() => {
    if (!switcherOpen) return;
    const dismiss = () => setSwitcherOpen(false);
    window.addEventListener(ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT, dismiss);
    return () => window.removeEventListener(ASSISTANT_INFO_PANEL_TOGGLE_REQUEST_EVENT, dismiss);
  }, [switcherOpen]);

  /**
   * Moving the selection is the whole errand, so the list dismisses itself on
   * the way out and leaves the answer on the face behind it. Re-picking the row
   * that is already current moves nothing, and that row is the only one wearing
   * a `ListRowInfoToggle` — dismissing there would take the profile control off
   * screen at the moment it appears. Hire and create-group stay open for a
   * related reason: they raise a nested overlay this page deliberately sits
   * behind, and dismissing it would strand them over a closed rail.
   */
  const {
    onShowProfile,
    onSelectHuman,
    onSelectTeam,
    onSelectGroup,
    profileAssistantId,
    selectedEntityKey,
  } = listProps;
  const selectionProps = React.useMemo(() => {
    const dismissUnlessCurrent =
      <Args extends unknown[]>(
        select: (...args: Args) => void,
        isCurrent: (...args: Args) => boolean
      ) =>
      (...args: Args) => {
        if (!isCurrent(...args)) setSwitcherOpen(false);
        select(...args);
      };
    return {
      onShowProfile: dismissUnlessCurrent(onShowProfile, (id: string) => id === profileAssistantId),
      onSelectHuman:
        onSelectHuman &&
        dismissUnlessCurrent(
          onSelectHuman,
          (userId: string) => humanEntityKey(userId) === selectedEntityKey
        ),
      onSelectTeam:
        onSelectTeam &&
        dismissUnlessCurrent(
          onSelectTeam,
          (teamId: number) => teamEntityKey(teamId) === selectedEntityKey
        ),
      onSelectGroup:
        onSelectGroup &&
        dismissUnlessCurrent(
          onSelectGroup,
          (groupId: number) => groupEntityKey(groupId) === selectedEntityKey
        ),
    };
  }, [
    onShowProfile,
    onSelectHuman,
    onSelectTeam,
    onSelectGroup,
    profileAssistantId,
    selectedEntityKey,
  ]);

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

  const homeButton = (
    <button
      type="button"
      data-testid="rail-chat-home"
      onClick={handleFaceClick}
      aria-current={chatActive ? 'page' : undefined}
      aria-haspopup={chatActive ? 'dialog' : undefined}
      aria-expanded={chatActive ? switcherOpen : undefined}
      aria-label={collapsed ? `Open ${unityName}` : undefined}
      className={cn(
        'relative flex items-center transition-colors',
        collapsed
          ? cn(
              'rounded-xl p-1.5',
              chatActive ? 'bg-accent-soft text-accent-soft-foreground' : 'hover:bg-muted'
            )
          : cn(
              'min-w-0 flex-1 gap-2 rounded-l-xl px-2 py-1.5 text-left',
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
          <div className="min-w-0 flex-1">
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
            // Top-right: the face's bottom-right corner belongs to presence.
            collapsed ? 'absolute right-1 top-1' : 'ml-1'
          )}
          aria-hidden="true"
          data-testid="rail-chat-home-activity-dot"
        />
      )}
    </button>
  );

  /**
   * Sized for touch as well as pointer: the mobile rail renders expanded inside
   * a drawer, so the expanded trigger stretches to the card's full height and
   * the collapsed strip is wider than the glyph it carries.
   */
  const pickerButton = (
    <DialogTrigger asChild>
      <button
        type="button"
        data-testid="rail-unity-switcher"
        title={collapsed ? `Switch teammate (${unityName})` : undefined}
        aria-label={`Switch teammate — ${unityName}`}
        className={cn(
          'flex shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          collapsed
            ? 'h-5 w-11 rounded-md'
            : 'w-11 self-stretch rounded-r-xl border-l border-border'
        )}
      >
        <ChevronsUpDown
          className={cn('shrink-0', collapsed ? 'h-3.5 w-3.5' : 'h-4 w-4')}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>
    </DialogTrigger>
  );

  return (
    <Dialog open={switcherOpen} onOpenChange={handleOpenChange}>
      {/* The horizontal inset lives here rather than as margins on the card so
          the card can span the rail like the account switcher below it;
          margins left it hugging its content. */}
      <div className={cn('mb-2', !collapsed && 'px-3.5')}>
        {collapsed ? (
          <div className="mx-auto flex w-fit flex-col items-center gap-0.5">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>{homeButton}</TooltipTrigger>
                <TooltipContent side="right">
                  <p>{unityName}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {pickerButton}
          </div>
        ) : (
          <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-card">
            {homeButton}
            {pickerButton}
          </div>
        )}
      </div>
      <DialogContent
        data-testid="rail-unity-switcher-dialog"
        className="!flex !h-[98vh] !w-[98vw] !max-w-[98vw] !flex-col !gap-0 !overflow-hidden !bg-background !p-0"
        onInteractOutside={(event) => {
          if (nestedOverlayOpen) event.preventDefault();
        }}
        onFocusOutside={(event) => {
          if (nestedOverlayOpen) event.preventDefault();
        }}
      >
        {/* Right padding clears the dialog's own close control. */}
        <div className="flex shrink-0 flex-col gap-1 border-b border-border px-6 py-4 pr-14">
          <DialogTitle className="text-h2">Switch teammate</DialogTitle>
          <DialogDescription>Open a teammate, team, or group chat.</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 px-4 pb-6 pt-5">
          <div className="mx-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-pop-lg">
            <AssistantList
              {...listProps}
              {...selectionProps}
              isFolded={false}
              onToggleFold={undefined}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
