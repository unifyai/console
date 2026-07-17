'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { currentTeamIds, type ContextRoot } from '@/lib/assistants/scope';
import type { Assistant } from '@/types/assistants/assistant';

export interface BrainScopeOption {
  key: string;
  label: string;
  /** null = merged view across every readable root. */
  root: ContextRoot | null;
}

interface UseBrainScopeFilterOptions {
  /**
   * Externally-pinned scope (e.g. the team workspace pins a team root). When
   * set, the filter is hidden and the pinned root is used verbatim.
   */
  fixedRoot?: ContextRoot | null;
  /**
   * Whether the merged "All" scope is offered. Panes reading through the
   * federated logs endpoint get an exact cross-root merge and include it.
   */
  includeAll?: boolean;
}

export interface BrainScopeFilterState {
  /** The root to hand to the pane's data hook (null = merged). */
  root: ContextRoot | null;
  options: BrainScopeOption[];
  activeKey: string;
  setActiveKey: (key: string) => void;
  /** True when the chip row should render (assistant view with teams). */
  showFilter: boolean;
}

/**
 * Per-pane scope selection for assistants that belong to shared teams: the
 * pane defaults to the full merged picture (or Personal where merging is not
 * meaningful) and one click focuses the personal root or any single team's
 * `Teams/{id}/…` contexts. Hidden for teamless assistants and for panes whose
 * scope is pinned from outside (team selections).
 */
export function useBrainScopeFilter(
  assistant: Assistant,
  { fixedRoot = null, includeAll = true }: UseBrainScopeFilterOptions = {}
): BrainScopeFilterState {
  const options = React.useMemo<BrainScopeOption[]>(() => {
    const teamNamesById = new Map(
      (assistant.teamSummaries ?? []).map((summary) => [summary.teamId, summary.name])
    );
    const teamOptions = currentTeamIds(assistant).map((teamId) => ({
      key: `team-${teamId}`,
      label: teamNamesById.get(teamId) ?? `Team ${teamId}`,
      root: { kind: 'team', teamId } as ContextRoot,
    }));
    const baseOptions: BrainScopeOption[] = includeAll
      ? [{ key: 'all', label: 'All', root: null }]
      : [];
    return [
      ...baseOptions,
      { key: 'personal', label: 'Personal', root: { kind: 'personal' } },
      ...teamOptions,
    ];
  }, [assistant, includeAll]);

  const defaultKey = includeAll ? 'all' : 'personal';
  const [activeKey, setActiveKey] = React.useState(defaultKey);

  // A different assistant means different teams; start over from the default.
  const assistantId = assistant.agentId;
  const previousAssistantIdRef = React.useRef(assistantId);
  React.useEffect(() => {
    if (previousAssistantIdRef.current !== assistantId) {
      previousAssistantIdRef.current = assistantId;
      setActiveKey(defaultKey);
    }
  }, [assistantId, defaultKey]);

  const hasTeams = currentTeamIds(assistant).length > 0;
  const showFilter = fixedRoot == null && hasTeams;

  const resolvedKey = options.some((option) => option.key === activeKey) ? activeKey : defaultKey;
  const activeOption = options.find((option) => option.key === resolvedKey);

  return {
    root: fixedRoot != null || !showFilter ? fixedRoot : (activeOption?.root ?? null),
    options,
    activeKey: resolvedKey,
    setActiveKey,
    showFilter,
  };
}

interface BrainScopeChipsProps {
  scope: BrainScopeFilterState;
  className?: string;
}

/** The chip row itself; render directly beneath the pane's toolbar. */
export function BrainScopeChips({ scope, className }: BrainScopeChipsProps) {
  if (!scope.showFilter) return null;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5',
        className
      )}
      data-testid="brain-scope-filter"
      role="tablist"
      aria-label="Memory scope"
    >
      {scope.options.map((option) => {
        const isActive = option.key === scope.activeKey;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`brain-scope-${option.key}`}
            onClick={() => scope.setActiveKey(option.key)}
            className={cn(
              'text-caption rounded-full border px-2.5 py-0.5 transition-colors',
              isActive
                ? 'border-primary-tint-30 bg-primary-tint-10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
