'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { RefreshCw, Users, MessageSquare, BookOpen, Compass, Code, Search, X } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { useBrainData } from '@/hooks/Assistants/useBrainData';
import type { ColumnDef } from '@tanstack/react-table';
import {
  getColumnsForContext,
  buildTranscriptColumns,
  BRAIN_CONTEXT_LABELS,
} from '@/utils/assistants/brain';
import { BrainTable } from './BrainTable';
import { BrainRowDetail } from './BrainRowDetail';
import type { BrainContext, BrainRow } from '@/types/assistants/brain';
import type { Assistant } from '@/types/assistants/assistant';
import { fetchAssistants } from '@/lib/client/assistant';
import {
  DestinationDropdown,
  BRAIN_DESTINATION_ALL,
  brainDestinationRoot,
  type BrainDestinationValue,
} from './DestinationDropdown';
import type { CoordinatorWorkspaceScope } from '@/lib/assistants/coordinatorIdentity';
import { currentTeamIds } from '@/lib/assistants/scope';
import { tabSearchPlaceholderForBrainContext } from '@/constants/assistants/tabSearchPlaceholders';
import { isImeComposing } from '@/utils/keyboard';

interface BrainPaneProps {
  assistant: Assistant;
  ownerId: string;
  assistantId: string;
  isVisible?: boolean;
  /**
   * Optional externally-controlled sub-tab. When the parent passes this
   * (and updates it), the pane mirrors the value to the underlying hook
   * via effect. The internal sub-tab state still lives in the hook, so
   * footer-tab clicks inside the pane continue to work; this prop adds
   * a *second* input that lets the parent (e.g. the right-pane tab
   * strip's dropdown) drive sub-tab selection too.
   */
  subTab?: BrainTabContext;
  /**
   * Fires whenever the active sub-tab changes — from footer clicks,
   * external `subTab` updates, or assistant-change resets. Lets the
   * parent's dropdown stay in sync with whichever sub-tab is actually
   * showing in the pane.
   */
  onSubTabChange?: (next: BrainTabContext) => void;
  /**
   * Hides the footer context switcher. Used when the pane is embedded as a
   * pinned single-context Brain view (e.g. the Brain → Transcripts section),
   * where switching to other Brain contexts from inside the view would be
   * confusing. Defaults to `false` (the full Brain pane behavior).
   */
  hideSubTabs?: boolean;
}

type BrainTabContext = Exclude<BrainContext, 'Tasks'>;

const CONTEXT_ICONS: Record<BrainTabContext, React.ElementType> = {
  Contacts: Users,
  Transcripts: MessageSquare,
  Knowledge: BookOpen,
  Guidance: Compass,
  Functions: Code,
};

const TAB_CLASS = [
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium',
  'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
  'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground',
].join(' ');

const ASSISTANT_NAME_LOOKUP_CACHE = new Map<string, Map<number, string>>();
const ASSISTANT_NAME_LOOKUP_IN_FLIGHT = new Map<string, Promise<Map<number, string>>>();

function assistantNameLookupKey(assistant: Pick<Assistant, 'organizationId' | 'userId'>): string {
  if (assistant.organizationId !== null) {
    return `org:${assistant.organizationId}`;
  }
  return `user:${assistant.userId}`;
}

function assistantDisplayNameFromNames(
  names: Pick<Assistant, 'firstName' | 'surname'>
): string | null {
  const firstName = (names.firstName ?? '').trim();
  const surname = (names.surname ?? '').trim();
  if (firstName && surname) {
    return `${firstName} ${surname}`;
  }
  if (firstName) {
    return firstName;
  }
  if (surname) {
    return surname;
  }
  return null;
}

function assistantNameMapsEqual(left: Map<number, string>, right: Map<number, string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  let matches = true;
  left.forEach((value, key) => {
    if (right.get(key) !== value) {
      matches = false;
    }
  });
  if (!matches) return false;
  return true;
}

