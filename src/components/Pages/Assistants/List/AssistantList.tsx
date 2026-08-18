import * as React from 'react';
import { Input } from '@/components/UI/input';
import { ScrollArea } from '@/components/UI/scroll-area';
import {
  Search,
  WifiOff,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  UsersRound,
  MessagesSquare,
  MousePointer2,
  User,
  UserPlus,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Plus,
} from 'lucide-react';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { AssistantListItem } from './AssistantListItem';
import { AssistantListItemSkeleton } from './AssistantListItemSkeleton';
import { Button } from '@/components/UI/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import {
  type CoordinatorWorkspaceScope,
  resolveCanonicalWorkspaceCoordinator,
} from '@/lib/assistants/coordinatorIdentity';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';
import { groupEntityKey, humanEntityKey, teamEntityKey } from '@/lib/assistants/selectedEntity';
import type { RosterGroup, RosterHuman, RosterTeam } from '@/types/orgChat';
import type { SharedTeamSummary } from '@/types/teams/sharedTeam';
import { AssistantListGroupHeader } from './AssistantListGroupHeader';
import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';
import {
  groupAssistantsByTeam,
  type AssistantListEntry,
  type AssistantListGroup,
} from './assistantListGroups';
import { profileAvatarTone, profileInitials } from '@/utils/user/profileDisplay';
import { formatRealVirtualSubtitle } from '@/utils/orgChat/memberSubtitle';
import { TeamAvatar } from '@/components/Pages/Assistants/OrgChat/TeamAvatar';
import { GroupFaceStack } from '@/components/Pages/Assistants/OrgChat/GroupFaceStack';
import {
  GroupRowSettings,
  type GroupPatch,
} from '@/components/Pages/Assistants/OrgChat/GroupRowSettings';
import { PresenceStatusDot } from '@/components/Pages/Assistants/Common/PresenceStatusDot';
import { assistantDisplayName } from '@/lib/assistants/displayName';
import {
  useAssistantListFilters,
  type AssistantListFilterId,
} from '@/hooks/Assistants/useAssistantListFilters';

const LIST_GROUP_FOLDS_STORAGE_KEY = 'console:assistants:listGroupFolds';

function OnboardPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4.5v15M4.5 12h15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2.4}
      />
    </svg>
  );
}

interface AssistantListProps {
  assistants: Assistant[];
  assistantStatuses: Map<string, AssistantStatus | null>;
  assistantError: string | null;
  isLoading: boolean;
  error: string | null;
  profileAssistantId: string | null;
  onShowProfile: (id: string) => void;
  onOpenHireDialog: () => void;
  isFolded: boolean;
  activeCallAssistantId: string | null;
  /** Whether the current user can hire new assistants (org Owner in org context, anyone in personal workspace) */
  canHire?: boolean;
  onToggleFold?: () => void;
  /**
   * Per-assistant unread message counts driven by the page-level inbox
   * multiplex stream. A missing key or `0` means no badge is shown.
   */
  unreadCounts?: Record<string, number>;
  currentUserId?: string | null;
  workspace: CoordinatorWorkspaceScope;
  teamsById: Record<number, SharedTeamSummary>;
  /** Org human members shown in the People section (with presence dots). */
  humans?: RosterHuman[];
  /** Org teams rendered as selectable rows (group chat entry points). */
  selectableTeams?: RosterTeam[];
  /** Org chat groups rendered as flat selectable rows. */
  selectableGroups?: RosterGroup[];
  /** The full selection key — `human:{id}` / `team:{id}` / `group:{id}` for non-assistants. */
  selectedEntityKey?: string | null;
  onSelectHuman?: (userId: string) => void;
  onSelectTeam?: (teamId: number) => void;
  onSelectGroup?: (groupId: number) => void;
  /** Saves a group's own settings (name, icon); resolves false when it failed. */
  onUpdateGroup?: (groupId: number, patch: GroupPatch) => Promise<boolean>;
  /** Raised while a group's settings panel is open, so the switcher stays put. */
  onGroupSettingsOpenChange?: (open: boolean) => void;
  onCreateGroup?: () => void;
  /** Navigate to Organization → Teams to create a custom team. */
  onCreateTeam?: () => void;
  /** Unread counts keyed by entity key (`team:{id}` / `human:{userId}` / `group:{id}`). */
  entityUnreadCounts?: Record<string, number>;
  /** User ids currently joined on the active org call (list ping badge). */
  orgCallActiveUserIds?: ReadonlySet<string> | string[];
  /** Team id of the active org team call (list ping badge). */
  orgCallActiveTeamId?: number | null;
  /** Group id of the active org group call (list ping badge). */
  orgCallActiveGroupId?: number | null;
}

function EntityUnreadBadge({ count, testId }: { count: number; testId: string }) {
  if (count <= 0) return null;
  return (
    <span
      data-testid={testId}
      className="flex h-4 min-w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
    >
      {count > 99 ? '99+' : String(count)}
    </span>
  );
}

