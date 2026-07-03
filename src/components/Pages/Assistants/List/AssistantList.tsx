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
} from 'lucide-react';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import { AssistantListItem } from './AssistantListItem';
import { AssistantListItemSkeleton } from './AssistantListItemSkeleton';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import {
  type CoordinatorWorkspaceScope,
  resolveCanonicalWorkspaceCoordinator,
} from '@/lib/assistants/coordinatorIdentity';
import type { SharedTeamSummary } from '@/types/teams/sharedTeam';
import { AssistantListGroupHeader } from './AssistantListGroupHeader';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';
import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';
import {
  groupAssistantsByTeam,
  type AssistantListEntry,
  type AssistantListGroup,
} from './assistantListGroups';

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

function UnityOnboardIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Antenna */}
      <circle cx={9.5} cy={3.3} r={1.1} />
      <rect x={8.9} y={4.1} width={1.2} height={2.4} />
      {/* Cuboidal head with square eyes cut out */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.5 6.5h12v12.5h-12ZM6 10.5h2.5v2.5H6ZM10.5 10.5h2.5v2.5h-2.5Z"
      />
      {/* Add badge */}
      <path
        d="M20.2 1.4v4.8M22.6 3.8h-4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
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
  onToggleAssistantInfo: (assistantId: string) => void;
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
}

export function AssistantList({
  assistants,
  assistantStatuses,
  assistantError,
  isLoading,
  error,
  profileAssistantId,
  onShowProfile,
  onToggleAssistantInfo,
  onOpenHireDialog,
  isFolded,
  activeCallAssistantId,
  canHire = true,
  onToggleFold,
  unreadCounts,
  currentUserId = null,
  workspace,
  teamsById,
}: AssistantListProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [foldedGroups, setFoldedGroups] = React.useState<Record<string, boolean>>({});

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
          onToggleAssistantInfo={onToggleAssistantInfo}
          isFolded={isFolded}
          isCallActive={activeCallAssistantId === entry.assistant.agentId}
          unreadCount={unreadCounts?.[entry.assistant.agentId] ?? 0}
          isPrimary={entry.isPrimaryTeamListing}
          alsoInTeamLabels={entry.alsoInTeamLabels}
        />
      );

      return item;
    },
    [
      activeCallAssistantId,
      assistantStatuses,
      isFolded,
      onShowProfile,
      onToggleAssistantInfo,
      profileAssistantId,
      unreadCounts,
    ]
  );

  const renderFlatAssistants = React.useCallback(() => {
    const renderedRows: React.ReactNode[] = [];
    const { assistants: flatAssistants, coordinatorCount } = foldedAssistantRows;

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
  }, [foldedAssistantRows, isFolded, renderAssistantRow]);

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
            variant={group.kind === 'team' ? 'workspace' : 'group'}
            subtitle={subtitle}
            icon={
              group.kind === 'team' ? (
                <Building2 className="h-4 w-4" aria-hidden="true" />
              ) : undefined
            }
            badgeLabel={group.kind === 'team' ? 'Team' : undefined}
          />
          {!isGroupFolded && (
            <div className={cn('min-w-0 space-y-1 pt-1', group.kind === 'team' && 'pl-3')}>
              {group.rows.map((entry) =>
                renderAssistantRow(entry, `${group.id}:${entry.assistant.agentId}`)
              )}
            </div>
          )}
        </div>
      );
    },
    [foldedGroups, renderAssistantRow, teamsById, toggleGroupFold]
  );

  const renderSection = React.useCallback(
    (
      sectionId: string,
      label: string,
      count: number,
      children: React.ReactNode,
      testId: string,
      options: { icon?: React.ReactNode } = {}
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
          />
          {!isSectionFolded && <div className="min-w-0 space-y-2 pt-1">{children}</div>}
        </div>
      );
    },
    [foldedGroups, toggleGroupFold]
  );

  const shouldRenderFlatList =
    isFolded || (assistantGroups.length === 1 && assistantGroups[0].kind === 'solo');
  const pinnedGroup = assistantGroups.find((group) => group.kind === 'pinned');
  const teamGroups = assistantGroups.filter((group) => group.kind === 'team');
  const soloGroup = assistantGroups.find((group) => group.kind === 'solo');
  const hasPinnedRows = (pinnedGroup?.rows.length ?? 0) > 0;
  const hasGroupedRowsBelowCoordinator = teamGroups.length > 0 || !!soloGroup;
  const soloRows = soloGroup?.rows ?? [];
  const groupedAssistantList = (
    <div className="w-full min-w-0 max-w-full space-y-3">
      {pinnedGroup ? (
        <div className="min-w-0 space-y-1" data-testid="assistant-list-group-pinned">
          {pinnedGroup.rows.map((entry) =>
            renderAssistantRow(entry, `${pinnedGroup.id}:${entry.assistant.agentId}`)
          )}
        </div>
      ) : null}
      {hasPinnedRows && hasGroupedRowsBelowCoordinator ? (
        <div
          role="separator"
          aria-orientation="horizontal"
          data-testid="coordinator-divider"
          className="my-2 border-t border-border"
        />
      ) : null}
      {teamGroups.length > 0
        ? renderSection(
            'section:teams',
            'Teams',
            teamGroups.length,
            teamGroups.map(renderGroup),
            'assistant-list-section-teams',
            {
              icon: <UsersRound className="h-3.5 w-3.5" aria-hidden="true" />,
            }
          )
        : null}
      {soloGroup
        ? renderSection(
            'section:solo',
            'Team',
            soloRows.length,
            <div className="min-w-0 space-y-1">
              {soloRows.map((entry) =>
                renderAssistantRow(entry, `${soloGroup.id}:${entry.assistant.agentId}`)
              )}
            </div>,
            'assistant-list-section-solo'
          )
        : null}
    </div>
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-transparent">
      {/* Header: Search Bar + New Assistant Button */}
      <div
        className={cn(
          'flex-shrink-0 overflow-hidden border-b border-border bg-card px-3',
          isFolded ? 'py-1' : 'py-2'
        )}
      >
        {isFolded ? (
          <div className="flex h-9 items-center justify-center">
            {renderOnboardButton(
              <div className="hidden md:flex">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        data-testid="assistant-onboard-button"
                        variant={isFolded ? 'ghost' : 'outline'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={onOpenHireDialog}
                        disabled={isHireButtonDisabled}
                        aria-disabled={isHireButtonDisabled}
                      >
                        <OnboardPlusIcon className="h-6 w-6" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Onboard new teammate</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={tabSearchPlaceholder('assistants')}
                className="h-7 w-full pl-7 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading || !!error}
              />
            </div>
            {renderOnboardButton(
              <Button
                data-testid="assistant-onboard-button"
                variant="outline"
                size="sm"
                className="hidden h-7 items-center text-xs md:inline-flex"
                onClick={onOpenHireDialog}
                disabled={isHireButtonDisabled}
                aria-disabled={isHireButtonDisabled}
              >
                <UnityOnboardIcon className="h-5 w-5" />
                Onboard
              </Button>
            )}
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
          ) : filteredAssistants.length > 0 ? (
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
