import * as React from 'react';
import { Input } from '@/components/UI/input';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Search, WifiOff, UserPlus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { Assistant, AssistantStatus } from '@/types/assistants/assistant';
import type { ContactType } from '@/types/assistants/contact';
import { AssistantListItem } from './AssistantListItem';
import { AssistantListItemSkeleton } from './AssistantListItemSkeleton';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { cn } from '@/lib/utils';
import type { SpaceSummary } from '@/types/spaces/space';
import { AssistantListGroupHeader } from './AssistantListGroupHeader';
import {
  groupAssistantsBySpace,
  type AssistantListEntry,
  type AssistantListGroup,
} from './assistantListGroups';

const LIST_GROUP_FOLDS_STORAGE_KEY = 'console:assistants:listGroupFolds';

interface AssistantListProps {
  assistants: Assistant[];
  assistantStatuses: Map<string, AssistantStatus | null>;
  assistantError: string | null;
  isLoading: boolean;
  error: string | null;
  profileAssistantId: string | null;
  onShowProfile: (id: string) => void;
  onOpenHireDialog: () => void;
  onOpenContactManager: (assistant: Assistant, tab?: ContactType) => void;
  onOpenWorkspaceManager: (assistant: Assistant) => void;
  onEditAssistant: (assistant: Assistant) => void;
  onEndContract?: (assistant: Assistant) => Promise<void>;
  canEndContract?: (assistant: Assistant) => boolean;
  /**
   * Predicate gating the row dropdown's "Profile" / "Contact Details"
   * edit entries. When it returns `false` for an assistant the menu
   * items are hidden entirely (rather than disabled) so non-write
   * viewers don't see edit affordances they can't act on. Defaults
   * to "always allowed" to preserve back-compat for callers that
   * pre-date the gating.
   */
  canEditAssistant?: (assistant: Assistant) => boolean;
  isFolded: boolean;
  activeCallAssistantId: string | null;
  onHangUp: () => void;
  /** Whether the current user can hire new assistants (org Owner in org context, anyone in personal workspace) */
  canHire?: boolean;
  onToggleFold?: () => void;
  /**
   * Per-assistant unread message counts driven by the page-level inbox
   * multiplex stream. A missing key or `0` means no badge is shown.
   */
  unreadCounts?: Record<string, number>;
  spacesById: Record<number, SpaceSummary>;
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
  onOpenContactManager,
  onOpenWorkspaceManager,
  onEditAssistant,
  onEndContract,
  canEndContract,
  canEditAssistant,
  isFolded,
  activeCallAssistantId,
  onHangUp,
  canHire = true,
  onToggleFold,
  unreadCounts,
  spacesById,
}: AssistantListProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [foldedGroups, setFoldedGroups] = React.useState<Record<string, boolean>>({});

  const filteredAssistants = React.useMemo(() => {
    if (!searchTerm) return assistants;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return assistants.filter(
      (a) =>
        (a.isCoordinator === true && 'coordinator'.includes(lowerSearchTerm)) ||
        (a.firstName &&
          a.surname &&
          `${a.firstName} ${a.surname}`.toLowerCase().includes(lowerSearchTerm)) ||
        (a.email && a.email.toLowerCase().includes(lowerSearchTerm))
    );
  }, [assistants, searchTerm]);

  const assistantGroups = React.useMemo(
    () => groupAssistantsBySpace(filteredAssistants, spacesById),
    [filteredAssistants, spacesById]
  );

  const foldedAssistantRows = React.useMemo(() => {
    if (!isFolded) {
      return { assistants: filteredAssistants, coordinatorCount: 0 };
    }

    const coordinatorRows: Assistant[] = [];
    const regularRows: Assistant[] = [];
    filteredAssistants.forEach((assistant) => {
      if (assistant.isCoordinator) {
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
  }, [filteredAssistants, isFolded]);

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

  const renderAssistantRow = React.useCallback(
    (entry: AssistantListEntry, key: string) => {
      const item = (
        <AssistantListItem
          key={key}
          assistant={entry.assistant}
          status={assistantStatuses.get(entry.assistant.agentId) || null}
          isSelected={profileAssistantId === entry.assistant.agentId}
          onShowProfile={onShowProfile}
          onOpenContactManager={onOpenContactManager}
          onEditAssistant={onEditAssistant}
          onEndContract={canEndContract?.(entry.assistant) ? onEndContract : undefined}
          canEdit={canEditAssistant ? canEditAssistant(entry.assistant) : true}
          isFolded={isFolded}
          isCallActive={activeCallAssistantId === entry.assistant.agentId}
          unreadCount={unreadCounts?.[entry.assistant.agentId] ?? 0}
          isPrimary={entry.isPrimarySpaceListing}
          alsoInSpaceLabels={entry.alsoInSpaceLabels}
        />
      );

      return item;
    },
    [
      activeCallAssistantId,
      assistantStatuses,
      canEditAssistant,
      canEndContract,
      isFolded,
      onEditAssistant,
      onEndContract,
      onOpenContactManager,
      onShowProfile,
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
            isPrimarySpaceListing: true,
            alsoInSpaceLabels: [],
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
      const description = group.kind === 'space' ? spacesById[group.spaceId]?.description : null;
      return (
        <div key={group.id} data-testid={`assistant-list-group-${group.id}`}>
          <AssistantListGroupHeader
            label={group.label}
            count={group.rows.length}
            isFolded={isGroupFolded}
            onToggleFold={() => toggleGroupFold(group.id)}
            description={description}
          />
          {!isGroupFolded && (
            <div className="space-y-1 pt-1">
              {group.rows.map((entry) =>
                renderAssistantRow(entry, `${group.id}:${entry.assistant.agentId}`)
              )}
            </div>
          )}
        </div>
      );
    },
    [foldedGroups, renderAssistantRow, spacesById, toggleGroupFold]
  );

  const renderSection = React.useCallback(
    (
      sectionId: string,
      label: string,
      count: number,
      children: React.ReactNode,
      testId: string
    ) => {
      const isSectionFolded = foldedGroups[sectionId] === true;
      return (
        <div key={sectionId} data-testid={testId}>
          <AssistantListGroupHeader
            label={label}
            count={count}
            isFolded={isSectionFolded}
            onToggleFold={() => toggleGroupFold(sectionId)}
            variant="section"
          />
          {!isSectionFolded && <div className="space-y-2 pt-1">{children}</div>}
        </div>
      );
    },
    [foldedGroups, toggleGroupFold]
  );

  const shouldRenderFlatList =
    isFolded || (assistantGroups.length === 1 && assistantGroups[0].kind === 'solo');
  const pinnedGroup = assistantGroups.find((group) => group.kind === 'pinned');
  const spaceGroups = assistantGroups.filter((group) => group.kind === 'space');
  const soloGroup = assistantGroups.find((group) => group.kind === 'solo');
  const hasPinnedRows = (pinnedGroup?.rows.length ?? 0) > 0;
  const hasGroupedRowsBelowCoordinator = spaceGroups.length > 0 || !!soloGroup;
  const groupedAssistantList = (
    <div className="space-y-3">
      {pinnedGroup ? (
        <div className="space-y-1" data-testid="assistant-list-group-pinned">
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
      {spaceGroups.length > 0
        ? renderSection(
            'section:spaces',
            'Spaces',
            spaceGroups.length,
            spaceGroups.map(renderGroup),
            'assistant-list-section-spaces'
          )
        : null}
      {soloGroup
        ? renderSection(
            'section:solo',
            'Solo',
            soloGroup.rows.length,
            <div className="space-y-1">
              {soloGroup.rows.map((entry) =>
                renderAssistantRow(entry, `${soloGroup.id}:${entry.assistant.agentId}`)
              )}
            </div>,
            'assistant-list-section-solo'
          )
        : null}
    </div>
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background">
      {/* Header: Search Bar + New Assistant Button */}
      <div className="flex-shrink-0 overflow-hidden border-b px-3 py-2">
        {isFolded ? (
          <div className="flex min-h-7 items-center justify-center">
            {showHireButton && (
              <div className="hidden md:flex">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isFolded ? 'ghost' : 'outline'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={onOpenHireDialog}
                        disabled={isHireButtonDisabled}
                        aria-disabled={isHireButtonDisabled}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Hire new assistant</p>
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
                placeholder="Search..."
                className="h-7 w-full pl-7 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading || !!error}
              />
            </div>
            {showHireButton && (
              <Button
                variant="outline"
                size="sm"
                className="hidden h-7 items-center text-xs md:inline-flex"
                onClick={onOpenHireDialog}
                disabled={isHireButtonDisabled}
                aria-disabled={isHireButtonDisabled}
              >
                <UserPlus className="h-4 w-4" />
                New
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content Area: Loading Skeletons, Error, or List */}
      <ScrollArea className="flex-1">
        <div
          className={cn(
            'space-y-1 px-2 py-2',
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
            // h-10 keeps this bar aligned with the chat input and the memory /
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