async function fetchAssistantNameLookup(
  lookupKey: string,
  workspace: CoordinatorWorkspaceScope
): Promise<Map<number, string>> {
  const cached = ASSISTANT_NAME_LOOKUP_CACHE.get(lookupKey);
  if (cached) {
    return new Map(cached);
  }

  const existing = ASSISTANT_NAME_LOOKUP_IN_FLIGHT.get(lookupKey);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const result = await fetchAssistants(workspace);
    if (!Array.isArray(result)) {
      return new Map<number, string>();
    }

    const namesById = new Map<number, string>();
    for (const candidate of result) {
      const candidateId = Number(candidate.agentId);
      if (!Number.isInteger(candidateId)) continue;
      const candidateDisplayName = assistantDisplayNameFromNames(candidate);
      if (!candidateDisplayName) continue;
      namesById.set(candidateId, candidateDisplayName);
    }
    ASSISTANT_NAME_LOOKUP_CACHE.set(lookupKey, namesById);
    return namesById;
  })().finally(() => {
    ASSISTANT_NAME_LOOKUP_IN_FLIGHT.delete(lookupKey);
  });

  ASSISTANT_NAME_LOOKUP_IN_FLIGHT.set(lookupKey, request);
  return request;
}

export function BrainPane({
  assistant,
  ownerId,
  assistantId,
  subTab,
  onSubTabChange,
  isVisible = true,
  hideSubTabs = false,
}: BrainPaneProps) {
  const [destinationValue, setDestinationValue] =
    useState<BrainDestinationValue>(BRAIN_DESTINATION_ALL);
  const identityKey = `${ownerId}:${assistantId}`;
  const availableTeamIds = useMemo(() => currentTeamIds(assistant), [assistant]);
  const effectiveDestinationValue = useMemo((): BrainDestinationValue => {
    const root = brainDestinationRoot(destinationValue);
    if (root?.kind === 'team' && !availableTeamIds.includes(root.teamId)) {
      return BRAIN_DESTINATION_ALL;
    }
    return destinationValue;
  }, [availableTeamIds, destinationValue]);
  const selectedRoot = useMemo(
    () => brainDestinationRoot(effectiveDestinationValue),
    [effectiveDestinationValue]
  );
  // When embedded as a pinned single-context Brain view, only fetch that
  // context (not the all-five waterfall). Transcripts additionally needs
  // Contacts loaded to resolve sender/receiver names in `contactMap`.
  const pinnedContexts = useMemo((): readonly BrainTabContext[] | undefined => {
    if (!hideSubTabs || !subTab) return undefined;
    if (subTab === 'Transcripts') return ['Transcripts', 'Contacts'];
    return [subTab];
  }, [hideSubTabs, subTab]);
  const {
    contacts,
    transcripts,
    knowledge,
    guidance,
    functions,
    isLoading,
    isLoadingMore,
    error,
    activeContext,
    setActiveContext,
    sort,
    search,
    clearSearch,
    loadMore,
    refetch,
  } = useBrainData({
    assistant,
    ownerId,
    assistantId,
    root: selectedRoot,
    contexts: pinnedContexts,
    initialContext: hideSubTabs ? subTab : undefined,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [assistantNamesById, setAssistantNamesById] = useState<Map<number, string>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDestinationValue(BRAIN_DESTINATION_ALL);
  }, [identityKey]);

  useEffect(() => {
    if (effectiveDestinationValue !== destinationValue) {
      setDestinationValue(effectiveDestinationValue);
    }
  }, [destinationValue, effectiveDestinationValue]);

  useEffect(() => {
    setSelectedRow(null);
  }, [activeContext, effectiveDestinationValue]);
  // Parent -> hook: mirror any externally-controlled sub-tab into the hook state.
  useEffect(() => {
    if (subTab !== undefined) {
      setActiveContext(subTab);
    }
  }, [subTab, setActiveContext]);

  // Hook -> parent: keep the right-pane dropdown aligned with active sub-tab.
  useEffect(() => {
    onSubTabChange?.(activeContext);
  }, [activeContext, onSubTabChange]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  const handleSearchSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isImeComposing(e)) return;
      if (e.key === 'Enter') {
        const val = searchValue.trim();
        if (val) {
          search(val);
        } else {
          clearSearch();
        }
      }
    },
    [searchValue, search, clearSearch]
  );

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    clearSearch();
    inputRef.current?.focus();
  }, [clearSearch]);

  const contactMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of contacts.rows) {
      const name = [c.firstName, c.surname].filter(Boolean).join(' ');
      if (name) map.set(c.contactId, name);
    }
    return map;
  }, [contacts.rows]);
  const assistantContactIds = useMemo(() => {
    const roots = assistant.contactIdentityRoots ?? [];
    return new Set<number>([
      assistant.selfContactId,
      ...roots.map((identity) => identity.selfContactId),
    ]);
  }, [assistant.contactIdentityRoots, assistant.selfContactId]);
  const assistantDisplayName = useMemo(() => {
    return (
      assistantDisplayNameFromNames({
        firstName: assistant.firstName,
        surname: assistant.surname,
      }) ?? assistant.firstName
    );
  }, [assistant.firstName, assistant.surname]);
  const selectedAssistantId = useMemo(() => {
    const parsed = Number(assistant.agentId);
    return Number.isInteger(parsed) ? parsed : null;
  }, [assistant.agentId]);
  const workspace = useMemo(
    () =>
      assistant.organizationId !== null
        ? { type: 'organization' as const, organizationId: assistant.organizationId }
        : { type: 'personal' as const, organizationId: null },
    [assistant.organizationId]
  );
  const lookupKey = useMemo(
    () =>
      assistantNameLookupKey({
        organizationId: assistant.organizationId,
        userId: assistant.userId,
      }),
    [assistant.organizationId, assistant.userId]
  );
  const shouldResolveAssistantNames = isVisible && activeContext === 'Transcripts';

  useEffect(() => {
    let isActive = true;
    const fallbackMap = new Map<number, string>();
    if (selectedAssistantId !== null && assistantDisplayName) {
      fallbackMap.set(selectedAssistantId, assistantDisplayName);
    }
    const setIfChanged = (next: Map<number, string>) => {
      setAssistantNamesById((previous) =>
        assistantNameMapsEqual(previous, next) ? previous : next
      );
    };

    const loadAssistantNames = async () => {
      if (!shouldResolveAssistantNames) {
        setIfChanged(fallbackMap);
        return;
      }

      const cachedNames = ASSISTANT_NAME_LOOKUP_CACHE.get(lookupKey);
      if (cachedNames) {
        const mergedNames = new Map(cachedNames);
        fallbackMap.forEach((value, key) => {
          mergedNames.set(key, value);
        });
        setIfChanged(mergedNames);
        return;
      }

      setIfChanged(fallbackMap);
      const resolvedNames = await fetchAssistantNameLookup(lookupKey, workspace);
      if (!isActive) {
        return;
      }
      const namesById = new Map(resolvedNames);
      fallbackMap.forEach((value, key) => {
        namesById.set(key, value);
      });
      setIfChanged(namesById);
    };

    void loadAssistantNames();
    return () => {
      isActive = false;
    };
  }, [
    shouldResolveAssistantNames,
    lookupKey,
    workspace,
    assistantDisplayName,
    selectedAssistantId,
  ]);

  const activeState = useMemo(() => {
    switch (activeContext) {
      case 'Contacts':
        return contacts;
      case 'Transcripts':
        return transcripts;
      case 'Knowledge':
        return knowledge;
      case 'Guidance':
        return guidance;
      case 'Functions':
        return functions;
    }
  }, [activeContext, contacts, transcripts, knowledge, guidance, functions]);

  useEffect(() => {
    setSearchValue(activeState.searchQuery);
  }, [activeContext, activeState.searchQuery]);

  const allColumns = useMemo(() => {
    if (activeContext === 'Transcripts') {
      return buildTranscriptColumns(contactMap, {
        assistantContactIds,
        assistantDisplayName,
        selectedAssistantId,
        assistantNamesById,
      });
    }
    return getColumnsForContext(activeContext, activeState.fields);
  }, [
    activeContext,
    activeState.fields,
    contactMap,
    assistantContactIds,
    assistantDisplayName,
    selectedAssistantId,
    assistantNamesById,
  ]);

  const columns = useMemo(() => {
    if (activeState.rows.length === 0) return allColumns;
    return allColumns.filter((col) => {
      const key = (col as any).accessorKey as string | undefined;
      if (!key) return true;
      return activeState.rows.some((row) => {
        const val = (row as Record<string, unknown>)[key];
        return val !== null && val !== undefined && val !== '';
      });
    });
  }, [allColumns, activeState.rows]);

  const counts: Record<BrainTabContext, number> = {
    Contacts: contacts.count,
    Transcripts: transcripts.count,
    Knowledge: knowledge.count,
    Guidance: guidance.count,
    Functions: functions.count,
  };

  const isFiltered = !!activeState.filter;
  const detailTitle = `${BRAIN_CONTEXT_LABELS[activeContext]} Detail`;
  const emptyMessage = isFiltered
    ? 'No results match your search.'
    : `No ${(BRAIN_CONTEXT_LABELS[activeContext] ?? activeContext).toLowerCase()} found.`;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="text-body-muted text-sm">{error}</span>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="brain-pane">
      {/* Header — search, destination drill-in, refresh */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        data-testid="brain-header"
      >
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            className="h-7 w-full rounded-md border bg-transparent pl-7 pr-7 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={tabSearchPlaceholderForBrainContext(activeContext)}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchSubmit}
            data-testid="brain-search"
          />
          {isFiltered && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={handleClearSearch}
              data-testid="brain-search-clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        <DestinationDropdown
          assistant={assistant}
          value={effectiveDestinationValue}
          onValueChange={setDestinationValue}
        />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleRefresh}
          disabled={isRefreshing}
          data-testid="brain-refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Body — table */}
      <div className="min-h-0 flex-1" data-testid="brain-body">
        <BrainTable<BrainRow>
          data={activeState.rows}
          columns={columns as ColumnDef<BrainRow, any>[]}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          hasMore={activeState.hasMore}
          emptyMessage={emptyMessage}
          onRowClick={(row) => setSelectedRow(row as Record<string, unknown>)}
          onSort={sort}
          onLoadMore={loadMore}
          serverSorting={activeState.sorting}
          testId={`brain-table-${activeContext.toLowerCase()}`}
        />
      </div>

      {/* Footer — sub-tabs (left) + row count (right). h-10 aligns this bar
          with the assistant-list toggle and the chat input / other tab footers. */}
      <div
        className="flex h-10 shrink-0 items-center justify-between border-t px-2"
        data-testid="brain-footer"
      >
        {hideSubTabs ? (
          <div />
        ) : (
          <div className="flex items-center gap-1 overflow-x-auto" data-testid="brain-sub-tabs">
            {(Object.keys(BRAIN_CONTEXT_LABELS) as BrainTabContext[]).map((ctx) => {
              const Icon = CONTEXT_ICONS[ctx];
              return (
                <button
                  key={ctx}
                  className={TAB_CLASS}
                  data-active={activeContext === ctx}
                  data-testid={`brain-tab-${ctx.toLowerCase()}`}
                  onClick={() => setActiveContext(ctx)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{BRAIN_CONTEXT_LABELS[ctx]}</span>
                  <span className="tabular-nums opacity-60 sm:hidden">
                    {counts[ctx] > 0 ? counts[ctx] : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {activeState.rows.length > 0 && (
          <span
            className="text-caption hidden shrink-0 px-3 py-1.5 sm:inline"
            data-testid="brain-table-footer"
          >
            {activeState.rows.length} of {activeState.count}{' '}
            {activeState.count === 1 ? 'row' : 'rows'}
            {activeState.hasMore && ' · scroll for more'}
          </span>
        )}
      </div>

      <BrainRowDetail
        row={selectedRow}
        context={activeContext}
        title={detailTitle}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
