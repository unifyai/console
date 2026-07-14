'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreatureAvatar, parseCreatureSentinel } from '@/components/Brand';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/popover';
import { Skeleton } from '@/components/UI/skeleton';
import { assistantDisplayName, assistantInitials } from '@/lib/assistants/displayName';
import { CoordinatorLogoAvatar } from '@/components/Pages/Assistants/CoordinatorLogoAvatar';
import { AssistantPresenceIndicator } from '@/components/Pages/Assistants/Common/AssistantPresenceIndicator';
import { PresenceStatusDot } from '@/components/Pages/Assistants/Common/PresenceStatusDot';
import { TeamAvatar } from '@/components/Pages/Assistants/OrgChat/TeamAvatar';
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

/** Face override for non-assistant selections (a human member or a team). */
export interface ActiveEntityFace {
  kind: 'human' | 'team';
  label: string;
  sublabel?: string | null;
  imageUrl?: string | null;
  online?: boolean;
  /** Managed org-wide team — render the fixed Org glyph instead of initials. */
  isOrgWideSharing?: boolean;
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
 * The rail's unity switcher: a card showing the active unity that opens a
 * popover hosting the full `AssistantList` for picking/hiring. The popover
 * stays open on selection; dismiss via outside click or Escape.
 */
export function AssistantSwitcher({
  activeUnity,
  activeEntityFace = null,
  isInitialAssistantIdentityLoading = false,
  listProps,
  collapsed,
}: AssistantSwitcherProps) {
  const [switcherOpen, setSwitcherOpen] = React.useState(false);

  const showSkeletonFace = !activeUnity && !activeEntityFace && isInitialAssistantIdentityLoading;
  const unityName = activeEntityFace
    ? activeEntityFace.label
    : activeUnity
      ? assistantDisplayName(activeUnity)
      : 'Select a teammate';
  const unitySub = activeEntityFace
    ? (activeEntityFace.sublabel ?? (activeEntityFace.kind === 'team' ? 'Team' : 'Team member'))
    : activeUnity
      ? activeUnity.isCoordinator
        ? null
        : activeUnity.jobTitle?.trim() || 'Digital twin'
      : 'No teammate selected';
  const activeUnityStatus = activeUnity
    ? listProps.assistantStatuses.get(activeUnity.agentId) || null
    : null;

  return (
    <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="rail-unity-switcher"
          title={collapsed ? unityName : undefined}
          className={cn(
            'flex items-center gap-3 transition-colors',
            collapsed
              ? 'mx-auto mb-2 rounded-xl p-1.5 hover:bg-muted'
              : 'mx-3.5 mb-2 rounded-xl border border-border bg-card px-3 py-2 hover:bg-muted'
          )}
        >
          {showSkeletonFace ? (
            <Skeleton
              data-testid="rail-unity-switcher-skeleton"
              className={cn(
                'rounded-control shrink-0',
                collapsed ? 'h-10 w-10' : 'h-[38px] w-[38px]'
              )}
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
              ) : (
                <Avatar
                  className={cn(
                    'rounded-control shrink-0',
                    collapsed ? 'h-10 w-10' : 'h-[38px] w-[38px]'
                  )}
                >
                  <AvatarImage
                    src={activeEntityFace.imageUrl ?? undefined}
                    alt={activeEntityFace.label}
                  />
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
                testId={`rail-status-indicator-${activeUnity.agentId}`}
              />
            </span>
          ) : (
            <span className="rounded-control grid h-9 w-9 shrink-0 place-items-center bg-card text-muted-foreground">
              ?
            </span>
          )}
          {!collapsed && (
            <>
              {showSkeletonFace ? (
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ) : (
                <div className="min-w-0 text-left">
                  <div className="truncate font-display text-[14.5px] font-semibold">
                    {unityName}
                  </div>
                  {unitySub ? (
                    <div className="truncate text-[11.5px] capitalize text-muted-foreground">
                      {unitySub}
                    </div>
                  ) : null}
                </div>
              )}
              <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        data-testid="rail-unity-switcher-popover"
        className="flex h-[70vh] max-h-[560px] w-[320px] flex-col overflow-hidden p-0"
      >
        <AssistantList {...listProps} isFolded={false} onToggleFold={undefined} />
      </PopoverContent>
    </Popover>
  );
}