function HumanListRow({
  human,
  isSelected,
  isYou,
  unreadCount,
  isCallActive,
  onSelect,
}: {
  human: RosterHuman;
  isSelected: boolean;
  isYou: boolean;
  unreadCount: number;
  isCallActive?: boolean;
  onSelect: () => void;
}) {
  const displayName = human.name?.trim() || human.email || human.userId;
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`human-list-item-${human.userId}`}
      className={cn(
        'group flex w-full min-w-0 cursor-pointer items-center justify-between rounded-lg border border-transparent px-2 py-1 transition-colors',
        !isSelected && 'hover:bg-[var(--surface-hover)]',
        isSelected && 'bg-accent-soft'
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect();
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="relative">
          <Avatar className="rounded-control h-7 w-7 flex-shrink-0">
            <AvatarImage src={human.image ?? undefined} alt={displayName} />
            <AvatarFallback
              className="rounded-control text-semibold text-primary-foreground"
              style={{ backgroundColor: profileAvatarTone(displayName) }}
            >
              {profileInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          {isCallActive ? (
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
          ) : (
            <PresenceStatusDot
              online={human.online}
              testId={`human-status-indicator-${human.userId}`}
            />
          )}
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
            {isYou ? <span className="text-caption text-muted-foreground">(you)</span> : null}
          </div>
          {human.roleName ? (
            <p className="text-caption truncate leading-tight text-muted-foreground">
              {human.roleName}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <EntityUnreadBadge count={unreadCount} testId={`human-unread-badge-${human.userId}`} />
      </div>
    </div>
  );
}

function GroupListRow({
  group,
  faceMembers,
  isSelected,
  unreadCount,
  isCallActive,
  onSelect,
  onUpdate,
  onSettingsOpenChange,
}: {
  group: RosterGroup;
  faceMembers: Array<{ id: string; name: string; image?: string | null }>;
  isSelected: boolean;
  unreadCount: number;
  isCallActive?: boolean;
  onSelect: () => void;
  onUpdate?: (patch: GroupPatch) => Promise<boolean>;
  onSettingsOpenChange?: (open: boolean) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`group-list-item-${group.groupId}`}
      className={cn(
        'group flex w-full min-w-0 cursor-pointer items-center justify-between rounded-lg border border-transparent px-2 py-1 transition-colors',
        !isSelected && 'hover:bg-[var(--surface-hover)]',
        isSelected && 'bg-accent-soft'
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect();
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="relative">
          <GroupFaceStack members={faceMembers} icon={group.icon} sizeClassName="h-7 w-7" />
          {isCallActive ? (
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          <span
            className={cn(
              'text-body text-strong truncate',
              isSelected && 'text-accent-soft-foreground'
            )}
          >
            {group.name}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <EntityUnreadBadge count={unreadCount} testId={`group-unread-badge-${group.groupId}`} />
        {onUpdate ? (
          <GroupRowSettings group={group} onUpdate={onUpdate} onOpenChange={onSettingsOpenChange} />
        ) : null}
      </div>
    </div>
  );
}

function TeamChatListRow({
  team,
  isSelected,
  unreadCount,
  isCallActive,
  onSelect,
}: {
  team: RosterTeam;
  isSelected: boolean;
  unreadCount: number;
  isCallActive?: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Select ${team.name}`}
      data-testid={`team-chat-list-item-${team.teamId}`}
      className={cn(
        'group flex w-full min-w-0 cursor-pointer items-center justify-between rounded-lg border border-transparent px-2 py-1 transition-colors',
        !isSelected && 'hover:bg-[var(--surface-hover)]',
        isSelected && 'bg-accent-soft'
      )}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect();
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {/*
         * The selection glyph is the team's own face wearing a cursor, rather
         * than a drawn square wearing one: the icon keeps the composition of
         * `SquareMousePointer` — pointer at the lower-right of a square — while
         * the square carries the team's colour instead of neutral chrome.
         */}
        <div className="relative">
          <TeamAvatar
            name={team.name}
            imageUrl={team.image}
            isOrgWideSharing={team.isOrgWideSharing}
            className="h-7 w-7"
            iconClassName="h-4 w-4"
          />
          {isCallActive ? (
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
          ) : (
            // The corner is the call indicator's while a call runs; the pointer
            // stands down rather than stacking two marks in one spot.
            <span
              className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-border bg-background text-foreground"
              aria-hidden="true"
            >
              <MousePointer2 className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <span
            className={cn(
              'text-body text-strong truncate',
              isSelected && 'text-accent-soft-foreground'
            )}
          >
            Select team
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <EntityUnreadBadge count={unreadCount} testId={`team-unread-badge-${team.teamId}`} />
      </div>
    </div>
  );
}

function TeamListRow({
  team,
  isSelected,
  unreadCount,
  isCallActive,
  isFoldedGroup,
  onToggleFold,
}: {
  team: RosterTeam;
  isSelected: boolean;
  unreadCount: number;
  isCallActive?: boolean;
  isFoldedGroup?: boolean;
  onToggleFold?: () => void;
}) {
  const subtitle = formatRealVirtualSubtitle(team.memberUserIds, team.assistantMemberIds.length);
  const FoldIcon = isFoldedGroup ? ChevronRight : ChevronDown;
  // The header is a pure disclosure control; the team itself is selected from a
  // row inside the nest. Selection surfaces here only while folded, where that
  // row is hidden.
  const showsSelection = isSelected && isFoldedGroup === true;
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`team-list-item-${team.teamId}`}
      aria-expanded={onToggleFold ? !isFoldedGroup : undefined}
      className={cn(
        // Match AssistantListItem padding/gap so the team face shares the
        // same avatar column (center-aligned with T-W1N above).
        'group flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-1 transition-colors',
        // Neutral hover, matching the disclosure role: the primary-tinted hover
        // is reserved for rows that navigate, so the container header must not
        // signal navigability harder than the destinations nested under it.
        showsSelection ? 'bg-accent-soft' : 'hover:bg-[var(--surface-hover)]'
      )}
      onClick={() => onToggleFold?.()}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onToggleFold?.();
      }}
    >
      <TeamAvatar
        name={team.name}
        imageUrl={team.image}
        isOrgWideSharing={team.isOrgWideSharing}
        className="h-7 w-7"
        iconClassName="h-4 w-4"
      />
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            'text-body text-strong block truncate',
            showsSelection ? 'text-accent-soft-foreground' : 'text-foreground'
          )}
        >
          {team.name}
        </span>
        <span className="text-caption-sm block truncate leading-tight">{subtitle}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {isCallActive ? (
          <span className="relative flex h-2.5 w-2.5" aria-label="In call">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        ) : null}
        <EntityUnreadBadge count={unreadCount} testId={`team-unread-badge-${team.teamId}`} />
        {onToggleFold ? (
          <FoldIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
      </span>
    </div>
  );
}

export function AssistantList({
  assistants,
  assistantStatuses,
  assistantError,
  isLoading,
  error,
  profileAssistantId,
  onShowProfile,
  onOpenHireDialog,
  isFolded,
  activeCallAssistantId,
  canHire = true,
  onToggleFold,
  unreadCounts,
  currentUserId = null,
  workspace,
  teamsById,
  humans,
  selectableTeams,
  selectableGroups,
  selectedEntityKey = null,
  onSelectHuman,
  onSelectTeam,
  onSelectGroup,
  onUpdateGroup,
  onGroupSettingsOpenChange,
  onCreateGroup,
  onCreateTeam,
  entityUnreadCounts,
  orgCallActiveUserIds,
  orgCallActiveTeamId = null,
  orgCallActiveGroupId = null,
}: AssistantListProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [foldedGroups, setFoldedGroups] = React.useState<Record<string, boolean>>({});
  const filters = useAssistantListFilters();
  const showReal = filters.isVisible('real');
  const showVirtual = filters.isVisible('virtual');
  const showTeams = filters.isVisible('teams');
  const showGroups = filters.isVisible('groups');
  // Personal workspaces only list virtual assistants — the list filters and
  // Groups/Colleagues/Teams nesting are org-workspace concepts.
  const isOrgWorkspace = workspace.type === 'organization';
  const includeReal = isOrgWorkspace && showReal;
  const includeVirtual = !isOrgWorkspace || showVirtual;
  const orgCallUserIdSet = React.useMemo(() => {
    if (!orgCallActiveUserIds) return new Set<string>();
    return orgCallActiveUserIds instanceof Set
      ? orgCallActiveUserIds
      : new Set(orgCallActiveUserIds);
  }, [orgCallActiveUserIds]);

  const rosterTeamsById = React.useMemo(() => {
    const byId: Record<number, RosterTeam> = {};
    for (const team of selectableTeams ?? []) {
      byId[team.teamId] = team;
    }
    return byId;
  }, [selectableTeams]);

  const filteredHumans = React.useMemo(() => {
    const allHumans = humans ?? [];
    if (!searchTerm) return allHumans;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allHumans.filter(
      (human) =>
        (human.name && human.name.toLowerCase().includes(lowerSearchTerm)) ||
        (human.email && human.email.toLowerCase().includes(lowerSearchTerm))
    );
  }, [humans, searchTerm]);

  const filteredSelectableTeams = React.useMemo(() => {
    const allTeams = selectableTeams ?? [];
    if (!searchTerm) return allTeams;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allTeams.filter((team) => team.name.toLowerCase().includes(lowerSearchTerm));
  }, [selectableTeams, searchTerm]);

  const filteredSelectableGroups = React.useMemo(() => {
    const allGroups = selectableGroups ?? [];
    if (!searchTerm) return allGroups;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allGroups.filter((group) => group.name.toLowerCase().includes(lowerSearchTerm));
  }, [selectableGroups, searchTerm]);

  const assistantsByAgentId = React.useMemo(() => {
    const byId: Record<string, Assistant> = {};
    for (const assistant of assistants) {
      byId[assistant.agentId] = assistant;
    }
    return byId;
  }, [assistants]);

  const humansById = React.useMemo(() => {
    const byId: Record<string, RosterHuman> = {};
    for (const human of humans ?? []) {
      byId[human.userId] = human;
    }
    return byId;
  }, [humans]);

  const filteredAssistants = React.useMemo(() => {
    if (!searchTerm) return assistants;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return assistants.filter(
      (a) =>
        (a.isCoordinator === true && 'twin'.includes(lowerSearchTerm)) ||
        (a.firstName &&
          a.surname &&
          `${a.firstName} ${a.surname}`.toLowerCase().includes(lowerSearchTerm)) ||
        (a.email && a.email.toLowerCase().includes(lowerSearchTerm))
    );
  }, [assistants, searchTerm]);

  const canonicalCoordinatorId = React.useMemo(
    () =>
      resolveCanonicalWorkspaceCoordinator(filteredAssistants, currentUserId, workspace)?.agentId ??
      null,
    [filteredAssistants, currentUserId, workspace]
  );

  const assistantGroups = React.useMemo(
    () =>
      groupAssistantsByTeam(filteredAssistants, teamsById, {
        pinnedCoordinatorId: canonicalCoordinatorId,
      }),
    [canonicalCoordinatorId, filteredAssistants, teamsById]
  );

  const foldedAssistantRows = React.useMemo(() => {
    if (!isFolded) {
      return { assistants: filteredAssistants, coordinatorCount: 0 };
    }

    const coordinatorRows: Assistant[] = [];
    const regularRows: Assistant[] = [];
    filteredAssistants.forEach((assistant) => {
      if (assistant.isCoordinator && assistant.agentId === canonicalCoordinatorId) {
        coordinatorRows.push(assistant);
      } else {
        regularRows.push(assistant);
      }
    });

    if (coordinatorRows.length === 0) {
      return { assistants: filteredAssistants, coordinatorCount: 0 };
    }

    return {
      assistants: [...coordinatorRows, ...regularRows],
      coordinatorCount: coordinatorRows.length,
    };
  }, [canonicalCoordinatorId, filteredAssistants, isFolded]);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LIST_GROUP_FOLDS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          setFoldedGroups(
            Object.fromEntries(
              Object.entries(parsed).filter((entry): entry is [string, boolean] => {
                return typeof entry[1] === 'boolean';
              })
            )
          );
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistFoldedGroups = React.useCallback((nextFoldedGroups: Record<string, boolean>) => {
    try {
      window.localStorage.setItem(LIST_GROUP_FOLDS_STORAGE_KEY, JSON.stringify(nextFoldedGroups));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleGroupFold = React.useCallback(
    (groupId: string) => {
      setFoldedGroups((current) => {
        const next = {
          ...current,
          [groupId]: !current[groupId],
        };
        persistFoldedGroups(next);
        return next;
      });
    },
    [persistFoldedGroups]
  );

  const canHireNewAssistant = !assistantError;
  // Hide hire button if user doesn't have permission (org members who aren't Owner)
  const showHireButton = canHire;
  const isHireButtonDisabled = isLoading || !canHireNewAssistant;

  const renderOnboardButton = (button: React.ReactElement) =>
    showHireButton ? <BillableActionGuard>{button}</BillableActionGuard> : null;

  const renderAssistantRow = React.useCallback(
    (entry: AssistantListEntry, key: string) => {
      const item = (
        <AssistantListItem
          key={key}
          assistant={entry.assistant}
          status={assistantStatuses.get(entry.assistant.agentId) || null}
          isSelected={profileAssistantId === entry.assistant.agentId}
          onShowProfile={onShowProfile}
          isFolded={isFolded}
          isCallActive={activeCallAssistantId === entry.assistant.agentId}
          unreadCount={unreadCounts?.[entry.assistant.agentId] ?? 0}
          isPrimary={entry.isPrimaryTeamListing}
          alsoInTeamLabels={entry.alsoInTeamLabels}
          isTeamOwned={entry.isTeamOwnedListing ?? false}
        />
      );

      return item;
    },
    [
      activeCallAssistantId,
      assistantStatuses,
      isFolded,
      onShowProfile,
      profileAssistantId,
      unreadCounts,
    ]
  );

  const renderFlatAssistants = React.useCallback(() => {
    const renderedRows: React.ReactNode[] = [];
    const { assistants: sourceAssistants, coordinatorCount } = foldedAssistantRows;
    // Coordinator (T-W1N) stays visible when Virtual is off; other assistants do not.
    const flatAssistants =
      isFolded || includeVirtual
        ? sourceAssistants
        : sourceAssistants.filter(
            (assistant) =>
              assistant.isCoordinator === true || assistant.agentId === canonicalCoordinatorId
          );

    flatAssistants.forEach((assistant, index) => {
      renderedRows.push(
        renderAssistantRow(
          {
            assistant,
            isPrimaryTeamListing: true,
            alsoInTeamLabels: [],
          },
          assistant.agentId
        )
      );

      if (
        isFolded &&
        coordinatorCount > 0 &&
        index === coordinatorCount - 1 &&
        flatAssistants.length > coordinatorCount
      ) {
        renderedRows.push(
          <div
            key="coordinator-divider"
            role="separator"
            aria-orientation="horizontal"
            data-testid="coordinator-divider"
            className="my-1 h-px w-6 bg-border"
          />
        );
      }
    });

    return renderedRows;
  }, [canonicalCoordinatorId, foldedAssistantRows, includeVirtual, isFolded, renderAssistantRow]);

  const renderHumanRows = React.useCallback(
    (teamHumans: RosterHuman[], keyPrefix: string) => {
      if (!onSelectHuman || teamHumans.length === 0) return null;
      return (
        <div className="min-w-0 space-y-1">
          {teamHumans.map((human) => (
            <HumanListRow
              key={`${keyPrefix}:${human.userId}`}
              human={human}
              isSelected={selectedEntityKey === humanEntityKey(human.userId)}
              isYou={human.userId === currentUserId}
              unreadCount={entityUnreadCounts?.[humanEntityKey(human.userId)] ?? 0}
              isCallActive={orgCallUserIdSet.has(human.userId)}
              onSelect={() => onSelectHuman(human.userId)}
            />
          ))}
        </div>
      );
    },
    [currentUserId, entityUnreadCounts, onSelectHuman, orgCallUserIdSet, selectedEntityKey]
  );

  const renderTeamMembers = React.useCallback(
    (groupId: string, teamHumans: RosterHuman[], virtualEntries: AssistantListEntry[]) => {
      const visibleHumans = includeReal && Boolean(onSelectHuman) ? teamHumans : [];
      const visibleVirtual = includeVirtual ? virtualEntries : [];
      if (visibleHumans.length === 0 && visibleVirtual.length === 0) return null;

      return (
        <div
          className="min-w-0 space-y-1 pl-3 pt-1"
          data-testid={`assistant-list-team-members-${groupId}`}
        >
          {visibleHumans.length > 0 ? renderHumanRows(visibleHumans, `${groupId}:real`) : null}
          {visibleVirtual.map((entry) =>
            renderAssistantRow(entry, `${groupId}:virtual:${entry.assistant.agentId}`)
          )}
        </div>
      );
    },
    [includeReal, includeVirtual, onSelectHuman, renderAssistantRow, renderHumanRows]
  );

  const renderRosterTeam = React.useCallback(
    (team: RosterTeam, virtualEntries: AssistantListEntry[]) => {
      const groupId = `team:${team.teamId}`;
      const isGroupFolded = foldedGroups[groupId] === true;
      const memberIds = new Set(team.memberUserIds);
      const teamHumans = filteredHumans.filter((human) => memberIds.has(human.userId));
      const hasMembers =
        (Boolean(onSelectHuman) && teamHumans.length > 0) || virtualEntries.length > 0;
      const hasNested = Boolean(onSelectTeam) || hasMembers;
      const isTeamSelected = selectedEntityKey === teamEntityKey(team.teamId);
      const teamUnreadCount = entityUnreadCounts?.[teamEntityKey(team.teamId)] ?? 0;
      const isTeamCallActive = orgCallActiveTeamId === team.teamId;

      return (
        <div
          key={groupId}
          className="min-w-0 space-y-1"
          data-testid={`assistant-list-group-${groupId}`}
        >
          <TeamListRow
            team={team}
            isSelected={isTeamSelected}
            // Unread and call state roll up to the header only while the nest
            // hides the team selection row that owns them.
            unreadCount={isGroupFolded ? teamUnreadCount : 0}
            isCallActive={isGroupFolded && isTeamCallActive}
            isFoldedGroup={isGroupFolded}
            onToggleFold={hasNested ? () => toggleGroupFold(groupId) : undefined}
          />
          {!isGroupFolded && hasNested ? (
            <>
              {onSelectTeam ? (
                <div className="min-w-0 pl-3 pt-1">
                  <TeamChatListRow
                    team={team}
                    isSelected={isTeamSelected}
                    unreadCount={teamUnreadCount}
                    isCallActive={isTeamCallActive}
                    onSelect={() => onSelectTeam(team.teamId)}
                  />
                </div>
              ) : null}
              {hasMembers ? renderTeamMembers(groupId, teamHumans, virtualEntries) : null}
            </>
          ) : null}
        </div>
      );
    },
    [
      entityUnreadCounts,
      filteredHumans,
      foldedGroups,
      onSelectHuman,
      onSelectTeam,
      orgCallActiveTeamId,
      renderTeamMembers,
      selectedEntityKey,
      toggleGroupFold,
    ]
  );

  const renderGroup = React.useCallback(
    (group: AssistantListGroup) => {
      const isGroupFolded = foldedGroups[group.id] === true;
      const description = group.kind === 'team' ? teamsById[group.teamId]?.description : null;
      const subtitle = group.kind === 'team' ? description?.trim() || 'Shared team' : null;
      return (
        <div
          key={group.id}
          className={cn('min-w-0', group.kind === 'team' && 'space-y-1')}
          data-testid={`assistant-list-group-${group.id}`}
        >
          <AssistantListGroupHeader
            label={group.label}
            isFolded={isGroupFolded}
            onToggleFold={() => toggleGroupFold(group.id)}
            description={description}
            variant={group.kind === 'team' ? 'workspace' : 'section'}
            subtitle={subtitle}
            icon={
              group.kind === 'team' ? (
                <Building2 className="h-4 w-4" aria-hidden="true" />
              ) : undefined
            }
          />
          {!isGroupFolded && group.kind === 'team' ? (
            renderTeamMembers(group.id, [], group.rows)
          ) : !isGroupFolded ? (
            includeVirtual ? (
              <div className="min-w-0 space-y-1 pt-1">
                {group.rows.map((entry) =>
                  renderAssistantRow(entry, `${group.id}:${entry.assistant.agentId}`)
                )}
              </div>
            ) : null
          ) : null}
        </div>
      );
    },
    [
      foldedGroups,
      includeVirtual,
      renderAssistantRow,
      renderTeamMembers,
      teamsById,
      toggleGroupFold,
    ]
  );

  const renderSection = React.useCallback(
    (
      sectionId: string,
      label: string,
      count: number,
      children: React.ReactNode,
      testId: string,
      options: { icon?: React.ReactNode; trailingAction?: React.ReactNode } = {}
    ) => {
      const isSectionFolded = foldedGroups[sectionId] === true;
      return (
        <div key={sectionId} data-testid={testId} className="min-w-0 max-w-full">
          <AssistantListGroupHeader
            label={label}
            isFolded={isSectionFolded}
            onToggleFold={() => toggleGroupFold(sectionId)}
            variant="section"
            icon={options.icon}
            trailingAction={options.trailingAction}
          />
          {!isSectionFolded && <div className="min-w-0 space-y-2 pt-1">{children}</div>}
        </div>
      );
    },
    [foldedGroups, toggleGroupFold]
  );

  const hasNonAssistantRows =
    isOrgWorkspace &&
    (filteredHumans.length > 0 ||
      filteredSelectableTeams.length > 0 ||
      (Boolean(onSelectGroup) && filteredSelectableGroups.length > 0));
  const shouldRenderFlatList =
    isFolded ||
    (!hasNonAssistantRows && assistantGroups.length === 1 && assistantGroups[0].kind === 'solo');
  const pinnedGroup = assistantGroups.find((group) => group.kind === 'pinned');
  const teamGroups = assistantGroups.filter((group) => group.kind === 'team');
  const soloGroup = assistantGroups.find((group) => group.kind === 'solo');
  const soloRows = soloGroup?.rows ?? [];
  const teamRowsById = React.useMemo(() => {
    const byId = new Map<number, AssistantListEntry[]>();
    for (const group of teamGroups) {
      if (group.kind === 'team') byId.set(group.teamId, group.rows);
    }
    return byId;
  }, [teamGroups]);
  // Prefer the roster order, then append any team groups that matched search via
  // assistant name even when the team name itself did not. The managed Org team
  // is elevated out of TEAMS (rendered under T-W1N); only custom teams remain.
  const selectableTeamsForList = React.useMemo(() => {
    if (!isOrgWorkspace || !onSelectTeam) return [] as RosterTeam[];
    const byId = new Map<number, RosterTeam>();
    for (const team of filteredSelectableTeams) {
      byId.set(team.teamId, team);
    }
    for (const group of teamGroups) {
      if (group.kind !== 'team' || byId.has(group.teamId)) continue;
      const rosterTeam = rosterTeamsById[group.teamId];
      if (rosterTeam) byId.set(group.teamId, rosterTeam);
    }
    return Array.from(byId.values());
  }, [filteredSelectableTeams, isOrgWorkspace, onSelectTeam, rosterTeamsById, teamGroups]);
  // The Teams filter hides every team row, the elevated managed team included —
  // leaving that one visible while the rest disappear reads as a bug.
  const elevatedOrgTeam = React.useMemo(
    () =>
      showTeams ? (selectableTeamsForList.find((team) => team.isOrgWideSharing) ?? null) : null,
    [selectableTeamsForList, showTeams]
  );
  const customTeamsForSection = React.useMemo(
    () => selectableTeamsForList.filter((team) => !team.isOrgWideSharing),
    [selectableTeamsForList]
  );
  const customTeamGroups = React.useMemo(
    () =>
      teamGroups.filter((group) => {
        if (group.kind !== 'team') return false;
        return rosterTeamsById[group.teamId]?.isOrgWideSharing !== true;
      }),
    [rosterTeamsById, teamGroups]
  );
  // TEAMS collapses entirely when the only team is the managed Org team.
  // GROUP CHATS only appears once at least one group exists.
  const showTeamsSection =
    isOrgWorkspace &&
    showTeams &&
    (customTeamsForSection.length > 0 || (!onSelectTeam && customTeamGroups.length > 0));
  const showGroupsSection =
    isOrgWorkspace && showGroups && Boolean(onSelectGroup) && filteredSelectableGroups.length > 0;
  // When the managed Org team exists, every human/assistant is already on it —
  // COLLEAGUES would duplicate that roster, so hide the section. Membership is
  // read from the roster rather than the filtered list, so hiding teams does not
  // resurrect a duplicate people section.
  const hasManagedOrgTeam =
    isOrgWorkspace && (selectableTeams ?? []).some((team) => team.isOrgWideSharing);
  const showColleaguesSection =
    isOrgWorkspace &&
    !hasManagedOrgTeam &&
    Boolean(onSelectHuman) &&
    includeReal &&
    filteredHumans.length > 0;
  const showRosterSections = showTeamsSection || showGroupsSection || showColleaguesSection;
  const groupedAssistantList = (
    <div className="w-full min-w-0 max-w-full space-y-3">
      {pinnedGroup || elevatedOrgTeam ? (
        <div className="min-w-0 space-y-1">
          {pinnedGroup ? (
            <div className="min-w-0 space-y-1" data-testid="assistant-list-group-pinned">
              {pinnedGroup.rows.map((entry) =>
                renderAssistantRow(entry, `${pinnedGroup.id}:${entry.assistant.agentId}`)
              )}
            </div>
          ) : null}
          {elevatedOrgTeam ? (
            <div className="min-w-0 space-y-1" data-testid="assistant-list-elevated-org-team">
              {renderRosterTeam(elevatedOrgTeam, teamRowsById.get(elevatedOrgTeam.teamId) ?? [])}
            </div>
          ) : null}
        </div>
      ) : null}
      {showRosterSections ? (
        <div className="min-w-0 max-w-full space-y-2 pt-1">
          {showTeamsSection
            ? renderSection(
                'section:teams',
                'Teams',
                customTeamsForSection.length || customTeamGroups.length,
                <>
                  {customTeamsForSection.length > 0
                    ? customTeamsForSection.map((team) =>
                        renderRosterTeam(team, teamRowsById.get(team.teamId) ?? [])
                      )
                    : customTeamGroups.map(renderGroup)}
                </>,
                'assistant-list-section-teams',
                {
                  icon: <UsersRound className="h-3 w-3" aria-hidden="true" />,
                }
              )
            : null}
          {showGroupsSection
            ? renderSection(
                'section:groups',
                'Group chats',
                filteredSelectableGroups.length,
                <div className="min-w-0 space-y-1">
                  {filteredSelectableGroups.map((group) => {
                    const faceMembers = [
                      ...group.memberUserIds.map((userId) => {
                        const human = humansById[userId];
                        return {
                          id: `u:${userId}`,
                          name:
                            human?.name?.trim() ||
                            human?.email ||
                            (userId === currentUserId ? 'You' : userId),
                          image: human?.image,
                        };
                      }),
                      ...group.assistantMemberIds.map((assistantId) => {
                        const assistant = assistantsByAgentId[String(assistantId)];
                        return {
                          id: `a:${assistantId}`,
                          name: assistant
                            ? assistantDisplayName(assistant)
                            : `Assistant ${assistantId}`,
                          image:
                            assistant?.signedProfilePhotoUrl || assistant?.profilePhoto || null,
                        };
                      }),
                    ];
                    return (
                      <GroupListRow
                        key={`group:${group.groupId}`}
                        group={group}
                        faceMembers={faceMembers}
                        isSelected={selectedEntityKey === groupEntityKey(group.groupId)}
                        unreadCount={entityUnreadCounts?.[groupEntityKey(group.groupId)] ?? 0}
                        isCallActive={orgCallActiveGroupId === group.groupId}
                        onSelect={() => onSelectGroup?.(group.groupId)}
                        onUpdate={
                          onUpdateGroup ? (patch) => onUpdateGroup(group.groupId, patch) : undefined
                        }
                        onSettingsOpenChange={onGroupSettingsOpenChange}
                      />
                    );
                  })}
                </div>,
                'assistant-list-section-groups',
                {
                  icon: <MessagesSquare className="h-3 w-3" aria-hidden="true" />,
                }
              )
            : null}
          {showColleaguesSection
            ? renderSection(
                'section:people',
                'Colleagues',
                filteredHumans.length,
                <div className="min-w-0 space-y-1">
                  {filteredHumans.map((human) => (
                    <HumanListRow
                      key={`human:${human.userId}`}
                      human={human}
                      isSelected={selectedEntityKey === humanEntityKey(human.userId)}
                      isYou={human.userId === currentUserId}
                      unreadCount={entityUnreadCounts?.[humanEntityKey(human.userId)] ?? 0}
                      isCallActive={orgCallUserIdSet.has(human.userId)}
                      onSelect={() => onSelectHuman?.(human.userId)}
                    />
                  ))}
                </div>,
                'assistant-list-section-people',
                {
                  icon: <User className="h-3 w-3" aria-hidden="true" />,
                }
              )
            : null}
        </div>
      ) : null}
      {includeVirtual && soloGroup ? (
        <div className="min-w-0 space-y-1" data-testid="assistant-list-section-solo">
          {soloRows.map((entry) =>
            renderAssistantRow(entry, `${soloGroup.id}:${entry.assistant.agentId}`)
          )}
        </div>
      ) : null}
    </div>
  );

  // Groups and teams are org-workspace concepts, and the callers hand down
  // their callbacks unconditionally — so the workspace gate lives here.
  const createGroupAction = isOrgWorkspace ? onCreateGroup : undefined;
  const createTeamAction = isOrgWorkspace ? onCreateTeam : undefined;
  // Every create action lives behind one "+" in the header. A workspace that
  // offers nothing but onboarding (personal workspaces, and org members who
  // cannot hire) gets the action directly — a menu holding one item is only a
  // slower button.
  const createActionCount =
    (createGroupAction ? 1 : 0) + (createTeamAction ? 1 : 0) + (showHireButton ? 1 : 0);
  const useCreateMenu = createActionCount > 1 || !showHireButton;

  const renderCreateControl = (options: {
    variant: 'ghost' | 'outline';
    icon: React.ReactNode;
    tooltipSide: 'right' | 'bottom';
  }): React.ReactNode => {
    if (createActionCount === 0) return null;

    if (!useCreateMenu) {
      return renderOnboardButton(
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={options.variant}
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={onOpenHireDialog}
                disabled={isHireButtonDisabled}
                aria-disabled={isHireButtonDisabled}
                aria-label="Onboard new teammate"
                data-testid="assistant-onboard-button"
              >
                {options.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side={options.tooltipSide}>
              <p>Onboard new teammate</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <DropdownMenu modal={false}>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={options.variant}
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label="Create"
                  data-testid="assistant-create-menu"
                >
                  {options.icon}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side={options.tooltipSide}>
              <p>Create</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {/* A credits-blocked onboard entry arrives wrapped in the guard's
            inline-flex span, which would otherwise shrink it out of line with
            the other items. */}
        <DropdownMenuContent align="end" className="min-w-[9rem] [&>span]:w-full">
          {createGroupAction ? (
            <DropdownMenuItem
              className="text-body-sm gap-2"
              onSelect={createGroupAction}
              data-testid="create-group-button"
            >
              <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Group
            </DropdownMenuItem>
          ) : null}
          {createTeamAction ? (
            <DropdownMenuItem
              className="text-body-sm gap-2"
              onSelect={createTeamAction}
              data-testid="create-team-button"
            >
              <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />
              Team
            </DropdownMenuItem>
          ) : null}
          {renderOnboardButton(
            <DropdownMenuItem
              className="text-body-sm gap-2"
              onSelect={onOpenHireDialog}
              disabled={isHireButtonDisabled}
              data-testid="assistant-onboard-button"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Teammate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Checkbox items keep the menu open so several filters can be toggled in one
  // pass; Radix would otherwise dismiss it after the first click.
  const renderFilterItem = (label: string, id: AssistantListFilterId) => (
    <DropdownMenuCheckboxItem
      className="text-body-sm"
      checked={filters.isVisible(id)}
      onCheckedChange={(next) => filters.setVisible(id, next)}
      onSelect={(event) => event.preventDefault()}
      data-testid={`assistant-list-filter-${id}`}
    >
      {label}
    </DropdownMenuCheckboxItem>
  );

  const filterMenu = isOrgWorkspace ? (
    <DropdownMenu modal={false}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  'h-7 w-7 shrink-0',
                  filters.hasHidden && 'border-primary/40 bg-primary/10 text-primary'
                )}
                aria-label="Filter list"
                data-filtered={filters.hasHidden ? 'true' : undefined}
                data-testid="assistant-list-filter-menu"
              >
                <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {/* A filter survives the menu that set it, so the closed control has
                to say so — a roster quietly missing rows reads as a bug. */}
            <p>{filters.hasHidden ? 'Filter list (some rows hidden)' : 'Filter list'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {renderFilterItem('Real', 'real')}
        {renderFilterItem('Virtual', 'virtual')}
        {renderFilterItem('Teams', 'teams')}
        {renderFilterItem('Groups', 'groups')}
        {filters.hasHidden ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-body-sm justify-center text-muted-foreground"
              onSelect={(event) => {
                event.preventDefault();
                filters.showAll();
              }}
              data-testid="assistant-list-filter-show-all"
            >
              Show all
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-transparent">
      {/* Header: search, the create menu, and the list filters. */}
      <div
        className={cn(
          'flex-shrink-0 overflow-hidden border-b border-border bg-card px-3',
          isFolded ? 'py-1' : 'py-2'
        )}
      >
        {isFolded ? (
          <div className="flex h-9 items-center justify-center">
            <div className="hidden md:flex">
              {renderCreateControl({
                variant: 'ghost',
                icon: <OnboardPlusIcon className="h-6 w-6" />,
                tooltipSide: 'right',
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-grow">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                className="h-7 w-full pl-7 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading || !!error}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {renderCreateControl({
                variant: 'outline',
                icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />,
                tooltipSide: 'bottom',
              })}
              {filterMenu}
            </div>
          </div>
        )}
      </div>

      {/* Content Area: Loading Skeletons, Error, or List */}
      <ScrollArea
        className={cn(
          'flex-1',
          // Radix wraps viewport children in `display:table`, which sizes to the
          // widest intrinsic row (e.g. long workspace descriptions). That pushes
          // the scroll surface wider than the sidebar and clips right-side actions.
          !isFolded &&
            '[&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]]:overflow-x-hidden'
        )}
      >
        <div
          className={cn(
            'w-full min-w-0 max-w-full space-y-1 overflow-x-hidden px-2 py-2',
            isFolded && 'flex flex-col items-center space-y-3 px-3 py-3'
          )}
        >
          {isLoading ? (
            <>
              {[...Array(10)].map((_, i) => (
                <AssistantListItemSkeleton key={`asst-skeleton-${i}`} isFolded={isFolded} />
              ))}
            </>
          ) : error ? (
            <div className="flex flex-col items-center justify-center pt-10 text-center">
              <WifiOff className="mb-2 h-6 w-6 text-muted-foreground" />
              {!isFolded && (
                <p className="text-body text-muted-foreground">Could not load assistants.</p>
              )}
            </div>
          ) : filteredAssistants.length > 0 || hasNonAssistantRows ? (
            shouldRenderFlatList ? (
              renderFlatAssistants()
            ) : (
              groupedAssistantList
            )
          ) : searchTerm && !isFolded ? (
            <p className="text-body p-4 text-center text-muted-foreground">
              No assistants match filters.
            </p>
          ) : !isFolded ? (
            <p className="text-body p-4 text-center text-muted-foreground">No assistants found.</p>
          ) : null}
        </div>
      </ScrollArea>

      {onToggleFold && (
        <div
          className={cn(
            // h-10 keeps this bar aligned with the chat input and the brain /
            // tasks / actions / dashboards tab footers at the bottom of the
            // right pane.
            'hidden h-10 flex-shrink-0 items-center px-2 md:flex',
            isFolded ? 'justify-center' : 'justify-end'
          )}
        >
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={onToggleFold}
                  data-testid="assistant-list-toggle-fold"
                  aria-label={isFolded ? 'Expand assistant list' : 'Collapse assistant list'}
                >
                  {isFolded ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isFolded ? 'Expand panel' : 'Collapse panel'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
